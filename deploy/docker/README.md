# Claw Studio Container Deployment Templates

This directory is the source tree template location. In the source repository, review and diff:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

Those source tree paths are packaging inputs, not the final runnable release layout. Render the
packaged bundle layout locally with `pnpm release:package:container`, then switch to the extracted
bundle root for real deployment commands.

Inside the extracted bundle root, the same templates are materialized as:

- `deploy/docker-compose.yml`
- `deploy/docker-compose.nvidia-cuda.yml`
- `deploy/docker-compose.amd-rocm.yml`
- `deploy/Dockerfile`
- `deploy/profiles/*`

The packaged `deploy/docker-compose*.yml` files resolve env overlays relative to `deploy/` and use
the extracted bundle root as the Docker build context for `app/`.

Local packaging prerequisite:

- `pnpm release:package:container` expects a matching Linux server binary to already exist. Build it first with `pnpm server:build -- --target <linux-target>` or use the Linux release workflow runner.

Base deployment from the extracted bundle root:

```bash
export CLAW_SERVER_MANAGE_USERNAME=claw-admin
export CLAW_SERVER_MANAGE_PASSWORD='replace-with-a-strong-secret'
docker compose -f deploy/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay from the extracted bundle root:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.amd-rocm.yml up -d
```

The server binary is identical across CPU and GPU-oriented bundles. GPU variants package
deployment overlays and environment presets so operators can keep one release flow while
switching runtime topology.

The base deployment template intentionally requires `CLAW_SERVER_MANAGE_USERNAME` and
`CLAW_SERVER_MANAGE_PASSWORD` before Docker Compose will start the public control plane.
If you do not provide dedicated internal credentials, the Rust server falls back to the
manage credential pair for `/claw/internal/v1/*`.

The bundled env overlays keep `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false` and mount
`/var/lib/claw-server` for persistent state, so container restarts do not silently drop the
SQLite host-state database.
