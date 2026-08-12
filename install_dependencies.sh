#!/bin/bash
# install_dependencies.sh - Install system dependencies on Linux

echo "╔════════════════════════════════════════════╗"
echo "║   Installing System Dependencies           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
fi

echo "Detected OS: $OS"
echo ""

# Ubuntu/Debian
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    echo "Installing Ubuntu/Debian dependencies..."
    
    sudo apt update
    sudo apt install -y \
        python3-pip \
        python3-dev \
        build-essential \
        cmake \
        git \
        libopenblas-dev \
        liblapack-dev \
        libx11-dev \
        python3-tk \
        libopencv-dev \
        python3-opencv
    
    echo "✓ Dependencies installed"

# Fedora/RHEL/CentOS
elif [[ "$OS" == *"Fedora"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"CentOS"* ]]; then
    echo "Installing Fedora/RHEL dependencies..."
    
    sudo dnf install -y \
        python3-pip \
        python3-devel \
        cmake \
        gcc-c++ \
        git \
        blas-devel \
        lapack-devel \
        xorg-x11-devel \
        python3-tkinter \
        opencv-devel \
        opencv-python
    
    echo "✓ Dependencies installed"

# Arch
elif [[ "$OS" == *"Arch"* ]]; then
    echo "Installing Arch dependencies..."
    
    sudo pacman -Syu --noconfirm
    sudo pacman -S --noconfirm \
        python-pip \
        base-devel \
        cmake \
        git \
        blas \
        lapack \
        xorg-server \
        tk \
        opencv \
        python-opencv
    
    echo "✓ Dependencies installed"

else
    echo "⚠ Unknown Linux distribution"
    echo "Please install the following manually:"
    echo "  - Python 3.8+"
    echo "  - Python development headers"
    echo "  - Build tools (gcc, cmake)"
    echo "  - BLAS/LAPACK libraries"
    echo "  - X11 development headers"
    echo "  - Python Tkinter"
    exit 1
fi

echo ""
echo "✓ System dependencies installed successfully!"
echo ""
echo "Next: Run setup.sh to install Python dependencies"
