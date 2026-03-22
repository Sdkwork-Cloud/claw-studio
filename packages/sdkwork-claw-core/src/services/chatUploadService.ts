import type {
  FileVO,
  PresignedUploadRegisterForm,
  PresignedUrlForm,
  SdkworkAppClient,
} from '@sdkwork/app-sdk';
import {
  platform,
  type PlatformFetchedRemoteUrl,
} from '@sdkwork/claw-infrastructure';
import type {
  StudioConversationAttachment,
  StudioConversationAttachmentKind,
} from '@sdkwork/claw-types';
import { unwrapAppSdkResponse } from '../sdk/appSdkResult.ts';
import { getAppSdkClientWithSession } from '../sdk/useAppSdkClient.ts';

type ChatUploadClient = Pick<SdkworkAppClient, 'upload'>;

export interface ChatUploadFileInput {
  data: Blob;
  fileName: string;
  kind?: StudioConversationAttachmentKind;
  contentType?: string;
  bucket?: string;
  path?: string;
  provider?: PresignedUploadRegisterForm['provider'];
}

export interface ChatUploadRemoteUrlInput {
  url: string;
  fileName?: string;
  kind?: StudioConversationAttachmentKind;
  contentType?: string;
  bucket?: string;
  path?: string;
  provider?: PresignedUploadRegisterForm['provider'];
}

export interface CreateChatUploadServiceOptions {
  getClient?: () => ChatUploadClient;
  fetchFn?: typeof fetch;
  fetchRemoteUrl?: (url: string) => Promise<PlatformFetchedRemoteUrl>;
  now?: () => Date;
  createId?: () => string;
}

export interface ChatUploadService {
  uploadFile(input: ChatUploadFileInput): Promise<StudioConversationAttachment>;
  uploadRemoteUrl(input: ChatUploadRemoteUrlInput): Promise<StudioConversationAttachment>;
}

function defaultCreateId() {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return normalized || 'upload.bin';
}

function inferAttachmentKind(
  kind: StudioConversationAttachmentKind | undefined,
  contentType: string,
): StudioConversationAttachmentKind {
  if (kind) {
    return kind;
  }

  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('audio/')) {
    return 'audio';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }

  return 'file';
}

function deriveFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : 'remote-resource';
  } catch {
    return 'remote-resource';
  }
}

async function fetchRemoteUrlWithFetch(
  fetchFn: typeof fetch,
  url: string,
): Promise<PlatformFetchedRemoteUrl> {
  const sourceResponse = await fetchFn(url, {
    method: 'GET',
  });

  if (!sourceResponse.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${sourceResponse.status} ${sourceResponse.statusText}`.trim(),
    );
  }

  return {
    url: sourceResponse.url || url,
    bytes: new Uint8Array(await sourceResponse.arrayBuffer()),
    contentType: sourceResponse.headers.get('content-type')?.trim() || undefined,
  };
}

function buildObjectKey(fileName: string, now: Date, pathPrefix?: string) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const safeName = sanitizePathSegment(sanitizeFileName(fileName)) || 'upload.bin';
  const safePrefix = sanitizePathSegment(pathPrefix || 'chat');
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${safePrefix || 'chat'}/${year}/${month}/${day}/${randomPart}-${safeName}`;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  return fallback;
}

function mapFileVoToAttachment(params: {
  file: FileVO;
  id: string;
  kind: StudioConversationAttachmentKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  originalUrl?: string;
}): StudioConversationAttachment {
  const finalUrl = params.file.accessUrl?.trim() || undefined;
  return {
    id: params.id,
    kind: params.kind,
    name: params.file.fileName?.trim() || params.fileName,
    mimeType:
      params.file.contentType?.trim() ||
      params.file.fileType?.trim() ||
      params.contentType,
    sizeBytes: params.file.fileSize ?? params.sizeBytes,
    fileId: params.file.fileId?.trim() || undefined,
    objectKey: params.file.objectKey?.trim() || undefined,
    url: finalUrl,
    previewUrl: finalUrl,
    originalUrl: params.originalUrl?.trim() || undefined,
  };
}

export function createChatUploadService(
  options: CreateChatUploadServiceOptions = {},
): ChatUploadService {
  const getClient = options.getClient ?? getAppSdkClientWithSession;
  const fetchFn = options.fetchFn ?? fetch;
  const fetchRemoteUrl =
    options.fetchRemoteUrl ??
    ((url: string) =>
      platform.getPlatform() === 'desktop'
        ? platform.fetchRemoteUrl(url)
        : fetchRemoteUrlWithFetch(fetchFn, url));
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? defaultCreateId;

  return {
    async uploadFile(input) {
      const client = getClient();
      const fileName = sanitizeFileName(input.fileName);
      const contentType =
        (input.contentType || input.data.type || 'application/octet-stream').trim();
      const size = input.data.size;
      const kind = inferAttachmentKind(input.kind, contentType);
      const objectKey = buildObjectKey(fileName, now(), input.path);

      const presignedRequest: PresignedUrlForm = {
        objectKey,
        bucket: input.bucket,
        method: 'PUT',
        expirationSeconds: 900,
      };
      const presigned = unwrapAppSdkResponse(
        await client.upload.getPresignedUrl(presignedRequest),
        `Failed to create a presigned upload URL for ${fileName}.`,
      );
      const uploadUrl = presigned.url?.trim();

      if (!uploadUrl) {
        throw new Error(`Failed to create a usable presigned upload URL for ${fileName}.`);
      }

      const uploadResponse = await fetchFn(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: input.data,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Failed to upload ${fileName}: ${uploadResponse.status} ${uploadResponse.statusText}`.trim(),
        );
      }

      const registerBody: PresignedUploadRegisterForm = {
        objectKey,
        fileName,
        size,
        contentType,
        type: kind,
        path: input.path,
        bucket: input.bucket,
        provider: input.provider,
      };
      const file = unwrapAppSdkResponse(
        await client.upload.registerPresigned(registerBody),
        `Failed to register ${fileName} after upload.`,
      );

      return mapFileVoToAttachment({
        file,
        id: createId(),
        kind,
        fileName,
        contentType,
        sizeBytes: size,
      });
    },

    async uploadRemoteUrl(input) {
      const remoteFile = await fetchRemoteUrl(input.url);
      const contentType =
        (
          input.contentType ||
          remoteFile.contentType ||
          'application/octet-stream'
        ).trim();
      const data = new Blob([remoteFile.bytes], {
        type: contentType,
      });
      const fileName = sanitizeFileName(
        input.fileName ||
          remoteFile.fileName ||
          deriveFileNameFromUrl(remoteFile.url || input.url),
      );

      try {
        const attachment = await this.uploadFile({
          data,
          fileName,
          kind: input.kind,
          contentType,
          bucket: input.bucket,
          path: input.path,
          provider: input.provider,
        });

        return {
          ...attachment,
          originalUrl: input.url,
        };
      } catch (error) {
        throw new Error(
          `Failed to upload ${fileName} from ${input.url}: ${toErrorMessage(error, 'Unknown upload error')}`,
        );
      }
    },
  };
}

export const chatUploadService = createChatUploadService();
