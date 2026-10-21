########################################
# S3 Bucket - Temporary Storage
########################################

resource "aws_s3_bucket" "temp" {
  bucket = var.temp_bucket_name

  tags = {
    Name        = var.temp_bucket_name
    Type        = "temporary"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_ownership_controls" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "temp" {
  bucket = aws_s3_bucket.temp.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    id     = "auto-expire-temporary-files"
    status = "Enabled"

    filter {}

    expiration {
      days = var.temp_bucket_expiration_days
    }
  }
}

########################################
# S3 Bucket - Production Storage
########################################

resource "aws_s3_bucket" "prod" {
  bucket = var.prod_bucket_name

  tags = {
    Name        = var.prod_bucket_name
    Type        = "production"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_ownership_controls" "prod" {
  bucket = aws_s3_bucket.prod.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_public_access_block" "prod" {
  bucket = aws_s3_bucket.prod.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "prod" {
  bucket = aws_s3_bucket.prod.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "prod" {
  bucket = aws_s3_bucket.prod.id

  versioning_configuration {
    status = "Enabled"
  }
}
