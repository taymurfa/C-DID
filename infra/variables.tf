variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "project_name" {
  type        = string
  description = "Name prefix for resources"
  default     = "okr"
}

variable "backend_image" {
  type        = string
  description = "Container image URI for backend (e.g. ECR repo URL:tag)"
}

variable "db_name" {
  type        = string
  description = "Postgres database name"
  default     = "okr"
}

variable "db_username" {
  type        = string
  description = "Postgres master username"
  default     = "postgres"
}

variable "db_password" {
  type        = string
  description = "Postgres master password"
  sensitive   = true
}

variable "auth0_domain" {
  type        = string
  description = "Auth0 domain"
  default     = ""
}

variable "auth0_client_id" {
  type        = string
  description = "Auth0 client id"
  default     = ""
}

variable "auth0_client_secret" {
  type        = string
  description = "Auth0 client secret"
  sensitive   = true
  default     = ""
}

variable "auth0_audience" {
  type        = string
  description = "Auth0 audience"
  default     = ""
}

variable "frontend_url" {
  type        = string
  description = "Public frontend URL (used in share links and OAuth redirects)"
  default     = "http://localhost:3000"
}

variable "backend_url" {
  type        = string
  description = "Public backend base URL (for Auth0 callback in this template)"
  default     = "http://localhost:5001"
}

variable "integrations_token_key" {
  type        = string
  description = "Fernet key for encrypting refresh tokens (base64-urlsafe)"
  sensitive   = true
}

