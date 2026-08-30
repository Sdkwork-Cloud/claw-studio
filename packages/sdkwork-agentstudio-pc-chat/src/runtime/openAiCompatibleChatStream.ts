import {
  extractChatHttpPayloadTextFragments,
  extractChatHttpStreamTextDeltas,
} from '../services/chatHttpStreamProtocol.ts';

/**
 * OpenAI-compatible streaming chat transport.
 *
 * Raw HTTP dispatch belongs in this runtime/adapter layer, never directly in
 * the service layer. The chat service consumes it through an injected
 * `streamRequest` dependency.
 */

function extractFramePayloads(frame: string) {
  const lines = frame
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const dataLines = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());

  return dataLines.length > 0 ? dataLines : lines;
}

async function* streamHttpResponse(response: Response): AsyncGenerator<string, void, unknown> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    const fragments = extractChatHttpPayloadTextFragments(payload);
    if (fragments.length > 0) {
      for (const fragment of fragments) {
        yield fragment;
      }
      return;
    }

    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    if (text) {
      yield text;
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() || '';

    for (const frame of frames) {
      const fragments = extractChatHttpStreamTextDeltas(frame);
      if (fragments.length > 0) {
        for (const fragment of fragments) {
          yield fragment;
        }
        continue;
      }

      for (const payloadText of extractFramePayloads(frame)) {
        if (!payloadText || payloadText === '[DONE]') {
          if (payloadText === '[DONE]') {
            return;
          }
          continue;
        }

        if (payloadText.startsWith('event:') || payloadText.startsWith('data:')) {
          continue;
        }

        yield payloadText;
      }
    }

    if (done) {
      break;
    }
  }

  const trailing = buffer.trim();
  if (!trailing) {
    return;
  }

  for (const payloadText of extractFramePayloads(trailing)) {
    if (!payloadText || payloadText === '[DONE]') {
      continue;
    }

    const fragments = extractChatHttpStreamTextDeltas(payloadText);
    if (fragments.length > 0) {
      for (const fragment of fragments) {
        yield fragment;
      }
      continue;
    }

    yield payloadText;
  }
}

export async function* streamOpenAiCompatibleRequest(
  endpoint: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  abortSignal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal: abortSignal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  yield* streamHttpResponse(response);
}