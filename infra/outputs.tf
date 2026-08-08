output "rds_address" {
  value       = aws_db_instance.postgres.address
  description = "RDS endpoint address"
}

output "backend_service_name" {
  value       = aws_ecs_service.backend.name
  description = "ECS backend service name"
}

