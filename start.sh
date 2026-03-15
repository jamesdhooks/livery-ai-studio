#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Livery AI Studio — Start Script (Linux / macOS)
# ═══════════════════════════════════════════════════════════════════════════
# Creates/activates a Python venv, installs deps, and launches the app.
#
# Usage:
#   ./start.sh                    Launch normally
#   ./start.sh --gpu              Also install GPU upscaling deps (NVIDIA only)
#   ./start.sh --gpu --cuda 11    Install with CUDA 11.x (for RTX 30xx)
#   ./start.sh --gpu --cuda 12    Install with CUDA 12.x (default, for 40xx/50xx)
#   ./start.sh --port 8080        Use a custom port
#   ./start.sh --skip-install     Skip pip install (faster restart)
#   ./start.sh --build-frontend   Rebuild the React frontend (requires Node.js)
#
# NOTE: The pre-built frontend is included in static/ — Node.js is NOT
# required to run the app. Use --build-frontend only if you have modified
# files in the frontend/ source directory.
#
# NOTE: iRacing is Windows-only. On Linux/macOS the app runs but iRacing
# deployment and window capture features are unavailable.
# ═══════════════════════════════════════════════════════════════════════════

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$APP_DIR/.venv"
PORT=5199
INSTALL_GPU=0
CUDA_VER=12
SKIP_INSTALL=0
BUILD_FRONTEND=0

# ─── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --gpu)             INSTALL_GPU=1; shift ;;
        --cuda)            CUDA_VER="$2"; shift 2 ;;
        --port)            PORT="$2"; shift 2 ;;
        --skip-install)    SKIP_INSTALL=1; shift ;;
        --build-frontend)  BUILD_FRONTEND=1; shift ;;
        *)                 echo "Unknown argument: $1"; shift ;;
    esac
done

# ─── Check Python ─────────────────────────────────────────────────────────────
echo ""
echo " ══════════════════════════════════════════════"
echo "  Livery AI Studio"
echo " ══════════════════════════════════════════════"
echo ""

PYTHON_CMD=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        PY_VER=$("$cmd" --version 2>&1 | awk '{print $2}')
        PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
        PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
        if [[ "$PY_MAJOR" -ge 3 && "$PY_MINOR" -ge 10 ]]; then
            PYTHON_CMD="$cmd"
            break
        fi
    fi
done

if [[ -z "$PYTHON_CMD" ]]; then
    echo " [ERROR] Python 3.10+ not found."
    echo " Install from https://python.org or use your package manager."
    exit 1
fi

echo " Python: $PY_VER ($PYTHON_CMD)"

# ─── Create venv if needed ────────────────────────────────────────────────────
if [[ ! -f "$VENV_DIR/bin/activate" ]]; then
    echo " Creating virtual environment..."
    "$PYTHON_CMD" -m venv "$VENV_DIR"
    echo " ✓ Virtual environment created at .venv/"
    SKIP_INSTALL=0  # force install on first run
else
    echo " ✓ Virtual environment found"
fi

# ─── Activate venv ────────────────────────────────────────────────────────────
source "$VENV_DIR/bin/activate"
echo " ✓ Virtual environment activated"

# ─── Install dependencies ─────────────────────────────────────────────────────
if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    echo ""
    echo " Installing core dependencies..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$APP_DIR/requirements.txt"
    echo " ✓ Core dependencies installed"

    # pywin32 is Windows-only — skip on Linux/macOS
    if [[ "$(uname)" == "Linux" || "$(uname)" == "Darwin" ]]; then
        echo " ℹ Skipping pywin32 (Windows-only)"
    fi

    if [[ "$INSTALL_GPU" -eq 1 ]]; then
        echo ""
        echo " Installing GPU upscaling dependencies..."

        # Auto-detect RTX 50xx (Blackwell) if --cuda not explicitly overridden
        if [[ "$CUDA_VER" == "12" ]]; then
            if nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | grep -qiE '5070|5080|5090'; then
                echo " [AUTO] Detected RTX 50xx - using CUDA 12.8 nightly"
                CUDA_VER=50
            fi
        fi

        if [[ "$CUDA_VER" == "11" ]]; then
            echo " Using CUDA 11.8 (RTX 30xx series)"
            pip install --quiet torch torchvision --index-url https://download.pytorch.org/whl/cu118
        elif [[ "$CUDA_VER" == "50" ]]; then
            echo " Using PyTorch nightly + CUDA 12.8 (RTX 50xx / Blackwell series)"
            pip install --quiet --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128
        else
            echo " Using CUDA 12.4 (RTX 40xx series)"
            pip install --quiet torch torchvision --index-url https://download.pytorch.org/whl/cu124
        fi

        pip install --quiet realesrgan
        echo " ✓ GPU packages installed"

        # Patch basicsr torchvision compatibility
        echo " Patching basicsr for torchvision compatibility..."
        python "$APP_DIR/patch_basicsr.py"

        # Download model weights
        python "$APP_DIR/setup.py" --upscale
    fi
else
    echo " Skipping dependency install (--skip-install)"
fi

# ─── Frontend build (optional — only needed after editing frontend/ sources) ──
if [[ "$BUILD_FRONTEND" -eq 1 ]]; then
    echo ""
    echo " Building React frontend..."
    if ! command -v node &>/dev/null; then
        echo " [ERROR] Node.js not found. Install from https://nodejs.org"
        exit 1
    fi
    if [[ ! -d "$APP_DIR/frontend/node_modules" ]]; then
        echo " Installing frontend dependencies..."
        cd "$APP_DIR/frontend"
        npm install
    fi
    cd "$APP_DIR/frontend"
    npm run build
    cd "$APP_DIR"
    echo " ✓ Frontend built successfully → static/"
else
    echo " ✓ Using pre-built frontend from static/"
    echo "   (Run with --build-frontend to rebuild after editing frontend/ sources)"
fi

# ─── Launch ───────────────────────────────────────────────────────────────────
echo ""
echo " ══════════════════════════════════════════════"
echo "  Launching on port $PORT..."
echo "  Press Ctrl+C to stop."
echo " ══════════════════════════════════════════════"
echo ""

export FLASK_PORT="$PORT"
python "$APP_DIR/app.py"
