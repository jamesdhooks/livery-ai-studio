# Changelog

All notable changes to Livery AI Studio are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.9.3-beta] — 2026-03-19

### Fixed
- **GenerateTab crash** — `modeState[mode]` could be `undefined` during mode transitions, throwing "Cannot read properties of undefined (reading 'prompt')"

---

## [0.9.2-beta] — 2026-03-18

### Added
- **SeedVR2 diffusion resample** — New Resample mode in the Upscale tab alongside Real-ESRGAN 4×; downscales to 1024×1024, runs SeedVR2 diffusion upscale, outputs 2048×2048. Segmented mode control mirrors New/Modify pattern in GenerateTab
- **GGUF low-VRAM support** — `server/seedvr2.py` detects and uses GGUF quantized model when available, reducing VRAM requirements; `download_gguf.py` script downloads the 2.4 GB Q8_0 model with progress bar
- **Upscale Engine setting** — When SeedVR2 is available, Settings tab shows a toggle to choose between Real-ESRGAN (fast) and SeedVR2 (high quality) for auto-upscale after generation; persists as `upscale_engine` in config
- **`start.bat --seedvr` flag** — Clones `ComfyUI-SeedVR2_VideoUpscaler`, installs SeedVR2 dependencies and torch; works standalone or combined with `--gpu`
- **Specular tab** — Full spec map generation workflow using Gemini: prompt, reference image upload, model/resolution picker, generation progress, deploy to iRacing
- **Persistent spending log** — `server/spending.py` records every API transaction to `data/spending_log.json` with backfill migration from existing history sidecars; SpendingModal shows filterable history (today / week / overall)
- **Toast notification system** — `useToast` + `Toast` component + `ToastContext`; replaces ad-hoc `onNotify` prop callbacks app-wide
- **Generation progress component** — Real-time elapsed timer + animated progress bar during generation
- **ModelSelector component** — Shared model/resolution picker used in GenerateTab and SpecularTab
- **History sidebar filters** — Merged filter + select bars into single compact topbar; filter by current car or badge (Spec, 2K, Upscaled, etc.); select mode for bulk delete; active filter pills
- **Upscale/Resample metadata inheritance** — `/api/upscale` and `/api/resample` inherit source livery sidecar metadata (prompt, mode, model, car, customer_id, conversation_log, etc.) so results are properly associated in history
- **`seedvr_available` capability** — Exposed in `/api/config` GET response so the frontend can conditionally show SeedVR2 UI
- **`/api/resample` endpoint** — Mirrors `/api/upscale` pattern; saves `_resampled.tga`, updates sidecar JSON, returns `preview_b64`

### Changed
- **React Context architecture** — Eliminated prop drilling throughout the app by introducing a 9-provider context layer (AppProvider, ConfigContext, SessionContext, CarsContext, GenerationPrefsContext, HistoryContext, SpendingContext, GenerateContext, UpscaleContext, SpecularContext, ToastContext). Tab prop counts reduced from 8–40 props down to 0–12
- **App.jsx** — Rewritten from 541 to ~280 lines; no longer calls hooks directly for shared state
- **Two-bag modeState** — Separate session state bags for New vs Modify modes prevent cross-mode bleed on tab switch; debounced via `debouncedSaveModeState`
- **Loading screen** — Converted from early return to fixed overlay (z-[9999]) to enable CSS fade-out transition; 2-second minimum display time; HTML and React loading screens coordinate fade and unmount together
- **Flask port** — Changed from 5199 → 6173 to avoid Vite dev server collision
- **FileUploader** — Loading spinner and red X clear button; fixed heights (`h-48`) on upload containers
- **Improved specular icon** — Polished sphere with reflection highlight in both TopBar nav and LiveryDetailPanel action bar
- **`start.bat`** — Refactored with `goto` labels and `taskkill` for proper Ctrl+C handling; added `--build-frontend` and `--gpu` flags

### Fixed
- **"Iterate on This" flow** — Clicking Iterate on This from GenerateTab now correctly switches to Modify mode and applies the base texture; previously the session path was saved but never applied to the active form state
- **`UpscaleService.upscale()`** — Fixed to send `path` key (matching backend expectation) instead of `source_path`
- **Deploy endpoint null safety** — `/api/deploy` no longer throws AttributeError when request body or fields are missing
- **Test suite** — Updated `HistoryService` and `UpscaleService` tests to match actual API method signatures

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

[0.9.3-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.3-beta
[0.9.2-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.2-beta
[0.9.1-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.1-beta
[0.9.0-beta]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/v0.9.0-beta
