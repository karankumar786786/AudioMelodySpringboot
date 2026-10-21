terraform {
  backend "s3" {
    bucket  = "oneorgmeterraformbackup"
    key     = "production/terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true
  }
}
