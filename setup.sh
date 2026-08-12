#!/bin/bash
# setup.sh - Automated setup script for Bus Management System

set -e  # Exit on error

echo "╔════════════════════════════════════════════╗"
echo "║  Bus Management - Attendance System Setup  ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check Python version
echo "[1/5] Checking Python version..."
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python $python_version found"

# Check if running on Linux
echo "[2/5] Checking OS..."
if [[ "$OSTYPE" != "linux"* ]]; then
    echo "⚠ Warning: This system is optimized for Linux"
fi
echo "✓ OS: $OSTYPE"

# Create virtual environment
echo "[3/5] Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
source venv/bin/activate
echo "✓ Virtual environment activated"

# Install dependencies
echo "[4/5] Installing dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt > /dev/null 2>&1
echo "✓ Dependencies installed"

# Initialize database and directories
echo "[5/5] Initializing system..."
python3 main.py --setup > /dev/null 2>&1
echo "✓ System initialized"

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║         Setup Complete! ✓                  ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo ""
echo "1. Activate virtual environment:"
echo "   source venv/bin/activate"
echo ""
echo "2. Start the application:"
echo "   python3 main.py"
echo ""
echo "3. Or run CLI mode:"
echo "   python3 main.py --cli"
echo ""
echo "4. Read README.md for detailed documentation"
echo ""
