import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const serverScriptPath = path.join(rootDir, 'scripts', 'run-claw-web-dist-server.mjs');
const distDir = path.join(rootDir, 'packages', 'sdkwork-claw-web', 'dist');

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to resolve a free port')));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      response.on('error', reject);
    }).on('error', reject);
  });
}

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'run-claw-web-dist-server-test-'));
const tempConfigPath = path.join(tempRoot, 'control-ui-config.json');
await fs.writeFile(
  tempConfigPath,
  JSON.stringify(
    {
      ui: {
        assistant: {
          name: 'Claw Studio',
          avatar: 'claw.png',
          agentId: 'claw-studio',
        },
      },
      gateway: {
        auth: {
          token: 'test-token',
        },
        controlUi: {
          serverVersion: '2026.3.28',
        },
      },
    },
    null,
    2,
  ),
);

const port = await findFreePort();
const server = spawn(process.execPath, [serverScriptPath], {
  cwd: rootDir,
  env: {
    ...process.env,
    SDKWORK_WEB_PORT: String(port),
    OPENCLAW_CONTROL_UI_CONFIG_PATH: tempConfigPath,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
server.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8');
});

try {
  await new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timeout = setInterval(async () => {
      try {
        const response = await requestJson(`http://127.0.0.1:${port}/`);
        if (response.statusCode === 200) {
          clearInterval(timeout);
          resolve(undefined);
        } else if (Date.now() - startedAt > 15_000) {
          clearInterval(timeout);
          reject(new Error(`Server did not become ready: ${response.statusCode}\n${stderr}`));
        }
      } catch (error) {
        if (Date.now() - startedAt > 15_000) {
          clearInterval(timeout);
          reject(error);
        }
      }
    }, 100);
  });

  const indexResponse = await requestJson(`http://127.0.0.1:${port}/`);
  assert.equal(indexResponse.statusCode, 200);
  assert.match(
    indexResponse.body,
    /window\.__OPENCLAW_CONTROL_UI_BOOTSTRAP__/,
    'index html must embed a control-ui bootstrap payload for synchronous token hydration',
  );
  assert.match(
    indexResponse.body,
    /test-token/,
    'bootstrap payload must include the runtime gateway auth token',
  );

  const configResponse = await requestJson(
    `http://127.0.0.1:${port}/__openclaw/control-ui-config.json`,
  );

  assert.equal(configResponse.statusCode, 200);
  assert.equal(configResponse.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(configResponse.body), {
    basePath: '',
    assistantName: 'Claw Studio',
    assistantAvatar: 'claw.png',
    assistantAgentId: 'claw-studio',
    gatewayAuthToken: 'test-token',
    serverVersion: '2026.3.28',
  });

  const prefixedResponse = await requestJson(
    `http://127.0.0.1:${port}/__openclaw__/a2ui/__openclaw/control-ui-config.json`,
  );

  assert.equal(prefixedResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(prefixedResponse.body), {
    basePath: '/__openclaw__/a2ui',
    assistantName: 'Claw Studio',
    assistantAvatar: 'claw.png',
    assistantAgentId: 'claw-studio',
    gatewayAuthToken: 'test-token',
    serverVersion: '2026.3.28',
  });

  const cargoTargetDir = path.join(tempRoot, 'tauri-target', 'dev');
  const cargoTargetConfigPath = path.join(
    cargoTargetDir,
    'debug',
    'user',
    'openclaw-home',
    '.openclaw',
    'openclaw.json',
  );
  await fs.mkdir(path.dirname(cargoTargetConfigPath), { recursive: true });
  await fs.writeFile(
    cargoTargetConfigPath,
    JSON.stringify(
      {
        gateway: {
          auth: {
            token: 'cargo-target-token',
          },
        },
      },
      null,
      2,
    ),
  );

  const cargoPort = await findFreePort();
  const cargoEnv = { ...process.env };
  delete cargoEnv.OPENCLAW_CONTROL_UI_CONFIG_PATH;
  delete cargoEnv.OPENCLAW_CONFIG_PATH;
  cargoEnv.CARGO_TARGET_DIR = cargoTargetDir;
  cargoEnv.SDKWORK_WEB_PORT = String(cargoPort);

  const cargoServer = spawn(process.execPath, [serverScriptPath], {
    cwd: rootDir,
    env: cargoEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let cargoStderr = '';
  cargoServer.stderr.on('data', (chunk) => {
    cargoStderr += chunk.toString('utf8');
  });

  try {
    await new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timeout = setInterval(async () => {
        try {
          const response = await requestJson(`http://127.0.0.1:${cargoPort}/`);
          if (response.statusCode === 200) {
            clearInterval(timeout);
            resolve(undefined);
          } else if (Date.now() - startedAt > 15_000) {
            clearInterval(timeout);
            reject(new Error(`Cargo-target server did not become ready: ${response.statusCode}\n${cargoStderr}`));
          }
        } catch (error) {
          if (Date.now() - startedAt > 15_000) {
            clearInterval(timeout);
            reject(error);
          }
        }
      }, 100);
    });

    const cargoConfigResponse = await requestJson(
      `http://127.0.0.1:${cargoPort}/__openclaw/control-ui-config.json`,
    );

    assert.equal(cargoConfigResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(cargoConfigResponse.body), {
      basePath: '',
      assistantName: null,
      assistantAvatar: null,
      assistantAgentId: null,
      gatewayAuthToken: 'cargo-target-token',
      serverVersion: null,
    });
  } finally {
    cargoServer.kill('SIGTERM');
  }
} finally {
  server.kill('SIGTERM');
}
