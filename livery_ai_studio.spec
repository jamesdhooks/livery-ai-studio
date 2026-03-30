# -*- mode: python ; coding: utf-8 -*-
"""
livery_ai_studio.spec
-----------------------
PyInstaller build spec for Livery AI Studio (no-upscale / universal build).

GPU upscaling (Real-ESRGAN) is intentionally excluded so the exe runs on any
Windows machine — upscale deps are heavy (PyTorch) and require an NVIDIA GPU.
The app gracefully shows "upscaling not available" when these packages are absent.

Build (from repo root, requires PyInstaller and all core deps):
    pyinstaller livery_ai_studio.spec

Output:
    dist/
    └── Livery-AI-Studio-v<VERSION>/
        ├── Livery-AI-Studio.exe
        ├── static/          (React frontend)
        ├── library/     (180+ car templates)
        ├── livery_map.json
        └── ... (Python runtime DLLs, .pyd files, etc.)

The user places config.json next to the exe on first run.  The data/ directory
is created automatically alongside the exe.

See build_exe.bat for a one-command build, and RELEASE_GUIDE.md for the full
publishing workflow.
"""

import sys
from pathlib import Path

# Make version.py importable from within the spec
_spec_dir = Path(SPECPATH)  # noqa: F821  (SPECPATH is injected by PyInstaller)
sys.path.insert(0, str(_spec_dir))
from version import __version__  # noqa: E402

block_cipher = None

# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------
a = Analysis(
    ["app.py"],
    pathex=[str(_spec_dir)],
    binaries=[],
    datas=[
        # React frontend (built output — run `npm run build` first)
        ("static", "static"),
        # Car template library (180+ pre-extracted templates)
        ("library", "library"),
        # Car-to-folder mapping used by deploy_livery.py
        ("livery_map.json", "."),
        # App icons
        ("icon.png", "."),
        ("icon.ico", "."),
    ],
    hiddenimports=[
        # pywebview Windows backends
        "webview.platforms.winforms",
        "webview.platforms.edgechromium",
        "webview.js.drag",
        # Flask ecosystem
        "flask",
        "jinja2",
        "jinja2.ext",
        "click",
        "itsdangerous",
        "werkzeug",
        "werkzeug.serving",
        "werkzeug.debug",
        "werkzeug.routing",
        # Logging (used by app.py for app.log)
        "logging.handlers",
        # Google Gemini SDK
        "google.genai",
        "google.genai.types",
        # Image processing
        "PIL",
        "PIL.Image",
        "PIL.ImageOps",
        "PIL.ImageFilter",
        # PSD extraction
        "psd_tools",
        # SSL certificates
        "certifi",
        # Windows registry (used by server/deploy.py)
        "winreg",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    # Exclude GPU upscaling packages — not needed for the universal build
    excludes=[
        "torch",
        "torchvision",
        "torchaudio",
        "realesrgan",
        "basicsr",
        "facexlib",
        "gfpgan",
        "cv2",
        "cupy",
        "cupy_backends",
        # Unneeded large packages that may be pulled in transitively
        "IPython",
        "notebook",
        "jupyter",
        "matplotlib",
        "scipy",
        "sklearn",
        "pandas",
        # Alternative GUI toolkits (not used)
        "tkinter",
        "wx",
        "PyQt5",
        "PyQt6",
        "PySide2",
        "PySide6",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)  # noqa: F821

# ---------------------------------------------------------------------------
# Executable
# ---------------------------------------------------------------------------
exe = EXE(  # noqa: F821
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Livery-AI-Studio",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # Keep console window for real-time log output
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon="icon.ico",
)

# ---------------------------------------------------------------------------
# Collect (onedir — everything in one folder, no self-extracting archive)
# ---------------------------------------------------------------------------
coll = COLLECT(  # noqa: F821
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=f"Livery-AI-Studio-v{__version__}",
)
