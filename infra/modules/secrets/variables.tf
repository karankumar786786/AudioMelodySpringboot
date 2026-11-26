variable "project_name" {
  type        = string
  description = "Project identifier used in IAM names and tags"
}

variable "secret_prefix" {
  type        = string
  description = "Prefix for every secret name (onemelody/<env>/<name>)"
  default     = "onemelody"
}

variable "secret_environments" {
  type        = list(string)
  description = "Environments that get a set of secret containers"
  default     = ["prod", "staging", "dev"]
}

variable "secret_names" {
  type        = list(string)
  description = "Secret containers per environment. Each holds one JSON object of env-var keys."
  default     = ["db", "redis", "kafka", "core", "mail", "admin", "processing", "streams"]
}

variable "runtime_environment" {
  type        = string
  description = "Which secret environment the EC2 servers in this stack read (prod for production)"
  default     = "prod"
}

variable "server_secret_access" {
  type        = map(list(string))
  description = "Server role => secret names (within runtime_environment) its instance role may read"
  default = {
    # core server: core API (Spring, Kafka client bhi) + mail worker
    core = ["db", "redis", "kafka", "core", "mail"]
    # admin/processing server: admin API (Django) + media pipeline (Bun), aage streams + Redpanda
    processing = ["db", "redis", "admin", "processing", "kafka", "streams"]
  }
}

variable "recovery_window_in_days" {
  type        = number
  description = "Days a deleted secret can still be restored"
  default     = 7
}
