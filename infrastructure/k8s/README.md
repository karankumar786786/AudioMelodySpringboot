# Kubernetes Manifests

This directory is reserved for Kubernetes deployment manifests.

## Planned structure

```
k8s/
├── base/
│   ├── core-deployment.yaml
│   ├── core-service.yaml
│   ├── audioprocessing-deployment.yaml
│   ├── mail-deployment.yaml
│   ├── frontend-deployment.yaml
│   └── adminfrontend-deployment.yaml
├── overlays/
│   ├── dev/
│   └── prod/
└── kustomization.yaml
```

> **Status:** Not yet populated. Use the `Docker/docker-compose.yml` for local/EC2 deployments.
