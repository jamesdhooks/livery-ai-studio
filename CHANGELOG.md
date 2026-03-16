# Changelog

All notable changes to Livery AI Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.1-beta] — 2026-03-16

### Fixed
- **pywebview WinForms startup failure** — Added graceful fallback to open the app in the default web browser when pythonnet / .NET Framework is unavailable or DLLs are blocked (OneDrive sync, antivirus, etc.). Flask backend always starts first so full functionality is preserved in the fallback
- **Build environment Python version detection** — Fixed broken loop in `build_exe.bat` that was silently falling through to a Python 3.9 fallback; added Python 3.14 support to both `start.bat` and `build_exe.bat`
- **`google-genai` version pin** — Corrected requirement from `>=1.56.0` (non-existent on PyPI) to `>=1.47.0`
- **Python 3.9 type-hint compatibility** — Added `from __future__ import annotations` to `server/deploy.py` and `server/generate.py` so `X | Y` union syntax works on Python 3.9+
- **Enhance guidance save wiping config** — `POST /api/enhance-guidance` was calling `save_config({"enhance_guidance": ...})` which replaced the entire config object; fixed to load-then-patch
- **Deploy to iRacing field name mismatch** — Frontend was sending `livery_path`/`car_name` but server expected `path`/`car_folder`; corrected in `UpscaleService.js`
- **Download button** — Rewritten to trigger a native Save-As dialog via `/api/download-file`, saving the source TGA directly rather than attempting a browser download of a server-side URL
- **"Iterate on This" flow** — Clicking Iterate on This from the Generate or History tab now correctly switches to Modify mode and sets the base texture to the selected livery; previously the session path was saved but never applied to the active form state

### Added
- **Troubleshooting: result not matching wireframe** — New entry in README and Getting Started FAQ explaining that AI alignment is approximate, with tips on simpler prompts and iterating

---

## [0.9.0-beta] — 2026-03-15

### Added
- Initial public beta release
- Complete React + Tailwind CSS frontend redesign
- Comprehensive test suite with 139+ tests
- CI/CD pipeline with GitHub Actions

#### Core Generation
- AI-powered livery generation using Google Gemini (gemini-2.0-flash / gemini-2.5-pro)

#### Car Library
- 180+ pre-extracted car templates from trading paints bundled at launch (wireframe + diffuse previews)

#### History & Deployment
- Full generation history with metadata (prompt, model, cost, timestamps)

#### Image Processing
- Lanczos upscaling to 2048×2048 (works on any machine)
- Optional GPU upscaling via Real-ESRGAN 4× (NVIDIA GPU, installed separately)

#### Packaging
- `version.py` — single source of truth for the application version
- `livery_ai_studio.spec` — PyInstaller spec for reproducible no-upscale exe builds
- `build_exe.bat` — one-command local build script
- GitHub Actions release workflow (`.github/workflows/release.yml`) — builds and
  publishes the exe automatically when a version tag is pushed

---

<!-- Template for future releases:

## [X.Y.Z] — YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed

-->

[0.9.1-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.1-beta
[0.9.0-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.0-beta
