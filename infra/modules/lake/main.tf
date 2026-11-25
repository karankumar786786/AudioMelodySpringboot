########################################
# S3 data lake: raw listening events as Parquet (written by Redpanda Connect on the
# processing server), plus archived user_history. Private, encrypted, kept forever;
# objects move to Glacier Instant Retrieval after a year.
########################################

resource "aws_s3_bucket" "lake" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Type        = "data-lake"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_public_access_block" "lake" {
  bucket                  = aws_s3_bucket.lake.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "lake" {
  bucket = aws_s3_bucket.lake.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lake" {
  bucket = aws_s3_bucket.lake.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "lake" {
  bucket = aws_s3_bucket.lake.id

  rule {
    id     = "glacier-after-a-year"
    status = "Enabled"
    filter {
      prefix = "lake/"
    }
    transition {
      days          = var.glacier_after_days
      storage_class = "GLACIER_IR"
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"
    filter {}
    abort_incomplete_multipart_upload {
      days_after_initiation = 2
    }
  }
}

# Read and write for the roles that need it (the processing server: Redpanda Connect
# writes events, the admin API reads them with DuckDB and archives history).
data "aws_iam_policy_document" "lake_access" {
  statement {
    sid       = "ListLake"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.lake.arn]
  }
  statement {
    sid       = "ReadWriteLake"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:AbortMultipartUpload"]
    resources = ["${aws_s3_bucket.lake.arn}/*"]
  }
}

resource "aws_iam_role_policy" "lake_access" {
  for_each = toset(var.reader_writer_role_names)

  name   = "onemelody-data-lake"
  role   = each.value
  policy = data.aws_iam_policy_document.lake_access.json
}
