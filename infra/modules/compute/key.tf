locals {
  has_local_pub_key = fileexists("${path.root}/${var.key_name}.pub")
  local_pub_key     = local.has_local_pub_key ? file("${path.root}/${var.key_name}.pub") : ""
}

# Generate private key if neither public_key variable nor local public key file exists
resource "tls_private_key" "ssh" {
  count     = var.public_key == "" && !local.has_local_pub_key ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

# AWS Key Pair - shared for both EC2 instances
resource "aws_key_pair" "main" {
  key_name = var.key_name
  public_key = var.public_key != "" ? var.public_key : (
    local.has_local_pub_key ? local.local_pub_key : tls_private_key.ssh[0].public_key_openssh
  )

  tags = {
    Name        = var.key_name
    Environment = var.environment
    Project     = var.project_name
  }
}

# Save generated private key to local .pem file with restricted permissions (0400)
resource "local_file" "private_key" {
  count           = var.public_key == "" && !local.has_local_pub_key ? 1 : 0
  content         = tls_private_key.ssh[0].private_key_pem
  filename        = "${path.root}/${var.key_name}.pem"
  file_permission = "0400"
}

# Save generated public key to local .pub file (0644)
resource "local_file" "public_key" {
  count           = var.public_key == "" && !local.has_local_pub_key ? 1 : 0
  content         = tls_private_key.ssh[0].public_key_openssh
  filename        = "${path.root}/${var.key_name}.pub"
  file_permission = "0644"
}
