resource "aws_security_group" "ec2_sg" {
  name        = "${var.project_name}-${var.environment}-ec2-sg"
  description = "Security group for AudioMelody EC2 instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidr_blocks
  }

  ingress {
    description = "HTTP access"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_http_cidr_blocks
  }

  ingress {
    description = "HTTPS access"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_http_cidr_blocks
  }

  ingress {
    description = "Application port (Spring Boot)"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = var.allowed_app_cidr_blocks
  }

  egress {
    description      = "Allow all outbound traffic"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-ec2-sg"
    Environment = var.environment
    Project     = var.project_name
  }
}
