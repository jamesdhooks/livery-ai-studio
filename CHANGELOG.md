# Changelog

All notable changes to Livery AI Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.9.0-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.0-beta
