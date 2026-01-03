#!/bin/bash
# Deployment script using container registry (Docker Hub, GHCR, etc.)
# This script builds the image, pushes to registry, and deploys to server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get git repository URL
get_repo_url() {
    local repo_url="${GIT_REPO_URL:-}"
    
    if [ -z "$repo_url" ]; then
        # Try to get from local git remote
        cd "$PROJECT_ROOT"
        if [ -d .git ]; then
            repo_url=$(git remote get-url origin 2>/dev/null || echo "")
        fi
    fi
    
    if [ -z "$repo_url" ]; then
        print_error "Could not determine repository URL. Set GIT_REPO_URL environment variable or ensure you're in a git repository."
        exit 1
    fi
    
    echo "$repo_url"
}

# Configuration
REGISTRY="${REGISTRY:-docker.io}"
IMAGE_NAME="${IMAGE_NAME:-pytogether-backend}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"

# Build and push image
build_and_push() {
    print_info "Building Docker image: $FULL_IMAGE"
    
    cd "$PROJECT_ROOT/backend"
    
    # Build image
    podman build -t "$FULL_IMAGE" -f Dockerfile .
    
    # Push to registry
    print_info "Pushing image to registry..."
    podman push "$FULL_IMAGE"
    
    print_info "Image pushed successfully: $FULL_IMAGE"
}

# Deploy to server
deploy_to_server() {
    local server_ip="$1"
    local repo_url="$2"
    local ssh_key="${SSH_KEY_FILE:-~/.ssh/id_rsa}"
    
    print_info "Deploying to server at $server_ip"
    print_info "Repository: $repo_url"
    
    # Create deployment script
    local deploy_script=$(cat <<DEPLOY_SCRIPT
#!/bin/bash
set -e

REPO_URL="$repo_url"
APP_DIR="/home/devops/apps"
PROJECT_DIR="\$APP_DIR/pytogether"

# Ensure PATH includes ~/.local/bin for uvx
export PATH="\$HOME/.local/bin:\$PATH"

print_info() { echo "[INFO] \$1"; }
print_warn() { echo "[WARN] \$1"; }

# Ensure apps directory exists
mkdir -p "\$APP_DIR"

# Check if repository exists, clone if not
if [ ! -d "\$PROJECT_DIR" ]; then
    print_info "Repository not found. Cloning from \$REPO_URL..."
    cd "\$APP_DIR"
    git clone "\$REPO_URL" pytogether
    cd "\$PROJECT_DIR"
else
    print_info "Repository found. Pulling latest code..."
    cd "\$PROJECT_DIR"
    git fetch origin
    git pull origin main || git pull origin master
fi

# Ensure .env file exists
ENV_FILE="\$PROJECT_DIR/backend/.env"
if [ ! -f "\$ENV_FILE" ]; then
    print_info ".env file not found. Generating with random values..."
    mkdir -p "\$PROJECT_DIR/backend"
    
    # Generate random Django SECRET_KEY (50 characters)
    if command -v python3 >/dev/null 2>&1; then
        DJANGO_SECRET_KEY=\$(python3 -c "import secrets; import string; chars = string.ascii_letters + string.digits + '!@#\\\$%^&*(-_=+)'; print(''.join(secrets.choice(chars) for _ in range(50)))")
    else
        DJANGO_SECRET_KEY=\$(openssl rand -base64 40 | tr -d "=+/" | cut -c1-50)
    fi
    
    # Generate random PostgreSQL password (32 characters)
    if command -v python3 >/dev/null 2>&1; then
        POSTGRES_PASSWORD=\$(python3 -c "import secrets; import string; chars = string.ascii_letters + string.digits; print(''.join(secrets.choice(chars) for _ in range(32)))")
    else
        POSTGRES_PASSWORD=\$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-32)
    fi
    
    # Write .env file with generated values
    {
        echo "# Django Settings (auto-generated)"
        echo "DJANGO_SECRET_KEY=\$DJANGO_SECRET_KEY"
        echo "PROD=False"
        echo ""
        echo "# Database (PostgreSQL) - auto-generated"
        echo "POSTGRES_DB=pytogether"
        echo "POSTGRES_USER=pytogether"
        echo "POSTGRES_PASSWORD=\$POSTGRES_PASSWORD"
        echo "POSTGRES_HOST=localhost"
        echo "POSTGRES_PORT=5432"
        echo ""
        echo "# Redis"
        echo "REDIS_HOST=redis"
        echo "REDIS_PORT=6379"
        echo ""
        echo "# Production settings (uncomment and configure for production)"
        echo "# PROD=True"
        echo "# DOMAIN=yourdomain.com"
        echo "# VPS_IP=your.server.ip"
        echo "# ORIGIN=https://yourdomain.com"
        echo "# NAKED_ORIGIN=https://www.yourdomain.com"
    } > "\$ENV_FILE"
    print_info ".env file created with auto-generated secure values."
    print_info "DJANGO_SECRET_KEY and POSTGRES_PASSWORD have been randomly generated."
else
    print_info ".env file found."
fi

# Pull latest image
print_info "Pulling latest image: $FULL_IMAGE"
podman pull "$FULL_IMAGE"

# Stop existing containers
print_info "Stopping existing containers..."
uvx podman-compose down || true

# Start containers using registry image
print_info "Starting containers with registry image..."
export REGISTRY_IMAGE="$FULL_IMAGE"
if [ -f docker-compose.prod.yaml ]; then
    uvx podman-compose -f docker-compose.prod.yaml up -d
else
    # Fallback: tag image and use regular compose file
    podman tag "$FULL_IMAGE" pytogether-backend:latest
    uvx podman-compose up -d
fi

# Show status
print_info "Container status:"
uvx podman-compose ps

print_info "Deployment complete!"
DEPLOY_SCRIPT
)
    
    # Copy deployment script to server and execute
    ssh -i "$ssh_key" devops@"$server_ip" "cat > /tmp/deploy.sh <<'EOF'
$deploy_script
EOF
chmod +x /tmp/deploy.sh
/tmp/deploy.sh"
}

# Main execution
main() {
    # Get server IP from terraform output
    cd "$SCRIPT_DIR"
    local server_ip="${1:-$(terraform output -raw service_ip 2>/dev/null || echo '')}"
    local repo_url="$(get_repo_url)"
    
    if [ -z "$server_ip" ]; then
        print_error "Server IP not provided and could not be determined from terraform"
        exit 1
    fi
    
    if [ -z "$repo_url" ]; then
        print_error "Repository URL not provided and could not be determined"
        exit 1
    fi
    
    print_info "Starting deployment to $server_ip"
    print_info "Using registry: $REGISTRY"
    print_info "Image: $FULL_IMAGE"
    
    build_and_push
    deploy_to_server "$server_ip" "$repo_url"
}

# Show usage
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [server_ip]"
    echo ""
    echo "Environment variables:"
    echo "  REGISTRY      - Container registry (default: docker.io)"
    echo "  IMAGE_NAME    - Image name (default: pytogether-backend)"
    echo "  IMAGE_TAG     - Image tag (default: latest)"
    echo "  SSH_KEY_FILE  - SSH key file path (default: ~/.ssh/id_rsa)"
    echo ""
    echo "Example:"
    echo "  REGISTRY=docker.io IMAGE_NAME=myuser/pytogether-backend $0"
    exit 0
fi

# Run main function
main "$@"

