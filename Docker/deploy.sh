#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# One Melody - Master Deployment Orchestrator
#
# Usage:
#   ./deploy.sh core [CORE_IP] [KEY_PATH]        # Deploy Core + Mail stack (Instance 1)
#   ./deploy.sh admin [ADMIN_IP] [KEY_PATH]      # Deploy Admin + Processing stack (Instance 2)
#   ./deploy.sh all [KEY_PATH]                   # Auto-deploy both instances via Terraform outputs
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/environments/production"
DEFAULT_KEY="${TF_DIR}/audiomelody-ec2-key.pem"

TARGET="${1:-help}"

case "$TARGET" in
  core)
    echo -e "${BLUE}==>${NC} Running Core Engine deployment..."
    "${SCRIPT_DIR}/core/deploy.sh" "${2:-}" "${3:-$DEFAULT_KEY}"
    ;;

  admin|processing|process)
    echo -e "${BLUE}==>${NC} Running Admin & Processing deployment..."
    "${SCRIPT_DIR}/admin/deploy.sh" "${2:-}" "${3:-$DEFAULT_KEY}"
    ;;

  all)
    KEY="${2:-$DEFAULT_KEY}"
    echo -e "${BLUE}======================================================================${NC}"
    echo -e "${GREEN}Deploying FULL One Melody Infrastructure (Both Instances)${NC}"
    echo -e "${BLUE}======================================================================${NC}"

    if ! command -v terraform >/dev/null 2>&1 || [[ ! -d "$TF_DIR/.terraform" ]]; then
      echo -e "${RED}Error: Terraform not found or not initialized in ${TF_DIR}${NC}"
      echo "Please run terraform apply in infra/environments/production first, or deploy individually:"
      echo "  ./deploy.sh core <CORE_IP>"
      echo "  ./deploy.sh admin <ADMIN_IP>"
      exit 1
    fi

    IPS=$(terraform -chdir="$TF_DIR" output -json elastic_ips 2>/dev/null | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' || true)
    CORE_IP=$(echo "$IPS" | sed -n '1p')
    ADMIN_IP=$(echo "$IPS" | sed -n '2p')

    if [[ -z "$CORE_IP" || -z "$ADMIN_IP" ]]; then
      echo -e "${RED}Error: Could not retrieve both Elastic IPs from Terraform output.${NC}"
      echo "Please ensure 'terraform apply' completed successfully in ${TF_DIR}."
      exit 1
    fi

    echo -e "${GREEN}==> Instance 1 (Core):${NC} ${CORE_IP}"
    echo -e "${GREEN}==> Instance 2 (Admin/Processing):${NC} ${ADMIN_IP}"
    echo ""

    echo -e "${BLUE}==> Step 1/2: Deploying Core & Mail Stack to ${CORE_IP}...${NC}"
    "${SCRIPT_DIR}/core/deploy.sh" "$CORE_IP" "$KEY"
    echo ""

    echo -e "${BLUE}==> Step 2/2: Deploying Admin & Processing Stack to ${ADMIN_IP}...${NC}"
    "${SCRIPT_DIR}/admin/deploy.sh" "$ADMIN_IP" "$KEY"
    echo ""

    echo -e "${GREEN}======================================================================${NC}"
    echo -e "${GREEN}Full deployment complete across both EC2 production instances!${NC}"
    echo -e "${BLUE}Required DNS Records in Cloudflare/Route53:${NC}"
    echo -e "  A  api-one-melody.one-org.me      -> ${CORE_IP}"
    echo -e "  A  api-admin-one-melody.one-org.me  -> ${ADMIN_IP}"
    echo -e "  A  audio-processing.one-org.me      -> ${ADMIN_IP}"
    echo -e "${GREEN}======================================================================${NC}"
    ;;

  help|*)
    echo -e "${BLUE}One Melody - Production Deployment Manager${NC}"
    echo ""
    echo "Usage:"
    echo "  ./deploy.sh core [CORE_IP] [KEY_PATH]       Deploy Core Engine + Mail + Caddy"
    echo "  ./deploy.sh admin [ADMIN_IP] [KEY_PATH]     Deploy Admin + Audio Processing + Caddy"
    echo "  ./deploy.sh all [KEY_PATH]                  Auto-deploy both using Terraform outputs"
    echo ""
    echo "Prerequisites:"
    echo "  1. Run 'terraform apply' in infra/environments/production"
    echo "  2. Ensure audiomelody-ec2-key.pem exists in infra/environments/production"
    echo "  3. Point domain DNS records to the respective EC2 Elastic IPs"
    ;;
esac
