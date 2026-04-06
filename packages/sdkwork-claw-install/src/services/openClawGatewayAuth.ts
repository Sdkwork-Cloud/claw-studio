type JsonValue = string | number | boolean | null | JsonRecord | JsonValue[];

interface JsonRecord {
  [key: string]: JsonValue | undefined;
}

function readObject(value: JsonValue | undefined) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
}

function readString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export function resolveSyncedOpenClawAuthToken(input: {
  root: Record<string, unknown>;
  existingAuthToken?: string | null;
}) {
  const gateway = readObject(input.root.gateway as JsonValue);
  const auth = readObject(gateway?.auth);
  const configuredToken = readString(auth?.token);

  if (configuredToken) {
    return configuredToken;
  }

  const existingAuthToken = (input.existingAuthToken || '').trim();
  return existingAuthToken || null;
}
