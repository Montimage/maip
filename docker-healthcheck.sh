#!/bin/bash
# Health check script for Docker containers

set -e

# Check if server is responding
if curl -f http://localhost:31057/health > /dev/null 2>&1; then
    echo "Server is healthy"
    exit 0
else
    echo "Server is not responding"
    exit 1
fi
