#!/bin/bash

# Script to restart the log-lupus container with the latest image
echo "Building new image..."
sudo docker build -t log-lupus-helper:latest .

echo "Stopping log-lupus-helper container..."
sudo docker compose stop log-lupus-helper

echo "Removing old log-lupus-helper container..."
sudo docker compose rm -f log-lupus-helper

echo "Starting updated log-lupus-helper container..."
sudo docker compose up -d

echo "Tailing logs for log-lupus-helper container..."
sudo docker logs log-lupus-helper -f
