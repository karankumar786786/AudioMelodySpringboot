# ------------------------------------------------------------------------------
# Event pipeline: Redpanda processing server (index 1) pe chalta hai.
# Sirf is security group ke members (dono servers) Kafka (9092) aur Schema Registry (8081) tak pahunch sakte
# hain, VPC ke private network se. Internet se kabhi nahi.

resource "aws_security_group_rule" "kafka_from_self" {
  type              = "ingress"
  description       = "Kafka (Redpanda) from instances in this security group"
  security_group_id = aws_security_group.ec2_sg.id
  from_port         = 9092
  to_port           = 9092
  protocol          = "tcp"
  self              = true
}

resource "aws_security_group_rule" "schema_registry_from_self" {
  type              = "ingress"
  description       = "Schema Registry from instances in this security group"
  security_group_id = aws_security_group.ec2_sg.id
  from_port         = 8081
  to_port           = 8081
  protocol          = "tcp"
  self              = true
}

# Redpanda ka data aur Kafka Streams ki state alag disk (volume) pe: root disk chhoti hai aur
# transcoding ki temp files bhi wahin hoti hain.
resource "aws_ebs_volume" "kafka" {
  availability_zone = aws_instance.ec2[1].availability_zone
  size              = var.kafka_volume_size
  type              = "gp3"
  encrypted         = true

  tags = {
    Name        = "${var.project_name}-${var.environment}-kafka"
    Role        = "kafka"
    Environment = var.environment
  }
}

resource "aws_volume_attachment" "kafka" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.kafka.id
  instance_id = aws_instance.ec2[1].id
}
