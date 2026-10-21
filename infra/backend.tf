terraform {
  backend "s3" {
    bucket  = "oneorgmeterraformbackup"
    key     = "audio-melody/terraform.tfstate"
    region  = "ap-south-1"
    encrypt = true
  }
}
