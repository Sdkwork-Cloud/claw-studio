# Claw Studio Kubernetes Deployment Templates

Use the extracted bundle root as the working directory.

Base deployment:

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml
```

NVIDIA CUDA overlay:

```bash
helm upgrade --install claw-studio ./chart -f chart/values-nvidia-cuda.yaml -f values.release.yaml
```

AMD ROCm overlay:

```bash
helm upgrade --install claw-studio ./chart -f chart/values-amd-rocm.yaml -f values.release.yaml
```

The chart already carries its default `chart/values.yaml`. The generated `values.release.yaml`
adds the packaged target architecture and accelerator profile for the selected release bundle.
