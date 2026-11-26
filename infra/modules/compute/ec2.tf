# ami_id na diya ho to Ubuntu 24.04 LTS ki sabse nayi official AMI (server image) lo
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu banane wali company) ka account

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

locals {
  selected_ami_id       = var.ami_id != "" ? var.ami_id : data.aws_ami.ubuntu.id
  parsed_instance_types = [for it in split(",", var.instance_type) : trimspace(it)]
  ec2_roles             = ["core", "processing"]
}

# 2 EC2 servers, is order me: 'core' aur 'processing'
resource "aws_instance" "ec2" {
  count                  = length(local.ec2_roles)
  ami                    = local.selected_ami_id
  instance_type          = element(local.parsed_instance_types, count.index)
  key_name               = aws_key_pair.main.key_name
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]
  iam_instance_profile   = lookup(var.iam_instance_profiles, local.ec2_roles[count.index], null)

  # Public subnets me baant do (ap-south-1a aur ap-south-1b)
  subnet_id = count.index == 0 ? aws_subnet.public_1.id : aws_subnet.public_2.id

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = var.root_volume_type
    delete_on_termination = true
    encrypted             = true
  }

  # Sirf IMDSv2: instance role ke credentials metadata endpoint se milte hain, isliye purana v1 (bina token)
  # raasta band. Hop limit 2 = Docker containers bhi wahan tak pahunch sakein.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  # AMI hamesha sabse nayi Ubuntu image dhoondhta hai; ye na ho to har nayi Ubuntu release pe Terraform
  # chalte hue servers dobara bana dega.
  lifecycle {
    ignore_changes = [ami]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-${local.ec2_roles[count.index]}"
    Role        = local.ec2_roles[count.index]
    Environment = var.environment
    Project     = var.project_name
  }
}
