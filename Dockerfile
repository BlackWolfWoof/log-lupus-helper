# Use official Node base image
FROM node AS base

# Install Chromium + dependencies + Xvfb
RUN apt-get update && apt-get install -y \
    chromium \
    xvfb \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libgtk-3-0 \
    libasound2 \
    fonts-liberation \
    wget \
    xdg-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files and install dependencies
COPY package*.json ./
RUN npm install
COPY . .

# Start Xvfb and run Node
CMD ["bash", "-c", "Xvfb :0 -screen 0 1280x720x24 & export DISPLAY=:0 && exec node index.js"]