#!/bin/bash
set -e

echo "Starting NDR Server..."

# create the output directories if they don't exist
mkdir -p src/server/deep-learning/attacks
mkdir -p src/server/deep-learning/models
mkdir -p src/server/deep-learning/trainings
mkdir -p src/server/deep-learning/predictions
mkdir -p src/server/deep-learning/xai
mkdir -p src/server/mmt/outputs

# set capabilities for online capture (one-time per binary)
# In Docker, this is already done during build, but try again if needed
if [ "$DOCKER_ENV" = "true" ]; then
    echo "Running in Docker environment"
    if [ -f /opt/mmt/security/bin/mmt_security ]; then
        setcap cap_net_raw,cap_net_admin+eip /opt/mmt/security/bin/mmt_security 2>/dev/null || true
    fi
else
    echo "Running in non-Docker environment"
    if [ -f /opt/mmt/security/bin/mmt_security ]; then
        sudo setcap cap_net_raw,cap_net_admin+eip /opt/mmt/security/bin/mmt_security || true
    fi
fi

# Set environment variables
export USE_SUDO=${USE_SUDO:-false}
export NODE_ENV=${NODE_ENV:-production}

echo "Environment: DOCKER_ENV=$DOCKER_ENV, USE_SUDO=$USE_SUDO, NODE_ENV=$NODE_ENV"

# Wait for Redis if in Docker
if [ "$DOCKER_ENV" = "true" ] && [ ! -z "$REDIS_URL" ]; then
    echo "Waiting for Redis..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if nc -z redis 6379 2>/dev/null; then
            echo "Redis is ready!"
            break
        fi
        echo "Waiting for Redis... ($timeout seconds left)"
        sleep 2
        timeout=$((timeout-2))
    done
fi

# run server
echo "Starting Node.js server..."
exec npm start
