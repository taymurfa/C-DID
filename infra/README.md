## AWS Infrastructure (Terraform)

This `infra/` folder provisions:
- **VPC** with public/private subnets + NAT
- **RDS Postgres** (private)
- **ECS Fargate** backend service (public task ENI for simplicity)

### Prereqs
- Terraform >= 1.6
- AWS credentials configured (e.g. `aws configure`)

### Apply

Create `terraform.tfvars`:

```hcl
aws_region             = "us-east-1"
project_name           = "okr"
backend_image          = "REPLACE_WITH_YOUR_IMAGE_URI"
db_password            = "REPLACE_WITH_STRONG_PASSWORD"
auth0_domain           = "YOUR_AUTH0_DOMAIN"
auth0_client_id        = "YOUR_AUTH0_CLIENT_ID"
auth0_client_secret    = "YOUR_AUTH0_CLIENT_SECRET"
auth0_audience         = "YOUR_AUTH0_AUDIENCE"
frontend_url           = "https://YOUR_FRONTEND_URL"
backend_url            = "https://YOUR_BACKEND_URL"
integrations_token_key = "REPLACE_WITH_FERNET_KEY"
```

Then:

```bash
terraform init
terraform apply
```

### Run migrations

This repo uses Alembic. Run migrations using a one-off task with the same backend image, e.g.:

```bash
alembic -c backend/alembic.ini upgrade head
```

For production, run this as an ECS one-off task before updating the service.

