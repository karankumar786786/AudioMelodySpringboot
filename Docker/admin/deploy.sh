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

# Copy deployment bundle. No env files: secrets live in AWS Secrets Manager and the
# containers read them at start-up with this server's IAM instance role (infra/SECRETS.md).
echo -e "${BLUE}==>${NC} Transferring docker-compose, Caddyfile and OTel collector config..."
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  "${SCRIPT_DIR}/docker-compose.yml" \
  "${SCRIPT_DIR}/Caddyfile" \
  "${SCRIPT_DIR}/otel-collector-config.yaml" \
  "ubuntu@${TARGET_IP}:~/app/"

# Exception, for now: the streams service (Kafka work) still reads streams.env. Drop this
# once streams loads onemelody/prod/streams itself (see infra/SECRETS.md, "Follow-ups").
if [[ ! -f "${SCRIPT_DIR}/streams.env" ]]; then
  echo -e "${RED}Error: ${SCRIPT_DIR}/streams.env is missing (copy streams.env.example and fill it in).${NC}"
  exit 1
fi
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no "${SCRIPT_DIR}/streams.env" "ubuntu@${TARGET_IP}:~/app/"

# Old deploys left env files with secrets in ~/app. They are no longer read; say so
# instead of deleting them, so removal stays a deliberate step (see infra/SECRETS.md).
LEFTOVER_ENV=$(ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" 'ls ~/app/*.env 2>/dev/null | grep -v "/streams.env$" || true')
if [[ -n "$LEFTOVER_ENV" ]]; then
  echo -e "${YELLOW}Warning: old env files are still on the server and should be removed once the stack is healthy:${NC}"
  echo "$LEFTOVER_ENV"
fi

# Kafka topic definitions, applied by the redpanda-init container on every deploy
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" "mkdir -p ~/app/kafka"
scp -i "$KEY_PATH" -o StrictHostKeyChecking=no \
  "${REPO_ROOT}/infra/kafka/topics.yaml" \
  "${REPO_ROOT}/infra/kafka/apply-topics.sh" \
  "ubuntu@${TARGET_IP}:~/app/kafka/"

# Mount the Kafka EBS volume at /mnt/kafka (formats it only the first time) and point
# Redpanda's advertised address at this instance's private IP.
KAFKA_VOLUME_ID=""
if command -v terraform >/dev/null 2>&1 && [[ -d "$TF_DIR/.terraform" ]]; then
  KAFKA_VOLUME_ID=$(terraform -chdir="$TF_DIR" output -json kafka 2>/dev/null | grep -Eo 'vol-[0-9a-f]+' | head -1 || true)
fi
echo -e "${BLUE}==>${NC} Preparing Kafka storage (volume: ${KAFKA_VOLUME_ID:-none, using the root disk})..."
ssh -i "$KEY_PATH" -o StrictHostKeyChecking=no "ubuntu@${TARGET_IP}" "KAFKA_VOLUME_ID='${KAFKA_VOLUME_ID}' bash -s" << 'KAFKA_STORAGE'
set -euo pipefail
if ! mountpoint -q /mnt/kafka; then
  sudo mkdir -p /mnt/kafka
  if [[ -n "${KAFKA_VOLUME_ID}" ]]; then
    DEV="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${KAFKA_VOLUME_ID/-/}"
    for i in $(seq 1 30); do [[ -e "$DEV" ]] && break; sleep 2; done
    if [[ -e "$DEV" ]]; then
      if ! sudo blkid "$DEV" >/dev/null 2>&1; then sudo mkfs.ext4 -q -L kafka "$DEV"; fi
      grep -q "LABEL=kafka" /etc/fstab || echo "LABEL=kafka /mnt/kafka ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab >/dev/null
      sudo mount /mnt/kafka
    else
      echo "Kafka volume device not found; using the root disk for /mnt/kafka"
    fi
  fi
fi
# Redpanda runs as uid 101, the streams app as the image's 'app' user (uid 999 on noble).
sudo mkdir -p /mnt/kafka/redpanda /mnt/kafka/streams
sudo chown -R 101:101 /mnt/kafka/redpanda
sudo chmod 777 /mnt/kafka/streams
PRIVATE_IP=$(hostname -I | awk '{print $1}')
printf 'REDPANDA_ADVERTISED_HOST=%s\nREDPANDA_BIND_IP=%s\nKAFKA_DATA_DIR=/mnt/kafka\n' "$PRIVATE_IP" "$PRIVATE_IP" > ~/app/.env
echo "Redpanda will advertise ${PRIVATE_IP}:9092"
KAFKA_STORAGE

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
