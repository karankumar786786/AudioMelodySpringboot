module "s3" {
  source = "../../modules/s3"

  project_name                = var.project_name
  environment                 = var.environment
  temp_bucket_name            = var.temp_bucket_name
  prod_bucket_name            = var.prod_bucket_name
  temp_bucket_expiration_days = var.temp_bucket_expiration_days
  is_public                   = var.is_public
}
