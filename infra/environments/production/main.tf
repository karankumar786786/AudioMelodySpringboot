module "s3" {
  source = "../../modules/s3"

  project_name                = var.project_name
  environment                 = var.environment
  temp_bucket_name            = var.temp_bucket_name
  prod_bucket_name            = var.prod_bucket_name
  temp_bucket_expiration_days = var.temp_bucket_expiration_days
}

module "compute" {
  source = "../../modules/compute"

  aws_region               = var.aws_region
  project_name             = var.project_name
  environment              = var.environment
  vpc_cidr                 = var.vpc_cidr
  public_subnet_1_cidr     = var.public_subnet_1_cidr
  public_subnet_2_cidr     = var.public_subnet_2_cidr
  instance_count           = var.instance_count
  instance_type            = var.instance_type
  ami_id                   = var.ami_id
  root_volume_size         = var.root_volume_size
  root_volume_type         = var.root_volume_type
  key_name                 = var.key_name
  public_key               = var.public_key
  allowed_ssh_cidr_blocks  = var.allowed_ssh_cidr_blocks
  allowed_http_cidr_blocks = var.allowed_http_cidr_blocks
  app_port                 = var.app_port
  allowed_app_cidr_blocks  = var.allowed_app_cidr_blocks
}
