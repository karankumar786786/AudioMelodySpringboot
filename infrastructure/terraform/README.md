# Terraform Configuration

This directory is reserved for Terraform IaC configuration.

## Planned structure

```
terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── modules/
│   ├── ec2/
│   ├── rds/
│   ├── s3/
│   └── redis/
└── environments/
    ├── dev.tfvars
    └── prod.tfvars
```

> **Status:** Not yet populated. Infrastructure is currently managed manually via AWS Console and EC2 SSH.
