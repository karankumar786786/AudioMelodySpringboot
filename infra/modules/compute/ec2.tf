# Fetch latest official Ubuntu 24.04 LTS AMI if ami_id is not specified
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

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

# 2 EC2 instances: 'core' and 'processing' in order
resource "aws_instance" "ec2" {
  count                  = length(local.ec2_roles)
  ami                    = local.selected_ami_id
  instance_type          = element(local.parsed_instance_types, count.index)
  key_name               = aws_key_pair.main.key_name
  vpc_security_group_ids = [aws_security_group.ec2_sg.id]

  # Distribute across available public subnets (ap-south-1a and ap-south-1b)
  subnet_id = count.index == 0 ? aws_subnet.public_1.id : aws_subnet.public_2.id

  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = var.root_volume_type
    delete_on_termination = true
    encrypted             = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-${local.ec2_roles[count.index]}"
    Role        = local.ec2_roles[count.index]
    Environment = var.environment
    Project     = var.project_name
  }
}
