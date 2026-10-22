#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# One Melody - Admin & Media Processing Deployment Script (EC2 Instance 2)
#
# Usage:
#   ./deploy.sh [PROCESSING_ELASTIC_IP] [KEY_PATH]
#   If PROCESSING_ELASTIC_IP is omitted, it auto-detects from Terraform production outputs.
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/environments/production"
DEFAULT_KEY="${TF_DIR}/audiomelody-ec2-key.pem"

TARGET_IP="${1:-}"
KEY_PATH="${2:-$DEFAULT_KEY}"

# Auto-detect IP from Terraform if not supplied (Instance 2 is index 1 of elastic_ips)
if [[ -z "$TARGET_IP" ]]; then
  echo -e "${BLUE}==>${NC} Target IP not provided. Querying Terraform production outputs..."
  if command -v terraform >/dev/null 2>&1 && [[ -d "$TF_DIR/.terraform" ]]; then
    DETECTED_IP=$(terraform -chdir="$TF_DIR" output -json elastic_ips 2>/dev/null | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' | sed -n '2p' || true)
    if [[ -n "$DETECTED_IP" ]]; then
      TARGET_IP="$DETECTED_IP"
      echo -e "${GREEN}==> Detected Processing/Admin Elastic IP:${NC} ${TARGET_IP}"
    fi
  fi
fi

if [[ -z "$TARGET_IP" ]]; then
  echo -e "${RED}Error: Processing/Admin instance IP not found.${NC}"
  echo "Usage: ./deploy.sh <PROCESSING_ELASTIC_IP> [PATH_TO_PEM_KEY]"
  exit 1
fi

if [[ ! -f "$KEY_PATH" ]]; then
  echo -e "${RED}Error: SSH Private key not found at:${NC} ${KEY_PATH}"
  exit 1
fi

chmod 400 "$KEY_PATH"

echo -e "${BLUE}======================================================================${NC}"
echo -e "${GREEN}Deploying Admin & Processing Stack to: ${TARGET_IP}${NC}"
echo -e "${BLUE}Services: Admin Backend (Django 8000), Audio Processing (FFmpeg/Bun 5010), Caddy TLS${NC}"
echo -e "${BLUE}======================================================================${NC}"

# Check SSH Connectivity
echo -e "${BLUE}==>${NC} Verifying SSH connectivity to ubuntu@${TARGET_IP}..."
until ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "ubuntu@${TARGET_IP}" "echo 'SSH connected'" 2>/dev/null; do
  echo -e "${YELLOW}Waiting for SSH... retrying in 5 seconds${NC}"
  sleep 5
done

# Ensure Docker is installed on remote host
echo -e "${BLUE}==>${NC} Checking Docker installation on remote host..."
if ! ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" "docker --version" 2>/dev/null; then
  echo -e "${YELLOW}Docker not found on remote instance. Running install_docker.sh...${NC}"
  "${SCRIPT_DIR}/../install_docker.sh" "$TARGET_IP" "$KEY_PATH"
fi

# Prepare remote directory
echo -e "${BLUE}==>${NC} Preparing remote deploy directory (~/app)..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" "mkdir -p ~/app"

# Copy deployment bundle
echo -e "${BLUE}==>${NC} Transferring docker-compose, Caddyfile, and environment files..."
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  "${SCRIPT_DIR}/docker-compose.yml" \
  "${SCRIPT_DIR}/Caddyfile" \
  "${SCRIPT_DIR}/admin.env" \
  "${SCRIPT_DIR}/process.env" \
  "ubuntu@${TARGET_IP}:~/app/"

# Deploy via Docker Compose
echo -e "${BLUE}==>${NC} Pulling latest images and starting services..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" 'bash -s' << 'REMOTE_COMMANDS'
set -euo pipefail
cd ~/app
echo "Pulling latest docker images..."
docker compose pull
echo "Starting containers..."
docker compose up -d --remove-orphans
echo "Verifying running containers:"
docker compose ps
REMOTE_COMMANDS

echo -e "${GREEN}======================================================================${NC}"
echo -e "${GREEN}Admin & Processing Stack successfully deployed on ${TARGET_IP}!${NC}"
echo -e "${BLUE}Endpoints configured in Caddyfile:${NC}"
echo -e "  - https://api-admin-one-melody.one-org.me (reverse proxy -> admin:8000)"
echo -e "  - https://audio-processing.one-org.me (reverse proxy -> process:5010)"
echo -e "${BLUE}DNS Setup:${NC} Ensure 'A' records point to ${TARGET_IP}:"
echo -e "  - api-admin-one-melody.one-org.me  -> ${TARGET_IP}"
echo -e "  - audio-processing.one-org.me      -> ${TARGET_IP}"
echo -e "${GREEN}======================================================================${NC}"
