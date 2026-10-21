terraform {
  backend "s3" {
    bucket  = "oneorgmeterraformbackup"
    key     = "alive/terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true
  }
}
