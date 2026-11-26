# 2 Elastic IPs (fixed public IP) dono EC2 servers ('core' aur 'processing') ke liye
resource "aws_eip" "ec2_eip" {
  count    = length(local.ec2_roles)
  domain   = "vpc"
  instance = aws_instance.ec2[count.index].id

  tags = {
    Name        = "${var.project_name}-${var.environment}-${local.ec2_roles[count.index]}-eip"
    Role        = local.ec2_roles[count.index]
    Environment = var.environment
    Project     = var.project_name
  }

  depends_on = [aws_internet_gateway.gw]
}
