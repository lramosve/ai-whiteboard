#!/bin/bash

# AI Whiteboard - GCP Deployment Script
# This script deploys the application to Google Cloud Platform

set -e

# Configuration
PROJECT_ID=${GCP_PROJECT_ID:-"your-project-id"}
REGION=${GCP_REGION:-"us-central1"}
SERVICE_NAME="ai-whiteboard-backend"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Database Configuration
DB_INSTANCE_NAME="whiteboard-db"
DB_NAME="whiteboard"
DB_USER="whiteboard_user"

# Redis Configuration  
REDIS_INSTANCE_NAME="whiteboard-redis"

echo "🚀 Starting deployment to GCP..."
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo ""

# Step 1: Set GCP project
echo "📋 Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Step 2: Enable required APIs
echo "🔧 Enabling required GCP APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com

# Step 3: Create Cloud SQL instance (if not exists)
echo "🗄️  Setting up Cloud SQL PostgreSQL..."
if ! gcloud sql instances describe ${DB_INSTANCE_NAME} &>/dev/null; then
  echo "Creating Cloud SQL instance..."
  gcloud sql instances create ${DB_INSTANCE_NAME} \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=${REGION} \
    --network=default \
    --backup \
    --storage-auto-increase
  
  echo "Creating database..."
  gcloud sql databases create ${DB_NAME} \
    --instance=${DB_INSTANCE_NAME}
  
  echo "Creating user..."
  DB_PASSWORD=$(openssl rand -base64 32)
  gcloud sql users create ${DB_USER} \
    --instance=${DB_INSTANCE_NAME} \
    --password=${DB_PASSWORD}
  
  # Store password in Secret Manager
  echo ${DB_PASSWORD} | gcloud secrets create db-password \
    --data-file=- \
    --replication-policy="automatic"
else
  echo "Cloud SQL instance already exists"
fi

# Step 4: Create Redis instance (if not exists)
echo "💾 Setting up Redis..."
if ! gcloud redis instances describe ${REDIS_INSTANCE_NAME} --region=${REGION} &>/dev/null; then
  echo "Creating Redis instance..."
  gcloud redis instances create ${REDIS_INSTANCE_NAME} \
    --region=${REGION} \
    --tier=basic \
    --size=1
else
  echo "Redis instance already exists"
fi

# Step 5: Get connection strings
echo "🔗 Getting connection strings..."
DB_CONNECTION_NAME=$(gcloud sql instances describe ${DB_INSTANCE_NAME} \
  --format='value(connectionName)')

REDIS_HOST=$(gcloud redis instances describe ${REDIS_INSTANCE_NAME} \
  --region=${REGION} --format='value(host)')

REDIS_PORT=$(gcloud redis instances describe ${REDIS_INSTANCE_NAME} \
  --region=${REGION} --format='value(port)')

# Step 6: Store secrets
echo "🔐 Storing secrets in Secret Manager..."

# Check if Anthropic API key exists
if ! gcloud secrets describe anthropic-api-key &>/dev/null; then
  echo "Please enter your Anthropic API key:"
  read -s ANTHROPIC_KEY
  echo ${ANTHROPIC_KEY} | gcloud secrets create anthropic-api-key \
    --data-file=- \
    --replication-policy="automatic"
fi

# JWT Secret
if ! gcloud secrets describe jwt-secret &>/dev/null; then
  JWT_SECRET=$(openssl rand -base64 64)
  echo ${JWT_SECRET} | gcloud secrets create jwt-secret \
    --data-file=- \
    --replication-policy="automatic"
fi

# Step 7: Build and push Docker image
echo "🐳 Building and pushing Docker image..."
cd backend
gcloud builds submit --tag ${IMAGE_NAME}

# Step 8: Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME} \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --add-cloudsql-instances ${DB_CONNECTION_NAME} \
  --set-env-vars "NODE_ENV=production,PORT=8080,REDIS_HOST=${REDIS_HOST},REDIS_PORT=${REDIS_PORT}" \
  --set-secrets "ANTHROPIC_API_KEY=anthropic-api-key:latest,JWT_SECRET=jwt-secret:latest,DATABASE_URL=db-password:latest"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --format='value(status.url)')

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Backend URL: ${SERVICE_URL}"
echo "Database: ${DB_CONNECTION_NAME}"
echo "Redis: ${REDIS_HOST}:${REDIS_PORT}"
echo ""
echo "Next steps:"
echo "1. Update DATABASE_URL secret with actual connection string"
echo "2. Deploy frontend to Cloud Storage + Cloud CDN or Firebase Hosting"
echo "3. Configure custom domain (optional)"
echo "4. Set up monitoring and alerts"
echo ""
