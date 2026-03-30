import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist');
const host = process.env.SDKWORK_WEB_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.SDKWORK_WEB_PORT ?? process.env.PORT ?? '1420', 10);
const indexPath = path.join(distDir, 'index.html');
const devControlUiConfigPath = process.env.CARGO_TARGET_DIR
  ? path.join(
      process.env.CARGO_TARGET_DIR,
      'debug',
      'user',
      'openclaw-home',
      '.openclaw',
      'openclaw.json',
    )
  : null;
const controlUiConfigPath =
  process.env.OPENCLAW_CONTROL_UI_CONFIG_PATH ??
  devControlUiConfigPath ??
  process.env.OPENCLAW_CONFIG_PATH ??
  path.join(os.homedir(), '.sdkwork', 'crawstudio', 'openclaw-home', '.openclaw', 'openclaw.json');
const DEBUG_PREFIX = '[claw-web-dist-server]';

function logServer(level, message, details) {
  const prefix = `${DEBUG_PREFIX} ${new Date().toISOString()} ${level.toUpperCase()} ${message}`;
  const logger =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (typeof details === 'undefined') {
    logger(prefix);
    return;
  }

  logger(prefix, details);
}

if (!fs.existsSync(indexPath)) {
  console.error(`Missing web dist output at ${indexPath}. Run the web build first.`);
  process.exit(1);
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.posix
    .normalize(decodedPath)
    .replace(/^\/+/, '')
    .replace(/^([.]{2}\/)+/, '');
  return normalizedPath.length === 0 ? 'index.html' : normalizedPath;
}

function contentTypeFor(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return mimeTypes.get(extension) ?? 'application/octet-stream';
}

function loadControlUiConfig() {
  if (!controlUiConfigPath || !fs.existsSync(controlUiConfigPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(controlUiConfigPath, 'utf8'));
  } catch (error) {
    logServer('error', 'failed to parse OpenClaw control-ui config', {
      controlUiConfigPath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function buildControlUiBootstrapScript() {
  const config = loadControlUiConfig();
  const gatewayAuthToken = config?.gatewayAuthToken ?? config?.gateway?.auth?.token ?? null;
  if (typeof gatewayAuthToken !== 'string' || !gatewayAuthToken.trim()) {
    return '';
  }

  return `<script>window.__OPENCLAW_CONTROL_UI_BOOTSTRAP__=${JSON.stringify({
    gatewayAuthToken: gatewayAuthToken.trim(),
  })};</script>`;
}

function serveFile(response, filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  response.statusCode = 200;
  response.setHeader('Content-Type', contentTypeFor(filePath));
  response.setHeader('Cache-Control', 'no-store');
  response.end(fileBuffer);
}

function serveControlUiConfig(response) {
  const config = loadControlUiConfig();
  if (!config) {
    logServer('warn', 'control-ui config request returned 404', {
      requestUrl: response.req?.url ?? '',
      controlUiConfigPath,
    });
    response.statusCode = 404;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(JSON.stringify({ error: 'OpenClaw control-ui config not found' }));
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');

  if (response.req?.method === 'HEAD') {
    response.end();
    return;
  }

  logServer('info', 'served control-ui config', {
    requestUrl: response.req?.url ?? '',
    controlUiConfigPath,
    hasGatewayAuthToken:
      typeof (config?.gatewayAuthToken ?? config?.gateway?.auth?.token) === 'string' &&
      (config?.gatewayAuthToken ?? config?.gateway?.auth?.token).trim().length > 0,
  });

  response.end(
    JSON.stringify({
      basePath: getControlUiBasePath(response.req?.url ?? ''),
      assistantName: config?.assistantName ?? config?.ui?.assistant?.name ?? null,
      assistantAvatar: config?.assistantAvatar ?? config?.ui?.assistant?.avatar ?? null,
      assistantAgentId: config?.assistantAgentId ?? config?.ui?.assistant?.agentId ?? null,
      gatewayAuthToken: config?.gatewayAuthToken ?? config?.gateway?.auth?.token ?? null,
      serverVersion: config?.serverVersion ?? config?.gateway?.controlUi?.serverVersion ?? null,
    }),
  );
}

function serveIndex(response) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const bootstrapScript = buildControlUiBootstrapScript();
  const nextHtml =
    bootstrapScript && html.includes('</head>')
      ? html.replace('</head>', `${bootstrapScript}</head>`)
      : bootstrapScript
        ? `${bootstrapScript}${html}`
        : html;

  response.statusCode = 200;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(nextHtml);
}

function getControlUiBasePath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const normalizedPath = path.posix
    .normalize(decodedPath)
    .replace(/^\/+/, '')
    .replace(/^([.]{2}\/)+/, '');
  const suffix = '__openclaw/control-ui-config.json';

  if (normalizedPath === suffix) {
    return '';
  }

  if (normalizedPath.endsWith(`/${suffix}`)) {
    return `/${normalizedPath.slice(0, -suffix.length - 1)}`;
  }

  return '';
}

const server = http.createServer((request, response) => {
  const method = request.method ?? 'GET';
  logServer('info', 'incoming request', {
    method,
    url: request.url ?? '/',
  });
  if (method !== 'GET' && method !== 'HEAD') {
    response.statusCode = 405;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Method Not Allowed');
    return;
  }

  const requestPath = resolveRequestPath(request.url ?? '/');

  if (
    requestPath === '__openclaw/control-ui-config.json' ||
    requestPath.endsWith('/__openclaw/control-ui-config.json')
  ) {
    serveControlUiConfig(response);
    return;
  }

  const filePath = path.join(distDir, requestPath);

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      if (requestPath === 'index.html') {
        serveIndex(response);
        return;
      }
      serveFile(response, filePath);
      return;
    }
  } catch {
    // Fall through to SPA index fallback.
  }

  serveIndex(response);
});

server.on('error', (error) => {
  logServer('error', 'server error', {
    error: error instanceof Error ? error.message : String(error),
  });
});

server.on('close', () => {
  logServer('warn', 'server closed');
});

let controlUiConfig = null;
try {
  controlUiConfig = loadControlUiConfig();
} catch {
  controlUiConfig = null;
}

server.listen(port, host, () => {
  logServer('info', 'starting static web dist server', {
    pid: process.pid,
    distDir,
    indexPath,
    host,
    port,
    controlUiConfigPath,
    hasControlUiConfig: Boolean(controlUiConfig),
    hasGatewayAuthToken:
      typeof (controlUiConfig?.gatewayAuthToken ?? controlUiConfig?.gateway?.auth?.token) ===
        'string' &&
      (controlUiConfig?.gatewayAuthToken ?? controlUiConfig?.gateway?.auth?.token).trim().length >
        0,
  });
  console.log(`Serving static Claw web dist from ${distDir} at http://${host}:${port}`);
});

process.on('SIGINT', () => {
  logServer('warn', 'received SIGINT');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logServer('warn', 'received SIGTERM');
  server.close(() => process.exit(0));
});

process.on('uncaughtException', (error) => {
  logServer('error', 'uncaught exception', {
    error: error instanceof Error ? error.message : String(error),
  });
});

process.on('unhandledRejection', (reason) => {
  logServer('error', 'unhandled rejection', { reason });
});

process.on('exit', (code) => {
  logServer('warn', 'process exiting', { code });
});
