# Terraform Configuration for PyTogether Backend

This terraform configuration deploys the PyTogether backend to a Hetzner Cloud server.

## Prerequisites

1. Hetzner Cloud API token
2. SSH public key at `~/.ssh/id_rsa.pub` (or specify a different path)

## Setup

1. Create a `terraform.tfvars` file:

```hcl
hcloud_token = "your-hetzner-api-token"
# Optional: restrict SSH access to your IP
# my_ip_address = "your.ip.address.here"
```

2. Initialize terraform:

```bash
terraform init
```

3. Review the plan:

```bash
terraform plan
```

4. Apply the configuration:

```bash
terraform apply
```

## After Deployment

1. SSH into the server:

```bash
ssh devops@<server-ip>
```

2. Clone the repository and set up the application:

```bash
cd /home/devops/apps
git clone <repository-url> pytogether
cd pytogether
```

3. Create a `.env` file in the `backend` directory with your configuration.

4. Run podman-compose with uvx:

```bash
cd /home/devops/apps/pytogether
uvx podman-compose up -d --build
```

## Deployment Options

### Option 1: Build on Server (Simplest)

This is the simplest approach - the image is built directly on the server when you run podman-compose.

**Initial Setup:**
```bash
# On your local machine, from the terraform directory
./deploy.sh
```

This script will:
- Connect to the server
- Pull the latest code
- Build and start containers using podman-compose

**Manual Deployment:**
```bash
# SSH to server
ssh devops@<server-ip>

# Navigate to project
cd /home/devops/apps/pytogether

# Pull latest code
git pull

# Rebuild and restart
uvx podman-compose up -d --build
```

### Option 2: Use Container Registry (Recommended for Production)

This approach builds the image locally, pushes to a registry (Docker Hub, GHCR, etc.), and pulls it on the server.

**Setup:**
1. Set environment variables:
```bash
export REGISTRY="docker.io"  # or "ghcr.io" for GitHub Container Registry
export IMAGE_NAME="yourusername/pytogether-backend"  # or "ghcr.io/username/pytogether-backend"
export IMAGE_TAG="latest"  # or use version tags like "v1.0.0"
```

2. Login to registry (if needed):
```bash
podman login docker.io  # or ghcr.io
```

3. Deploy:
```bash
./deploy-with-registry.sh
```

**Using GitHub Container Registry (GHCR):**
```bash
export REGISTRY="ghcr.io"
export IMAGE_NAME="yourusername/pytogether-backend"
podman login ghcr.io -u yourusername -p $GITHUB_TOKEN
./deploy-with-registry.sh
```

**Note:** If using a registry, you may want to update `docker-compose.yaml` to remove the `build` section and only use the `image` field, or create a separate `docker-compose.prod.yaml` file.

## Outputs

After applying, terraform will output:
- `service_ip`: The IPv4 address of the server
- `server_name`: The name of the server
- `ssh_command`: Command to SSH into the server

