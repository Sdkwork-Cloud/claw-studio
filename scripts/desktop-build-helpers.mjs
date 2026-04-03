import path from 'node:path';

export function buildNonInteractiveInstallEnv(baseEnv = process.env) {
  return {
    ...baseEnv,
    CI: 'true',
    npm_config_yes: 'true',
  };
}

export function withSupportedWindowsCmakeGenerator(
  baseEnv = process.env,
  platform = process.platform,
) {
  const env = { ...baseEnv };
  if (platform !== 'win32') {
    return env;
  }

  const requestedGenerator = String(env.CMAKE_GENERATOR ?? '').trim();
  if (requestedGenerator.length > 0 && !requestedGenerator.includes('2026')) {
    return env;
  }

  env.CMAKE_GENERATOR = 'Visual Studio 17 2022';
  env.HOST_CMAKE_GENERATOR = 'Visual Studio 17 2022';
  return env;
}

export function shouldUseWindowsCommandShell(
  command,
  platform = process.platform,
) {
  if (platform !== 'win32') {
    return false;
  }

  const extension = path.extname(String(command ?? '')).toLowerCase();
  return extension === '.cmd' || extension === '.bat';
}
