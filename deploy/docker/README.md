# Claw Studio Container Deployment Templates

Use the root bundle directory as the Docker build context.

Base deployment:

```bash
docker compose -f deploy/docker-compose.yml up -d
```

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.amd-rocm.yml up -d
```

The server binary is identical across CPU and GPU-oriented bundles. GPU variants package
deployment overlays and environment presets so operators can keep one release flow while
switching runtime topology.
