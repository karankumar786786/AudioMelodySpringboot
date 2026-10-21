# AudioMelody Infrastructure (Terraform)

Multi-environment AWS infrastructure for the AudioMelody platform in region **`ap-south-1`** (Mumbai).

---

## 📁 Repository Layout

```
infra/
├── environments/
│   ├── alive/          # "alive" environment: Provisions only the 2 S3 buckets (temp & prod)
│   │   ├── backend.tf
│   │   ├── main.tf
│   │   ├── outputs.tf
│   │   ├── provider.tf
│   │   ├── terraform.tfvars
│   │   ├── terraform.tfvars.example
│   │   ├── variables.tf
│   │   └── version.tf
│   └── production/     # "production" environment: Provisions VPC, EC2s (core & processing), EIPs, Security Group, and S3
│       ├── backend.tf
│       ├── main.tf
│       ├── outputs.tf
│       ├── provider.tf
│       ├── terraform.tfvars
│       ├── terraform.tfvars.example
│       ├── variables.tf
│       └── version.tf
└── modules/
    ├── s3/             # Reusable S3 module (temp with auto-expiry, prod with versioning)
    └── compute/        # Reusable VPC, Subnets, Security Group, Key Pair, EC2, Elastic IPs
```

---

## 🚀 Environments

### 1. `alive` Environment
Provisions **only the 2 S3 buckets** (`temp` and `prod`).
- **Remote State**: `s3://oneorgmeterraformbackup/alive/terraform.tfstate`
- **Commands**:
  ```bash
  cd infra/environments/alive
  terraform init
  terraform plan
  terraform apply
  ```

### 2. `production` Environment
Provisions the entire production stack:
- **Networking**: VPC (`10.0.0.0/16`), Internet Gateway, 2 multi-AZ public subnets (`ap-south-1a`, `ap-south-1b`), route tables.
- **Security**: Security group opening SSH (22), HTTP (80), HTTPS (443), and Spring Boot app (8080).
- **Key Pair**: 1 shared key pair (`audiomelody-ec2-key.pem` & `.pub`).
- **Compute**: 2 EC2 instances launched with comma-separated types (`core` and `processing`).
- **Elastic IPs**: 2 EIPs attached to `core` and `processing`.
- **Storage**: The 2 S3 buckets (`temp` and `prod`).
- **Remote State**: `s3://oneorgmeterraformbackup/production/terraform.tfstate`
- **Commands**:
  ```bash
  cd infra/environments/production
  terraform init
  terraform plan
  terraform apply
  ```
