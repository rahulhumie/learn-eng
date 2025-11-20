#!/bin/bash

# English Conversation Coach - Setup Script
# This script automates the installation of whisper.cpp, piper, and all dependencies

set -e  # Exit on error

echo "🎙️  English Conversation Coach - Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 18+ first.${NC}"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓${NC} Node.js found: $(node --version)"

# Check for git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git is not installed. Please install Git first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Git found"

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  ffmpeg not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    else
        echo -e "${RED}❌ Homebrew not found. Please install ffmpeg manually.${NC}"
        echo "   Visit: https://ffmpeg.org/download.html"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} ffmpeg found: $(ffmpeg -version | head -n1 | cut -d' ' -f3)"

# Check for Python/pip
if ! command -v pip3 &> /dev/null && ! command -v pip &> /dev/null; then
    echo -e "${RED}❌ Python/pip is not installed. Please install Python 3 first.${NC}"
    exit 1
fi
PIP_CMD=$(command -v pip3 || command -v pip)
echo -e "${GREEN}✓${NC} Python/pip found"

# Check for make/cmake (for building whisper.cpp)
if ! command -v make &> /dev/null; then
    echo -e "${RED}❌ Make is not installed. Please install build tools.${NC}"
    exit 1
fi
if ! command -v cmake &> /dev/null; then
    echo -e "${YELLOW}⚠${NC}  CMake not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install cmake
    else
        echo -e "${RED}❌ Homebrew not found. Please install CMake manually.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}✓${NC} Build tools found"

echo ""
echo "📦 Installing dependencies..."
echo ""

# Create speech-tools directory
SPEECH_TOOLS_DIR="$HOME/speech-tools"
mkdir -p "$SPEECH_TOOLS_DIR"
cd "$SPEECH_TOOLS_DIR"

# Install whisper.cpp
if [ ! -d "whisper.cpp" ]; then
    echo "🔊 Installing whisper.cpp..."
    git clone https://github.com/ggerganov/whisper.cpp.git
    cd whisper.cpp
    echo "📥 Downloading whisper model (this may take a few minutes)..."
    bash ./models/download-ggml-model.sh base.en
    echo "🔨 Building whisper.cpp (this may take several minutes)..."
    make
    cd ..
    echo -e "${GREEN}✓${NC} whisper.cpp installed"
else
    echo -e "${GREEN}✓${NC} whisper.cpp already installed"
fi

# Install piper
if [ ! -f "$PIP_CMD" ]; then
    echo -e "${RED}❌ pip command not found${NC}"
    exit 1
fi

echo "🔊 Installing piper-tts..."
$PIP_CMD install --quiet piper-tts
echo -e "${GREEN}✓${NC} piper-tts installed"

# Download piper voice model
PIPER_VOICES_DIR="$SPEECH_TOOLS_DIR/piper-voices"
mkdir -p "$PIPER_VOICES_DIR"
cd "$PIPER_VOICES_DIR"

if [ ! -f "en_US-amy-medium.onnx" ]; then
    echo "📥 Downloading piper voice model (this may take a few minutes)..."
    curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx" -o en_US-amy-medium.onnx
    curl -L "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json" -o en_US-amy-medium.onnx.json
    echo -e "${GREEN}✓${NC} Piper voice model downloaded"
else
    echo -e "${GREEN}✓${NC} Piper voice model already downloaded"
fi

# Go back to project directory
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install
echo -e "${GREEN}✓${NC} npm dependencies installed"

# Create .env file
echo ""
echo "⚙️  Creating .env configuration file..."

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
    FFMPEG_PATH="/opt/homebrew/bin/ffmpeg"
else
    FFMPEG_PATH=$(which ffmpeg)
fi

PIPER_BIN=$(which piper || echo "/opt/miniconda3/bin/piper")

cat > .env << EOF
PORT=8000
WHISPER_BIN=$SPEECH_TOOLS_DIR/whisper.cpp/build/bin/whisper-cli
WHISPER_MODEL=$SPEECH_TOOLS_DIR/whisper.cpp/models/ggml-base.en.bin
PIPER_BIN=$PIPER_BIN
PIPER_MODEL=$PIPER_VOICES_DIR/en_US-amy-medium.onnx
FFMPEG_BIN=$FFMPEG_PATH
EOF

echo -e "${GREEN}✓${NC} .env file created"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Run: npm start"
echo "  2. Open: http://localhost:8000"
echo "  3. Click 'Start Learning' and choose a scenario"
echo ""
echo "Note: If piper command is not found, you may need to:"
echo "  - Activate your Python virtual environment, or"
echo "  - Update PIPER_BIN in .env with the full path to piper"
echo ""

