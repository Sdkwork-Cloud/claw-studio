import path from 'node:path';

const WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^(?:\\\\|\/\/)[^\\/]+[\\/][^\\/]+/;

export function isWindowsDriveAbsolutePath(value = '') {
  return WINDOWS_DRIVE_ABSOLUTE_PATH_PATTERN.test(String(value ?? '').trim());
}

export function isWindowsUncPath(value = '') {
  return WINDOWS_UNC_PATH_PATTERN.test(String(value ?? '').trim());
}

export function isExplicitAbsolutePath(value = '') {
  const normalizedValue = String(value ?? '').trim();
  return path.isAbsolute(normalizedValue)
    || isWindowsDriveAbsolutePath(normalizedValue)
    || isWindowsUncPath(normalizedValue);
}

export function resolveCliPath(value = '', cwd = process.cwd()) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue) {
    return '';
  }

  return isExplicitAbsolutePath(normalizedValue)
    ? normalizedValue
    : path.resolve(cwd, normalizedValue);
}
