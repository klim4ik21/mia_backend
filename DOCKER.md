# 🐳 Docker Deployment Guide

## Quick Start

### 1. Prerequisites
- Docker installed ([Download Docker](https://www.docker.com/get-started))
- Docker Compose installed (included with Docker Desktop)

### 2. Configuration

Create `.env` file in the `Backend/yandex-function/` directory:

```bash
cp .env.example .env
```

Edit `.env` with your YandexGPT credentials:
```env
YANDEX_FOLDER_ID=your_folder_id_here
YANDEX_API_KEY=your_api_key_here
PORT=3000
NODE_ENV=production
```

### 3. Build and Run

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

### 4. Verify

Check that the server is running:
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","message":"pong","timestamp":"..."}
```

## Docker Commands

### Development

```bash
# Build image
docker-compose build

# Start in foreground (see logs)
docker-compose up

# Start in background
docker-compose up -d

# Restart
docker-compose restart

# Stop
docker-compose down

# View logs
docker-compose logs -f mia-backend

# Execute command in container
docker-compose exec mia-backend sh
```

### Production

```bash
# Build optimized image
docker build -t mia-backend:latest .

# Run container
docker run -d \
  --name mia-backend \
  -p 3000:3000 \
  --restart unless-stopped \
  -e YANDEX_FOLDER_ID=your_folder_id \
  -e YANDEX_API_KEY=your_api_key \
  mia-backend:latest

# View logs
docker logs -f mia-backend

# Stop and remove
docker stop mia-backend
docker rm mia-backend
```

## Health Check

The container includes automatic health checks:
- Runs every 30 seconds
- Checks `/health` endpoint
- Restarts container if unhealthy

View health status:
```bash
docker ps
docker inspect mia-backend | grep -A 10 Health
```

## Network Configuration

### Access from iOS App

#### Option 1: Use host machine IP
```swift
// In APIService.swift
private let baseURL = "http://192.168.0.176:3000"
```

#### Option 2: Use Docker host
```bash
# On Mac, you can use host.docker.internal
docker run -p 3000:3000 mia-backend:latest
```

Then in iOS app:
```swift
private let baseURL = "http://host.docker.internal:3000"
```

#### Option 3: Use ngrok for external access
```bash
# Install ngrok
brew install ngrok

# Start ngrok tunnel
ngrok http 3000

# Use the ngrok URL in your iOS app
# Example: https://abc123.ngrok.io
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs mia-backend

# Check container status
docker ps -a

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Port already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"  # Host:Container
```

### Can't connect from iOS app
```bash
# Verify container is running
docker ps

# Check if port is exposed
docker port mia-backend

# Test from host machine
curl http://localhost:3000/health

# Check firewall settings on Mac
# System Settings > Network > Firewall
```

### Update the application
```bash
# Pull latest code changes
git pull

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

## Performance

### Resource Limits

Add resource limits to `docker-compose.yml`:
```yaml
services:
  mia-backend:
    # ...
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

### Monitoring

```bash
# Real-time stats
docker stats mia-backend

# Container info
docker inspect mia-backend
```

## Deployment

### Deploy to Cloud

#### Docker Hub
```bash
# Login to Docker Hub
docker login

# Tag image
docker tag mia-backend:latest yourusername/mia-backend:latest

# Push to Docker Hub
docker push yourusername/mia-backend:latest
```

#### Deploy to any server
```bash
# On remote server
docker pull yourusername/mia-backend:latest
docker run -d \
  --name mia-backend \
  -p 3000:3000 \
  --restart unless-stopped \
  -e YANDEX_FOLDER_ID=$YANDEX_FOLDER_ID \
  -e YANDEX_API_KEY=$YANDEX_API_KEY \
  yourusername/mia-backend:latest
```

## Security

### Production Best Practices

1. **Use secrets for sensitive data**
```bash
# Create secrets
echo "your_api_key" | docker secret create yandex_api_key -

# Use in docker-compose (Swarm mode)
secrets:
  yandex_api_key:
    external: true
```

2. **Run as non-root user**
Add to Dockerfile:
```dockerfile
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs
```

3. **Use HTTPS in production**
Set up reverse proxy (nginx, Caddy) with SSL certificate

4. **Enable rate limiting**
Already implemented in the backend code

## CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/docker.yml
name: Docker Build and Push

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          cd Backend/yandex-function
          docker build -t mia-backend:latest .

      - name: Push to Docker Hub
        run: |
          echo "${{ secrets.DOCKER_PASSWORD }}" | docker login -u "${{ secrets.DOCKER_USERNAME }}" --password-stdin
          docker push yourusername/mia-backend:latest
```
