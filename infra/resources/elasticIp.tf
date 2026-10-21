# 2 Elastic IPs attached to the 2 EC2 instances ('core' and 'processing')
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
