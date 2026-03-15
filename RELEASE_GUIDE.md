# Release Guide — Livery AI Studio

This document walks you through everything needed to publish a professional
release of Livery AI Studio on GitHub, from version bump to the
live release page.

---

## Contents

1. [Overview of the release system](#1-overview-of-the-release-system)
2. [Pre-release checklist](#2-pre-release-checklist)
3. [Bump the version](#3-bump-the-version)
4. [Build the Windows exe locally (optional)](#4-build-the-windows-exe-locally-optional)
5. [Update CHANGELOG.md](#5-update-changelogmd)
6. [Tag and push — triggering the automated release](#6-tag-and-push--triggering-the-automated-release)
7. [Review and publish the draft release on GitHub](#7-review-and-publish-the-draft-release-on-github)
8. [Post-release steps](#8-post-release-steps)
9. [Manual release (if CI is unavailable)](#9-manual-release-if-ci-is-unavailable)
10. [Versioning policy](#10-versioning-policy)

---

## 1. Overview of the release system

| File / Workflow | Purpose |
|---|---|
| `version.py` | Single source of truth for the app version (`__version__`) |
| `livery_ai_studio.spec` | PyInstaller spec — reproducible no-upscale exe build |
| `build_exe.bat` | One-command local build script for Windows |
| `.github/workflows/release.yml` | Automated CI build triggered by a `v*` tag push |
| `CHANGELOG.md` | Keep-a-Changelog formatted release notes |

**How it works end-to-end:**

```
You bump version.py  →  commit + push  →  git tag v1.0.0  →  git push origin v1.0.0
                                                           ↓
                                           GitHub Actions picks up the tag
                                                           ↓
                               Builds React frontend  →  Runs PyInstaller
                                                           ↓
                               Creates dist/Livery-AI-Studio-v1.0.0.zip
                                                           ↓
                               Creates a DRAFT GitHub Release with zip attached
                                                           ↓
                               You review the draft  →  Click "Publish release"
```

---

## 2. Pre-release checklist

Work through this list before creating the tag:

- [ ] All intended features are merged to `main`
- [ ] All tests pass: `cd frontend && npm test`
- [ ] The React build is clean: `cd frontend && npm run build` (no errors)
- [ ] `app.py` runs correctly from source (`python app.py`)
- [ ] `version.py` has the correct new version number (see §3)
- [ ] `frontend/package.json` version matches `version.py`
- [ ] `CHANGELOG.md` has a section for the new version (see §5)
- [ ] `README.md` is up to date (Quick Start, requirements, feature list)
- [ ] No secrets or API keys are committed (`config.json` is gitignored)
- [ ] `.gitignore` excludes `dist/`, `build/`, `data/`, `config.json`

---

## 3. Bump the version

**All version changes happen in two places:**

### `version.py` (Python / exe)

```python
__version__ = "1.0.0"   # ← change this
```

### `frontend/package.json` (frontend)

```json
{
  "version": "1.0.0"    // ← change this to match
}
```

Keep both numbers in sync. The PyInstaller spec reads `version.py` to name the
output folder (`Livery-AI-Studio-v<VERSION>`), and the GitHub Actions
workflow derives the release name from the pushed tag.

---

## 4. Build the Windows exe locally (optional)

You can build and test the exe before pushing the tag.

### Requirements

| Tool | Minimum version | Install |
|---|---|---|
| Python | 3.10 | [python.org](https://www.python.org/downloads/) |
| Node.js | 18 | [nodejs.org](https://nodejs.org/) |
| Git | any | — |

### Steps

```bat
:: From the repo root on Windows:
build_exe.bat
```

The script will:
1. Build the React frontend (`npm ci && npm run build`)
2. Create an isolated `.build-venv` Python environment
3. Install core deps + PyInstaller (no GPU packages)
4. Run `pyinstaller livery_ai_studio.spec`

**Output:** `dist\Livery-AI-Studio-v1.0.0\`

### Test the exe

1. Open `dist\Livery-AI-Studio-v1.0.0\`
2. Run `Livery-AI-Studio.exe`
3. The console window opens, then the app window appears
4. Paste a Gemini API key in Settings and test a generation

### Skip the frontend rebuild (faster)

If `static\` is already up-to-date, skip the Node.js step:

```bat
build_exe.bat --no-frontend
```

---

## 5. Update CHANGELOG.md

Add a new section above the previous release, following this template:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Brief description of new feature

### Changed
- What changed in an existing feature

### Fixed
- Bug that was fixed

### Removed
- Feature that was removed
```

Add a link at the bottom of the file:

```markdown
[X.Y.Z]: https://github.com/jamesdhooks/livery-ai-studio/releases/tag/vX.Y.Z
```

The GitHub Actions workflow uses `CHANGELOG.md` as the release body, so whatever
is in this file becomes the public release notes automatically.

---

## 6. Tag and push — triggering the automated release

Once the version is bumped, the changelog is updated, and all changes are
committed and pushed to `main`:

```bash
# Make sure you are on main and up to date
git checkout main
git pull origin main

# Create an annotated tag
git tag -a v1.0.0 -m "Release v1.0.0"

# Push the tag — this triggers the GitHub Actions release workflow
git push origin v1.0.0
```

> **Tip:** If you accidentally pushed the wrong tag, delete it and re-push:
> ```bash
> git tag -d v1.0.0
> git push origin --delete v1.0.0
> ```

### What happens in CI

Go to **Actions → Release** on GitHub to watch the build.  It will:

| Step | Time (approx.) |
|---|---|
| Checkout | ~30 s |
| Build frontend | ~1 min |
| Install Python deps + PyInstaller | ~3–5 min |
| PyInstaller build | ~5–10 min |
| Package zip | ~1–2 min |
| Create draft release | ~10 s |

Total: **~10–20 minutes**

---

## 7. Review and publish the draft release on GitHub

1. Go to **github.com/jamesdhooks/livery-ai-studio/releases**
2. You will see a **Draft** release named `Livery AI Studio vX.Y.Z`
3. Click **Edit** (pencil icon)
4. Review the auto-populated release notes from `CHANGELOG.md`
5. Verify the attached zip file is present (`Livery-AI-Studio-vX.Y.Z.zip`)
6. Optionally add a release banner image or additional notes
7. Check the correct tag is selected
8. Click **Publish release**

### Recommended release description additions

Consider adding above the changelog content:

```markdown
## ⬇️ Download

| File | Platform | Notes |
|---|---|---|
| `Livery-AI-Studio-v1.0.0.zip` | Windows 10/11 (64-bit) | No GPU required |

### Quick start
1. Extract the zip to a folder of your choice
2. Run `Livery-AI-Studio.exe`
3. Go to **Settings** and enter your [Gemini API key](https://aistudio.google.com/apikey)
4. Select a car and generate your first livery!

> **GPU upscaling** (optional, NVIDIA only): not included in this build.
> Run from source with `start.bat --gpu` for Real-ESRGAN upscaling.
```

---

## 8. Post-release steps

After publishing:

- [ ] Verify the release page looks correct on GitHub
- [ ] Download and test the zip on a clean Windows machine (no Python/Node)
- [ ] Post announcement if desired (iRacing forums, Discord, etc.)
- [ ] Update `README.md` if the download link or instructions changed
- [ ] Start the next development cycle: bump `version.py` to the next
      `MAJOR.MINOR.PATCH-dev` (e.g., `1.1.0-dev`) on `main`

---

## 9. Manual release (if CI is unavailable)

If GitHub Actions is not available or fails, build and publish manually:

```bat
:: 1. Build locally (Windows)
build_exe.bat

:: 2. Zip the output
::    Open dist\ in Explorer → right-click Livery-AI-Studio-v1.0.0 →
::    Send to → Compressed (zipped) folder

:: 3. Create the release on GitHub
::    github.com/jamesdhooks/livery-ai-studio/releases/new
::    - Tag: v1.0.0
::    - Title: Livery AI Studio v1.0.0
::    - Description: paste contents of CHANGELOG.md for this version
::    - Attach: Livery-AI-Studio-v1.0.0.zip
```

---

## 10. Versioning policy

This project uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

| Component | When to increment |
|---|---|
| `MAJOR` | Breaking changes (e.g., config format change, API incompatibility) |
| `MINOR` | New features that are backwards compatible |
| `PATCH` | Bug fixes, performance improvements, documentation updates |

**Examples:**
- `1.0.0` — initial public release
- `1.1.0` — new feature added (e.g., batch generation)
- `1.1.1` — bug fix release
- `2.0.0` — breaking change (e.g., config.json schema changed)

---

*For questions, open an issue at
[github.com/jamesdhooks/livery-ai-studio](https://github.com/jamesdhooks/livery-ai-studio/issues).*
