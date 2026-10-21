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
    Public      = var.is_public ? "true" : "false"
  }
}

resource "aws_s3_bucket_ownership_controls" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "temp" {
  bucket = aws_s3_bucket.temp.id

  block_public_acls       = var.is_public ? false : true
  block_public_policy     = var.is_public ? false : true
  ignore_public_acls      = var.is_public ? false : true
  restrict_public_buckets = var.is_public ? false : true
}

resource "aws_s3_bucket_policy" "temp_public" {
  count  = var.is_public ? 1 : 0
  bucket = aws_s3_bucket.temp.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.temp.arn}/*"
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.temp,
    aws_s3_bucket_ownership_controls.temp
  ]
}

resource "aws_s3_bucket_cors_configuration" "temp" {
  count  = var.is_public ? 1 : 0
  bucket = aws_s3_bucket.temp.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
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
    Public      = var.is_public ? "true" : "false"
  }
}

resource "aws_s3_bucket_ownership_controls" "prod" {
  bucket = aws_s3_bucket.prod.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "prod" {
  bucket = aws_s3_bucket.prod.id

  block_public_acls       = var.is_public ? false : true
  block_public_policy     = var.is_public ? false : true
  ignore_public_acls      = var.is_public ? false : true
  restrict_public_buckets = var.is_public ? false : true
}

resource "aws_s3_bucket_policy" "prod_public" {
  count  = var.is_public ? 1 : 0
  bucket = aws_s3_bucket.prod.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.prod.arn}/*"
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.prod,
    aws_s3_bucket_ownership_controls.prod
  ]
}

resource "aws_s3_bucket_cors_configuration" "prod" {
  count  = var.is_public ? 1 : 0
  bucket = aws_s3_bucket.prod.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
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
