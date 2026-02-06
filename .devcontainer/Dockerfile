FROM ubuntu:noble

# Install required packages for development.
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        make \
        zip \
        unzip \
        build-essential \
        curl \
        wget \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Install chrome (architecture-aware).
RUN ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "amd64" ]; then \
        wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb --no-check-certificate -O chrome.deb; \
    elif [ "$ARCH" = "arm64" ]; then \
        echo "Chrome not available for ARM64, installing Chromium instead"; \
        apt-get update && apt-get install -y chromium-browser; \
    fi \
    && if [ -f chrome.deb ]; then \
        apt-get update \
        && apt-get install -y ./chrome.deb \
        && apt --fix-broken install \
        && rm -f chrome.deb; \
    fi \
    && apt-get autoremove -y \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Show first run notice when starting codespaces.
COPY first-run-notice.txt /tmp/scripts/
RUN mkdir -p "/usr/local/etc/vscode-dev-containers/" \
    && mv -f /tmp/scripts/first-run-notice.txt /usr/local/etc/vscode-dev-containers/ \
    && rm -rf /tmp/scripts

# Set defaults.
ENV SHELL=/bin/bash
