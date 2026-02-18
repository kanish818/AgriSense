#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Installing correct Node version..."
npm install

echo "Installing Python dependencies..."
pip install -r requirements.txt || echo "Warning: Python install failed but continuing..."

echo "Build complete!"
