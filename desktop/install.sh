#!/bin/bash
# JARVIS Hybrid - Desktop Agent Setup Script
# Run this to set up the desktop agent on your computer

echo "=========================================="
echo "  🤖 JARVIS HYBRID — Desktop Setup"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required. Install it from python.org"
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"

# Check git
if ! command -v git &> /dev/null; then
    echo "❌ Git is required. Install it from git-scm.com"
    exit 1
fi

echo "✅ Git found: $(git --version)"

# Clone repository if not already cloned
if [ ! -d "JARVIS-HYBRID" ]; then
    echo ""
    echo "📥 Cloning JARVIS-HYBRID repository..."
    git clone https://github.com/mohsinrasheed-Baga1/JARVIS-HYBRID.git
    cd JARVIS-HYBRID
else
    cd JARVIS-HYBRID
    echo "📥 Updating repository..."
    git pull origin main
fi

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies..."
cd desktop
pip3 install -r requirements.txt 2>/dev/null || pip install -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 To start JARVIS Desktop Agent:"
echo ""
echo "  # CLI mode:"
echo "  python3 jarvis/main.py --cloud-url YOUR_VERCEL_URL"
echo ""
echo "  # GUI mode (with dashboard):"
echo "  python3 jarvis/main.py --gui --cloud-url YOUR_VERCEL_URL"
echo ""
echo "  # Full automation (WhatsApp + Jobs + Auto-update):"
echo "  python3 jarvis/main.py --gui --monitor-whatsapp --auto-job-search --auto-update --cloud-url YOUR_VERCEL_URL"
echo ""
echo "📱 Don't forget to edit config.json with your API keys!"
