# Network Detection and Response (NDR)
Network Detection and Response (NDR) component provides an anomaly detection and response capability for (encrypted) network traffic. NDR includes an Explainable AI (XAI) capability to enable root cause analysis (RCA) of detected anomalies. Responses can be automatically triggered through the Mitigation Manager.

## Installation
### Build from Docker
```bash
# Clone the repo and checkout the latest tag
git clone https://github.com/resilmesh2/Network-Detection-Response.git
cd Network-Detection-Response
git fetch --tags --force
LATEST_TAG=$(git describe --tags "$(git rev-list --tags --max-count=1)")
git checkout "$LATEST_TAG"

# Copy the Docker configuration template
cp env.docker .env

# (Optional) Edit .env if you need to customize:
# - NATS_URL: If using NATS messaging (default: nats://nats:4222)
# - NATS_SUBJECT: Topic for publishing data
# - REACT_APP_API_URL: If accessing from other machines (default: http://localhost:31057)

# Build and run the Docker stack
# docker-compose build
# docker-compose up -d

# Build and run with Resilmesh integration
docker-compose -f docker-compose.resilmesh.yml build
docker-compose -f docker-compose.resilmesh.yml up -d

# Access the application on http://localhost:3000
```
