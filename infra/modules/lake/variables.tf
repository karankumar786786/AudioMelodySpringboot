variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "bucket_name" {
  description = "Globally unique name of the data lake bucket"
  type        = string
}

variable "glacier_after_days" {
  description = "Days before lake objects move to Glacier Instant Retrieval"
  type        = number
  default     = 365
}

variable "reader_writer_role_names" {
  description = "IAM role names allowed to read and write the lake"
  type        = list(string)
  default     = []
}
