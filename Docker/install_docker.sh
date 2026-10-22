#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# One Melody - Docker & Docker Compose Automated Installer for Ubuntu 24.04/22.04
#
# Usage:
#   1. Remote Install: ./install_docker.sh <REMOTE_IP> [PATH_TO_PEM_KEY]
#   2. Local Install:  sudo ./install_docker.sh --local  (or directly on the EC2 instance)
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_KEY="${REPO_ROOT}/infra/environments/production/audiomelody-ec2-key.pem"

install_docker_locally() {
  echo -e "${BLUE}==>${NC} Installing Docker & Docker Compose on $(hostname)..."
  export DEBIAN_FRONTEND=noninteractive

  echo -e "${BLUE}==>${NC} Cleaning any conflicting packages..."
  sudo apt-get remove -y docker.io docker-doc docker-compose podman-docker containerd runc 2>/dev/null || true

  echo -e "${BLUE}==>${NC} Installing required prerequisites..."
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg lsb-release

  echo -e "${BLUE}==>${NC} Adding Docker official GPG key..."
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc

  echo -e "${BLUE}==>${NC} Setting up Docker repository for Ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME")..."
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  echo -e "${BLUE}==>${NC} Installing Docker CE, CLI, and Docker Compose Plugin..."
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  echo -e "${BLUE}==>${NC} Starting and enabling Docker daemon..."
  sudo systemctl daemon-reload || true
  sudo systemctl enable --now docker

  # Add ubuntu / current user to docker group
  TARGET_USER="${SUDO_USER:-$USER}"
  if id -u ubuntu >/dev/null 2>&1; then
    TARGET_USER="ubuntu"
  fi
  echo -e "${BLUE}==>${NC} Adding user '${TARGET_USER}' to the docker group..."
  sudo usermod -aG docker "${TARGET_USER}" || true
  sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

  echo -e "${GREEN}==> Docker installation verified successfully!${NC}"
  docker --version
  docker compose version
}

install_docker_remotely() {
  local target_ip="$1"
  local key_path="${2:-$DEFAULT_KEY}"

  if [[ ! -f "$key_path" ]]; then
    echo -e "${RED}Error: Private key not found at: ${key_path}${NC}"
    echo "Please provide a valid path to your EC2 .pem key."
    exit 1
  fi

  chmod 400 "$key_path"

  echo -e "${BLUE}==>${NC} Connecting to remote host ${target_ip} with key ${key_path}..."

  # Wait for SSH availability
  echo -e "${BLUE}==>${NC} Checking SSH connectivity to ${target_ip}..."
  until ssh -i "$key_path" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "ubuntu@${target_ip}" "echo 'SSH connected'" 2>/dev/null; do
    echo -e "${YELLOW}Waiting for SSH on ${target_ip}... retrying in 5 seconds${NC}"
    sleep 5
  done

  echo -e "${BLUE}==>${NC} Uploading installer and executing on ${target_ip}..."
  ssh -i "$key_path" -o StrictHostKeyChecking=no "ubuntu@${target_ip}" 'bash -s' << 'REMOTE_SCRIPT'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
sudo apt-get remove -y docker.io docker-doc docker-compose podman-docker containerd runc 2>/dev/null || true
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu || true
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
docker --version
docker compose version
echo "Docker and Docker Compose installed and active!"
REMOTE_SCRIPT

  echo -e "${GREEN}==> Remote Docker setup complete on ${target_ip}!${NC}"
}

# Main routing
if [[ $# -eq 0 || "${1:-}" == "--local" ]]; then
  install_docker_locally
else
  install_docker_remotely "$1" "${2:-$DEFAULT_KEY}"
fi
