# Troubleshooting Livery AI Studio

If you're experiencing issues running Livery AI Studio from a repo clone, this guide covers the most common problems and their solutions.

## Table of Contents

1. [Python Not Found](#python-not-found)
2. [PSD-Tools Build Error](#psd-tools-build-error)
3. [Stuck on Loading Screen](#stuck-on-loading-screen)
4. [Module/Import Errors](#moduleimport-errors)
5. [Windows-Specific Issues](#windows-specific-issues)
6. [macOS/Linux Issues](#macoslinux-issues)

---

## Python Not Found

### Error
```
[ERROR] No Python 3.10+ found.
Install Python 3.10+ from https://python.org
```

### Causes & Solutions

**1. Python not in PATH**
- Download and install Python from [python.org](https://python.org)
- **During installation, check: "Add Python to PATH"** ✓
- Restart your terminal after installation

**2. Multiple Python versions installed**
If you have Python 3.12 but start.bat is looking for 3.10-3.14, try:
```bash
python --version  # Check your version
```

**3. Python launcher (`py`) not installed**
Some Python installations (especially 3.14+ or portable versions) don't include the `py` launcher.

The updated `start.bat` now includes a fallback:
- First tries `py -3.10+` (if Windows Python launcher is available)
- Then tries `python` directly (if in PATH)

If you installed Python without the `py` launcher:
```bash
# Verify Python is in PATH
python --version

# Should output: Python 3.10+
```

---

## PSD-Tools Build Error

### Error
```
ERROR: Failed building wheel for psd-tools
error: failed-wheel-build-for-install
```

### Root Cause
`psd-tools` (used to extract car templates) requires C++ compilation on Windows. Pre-built wheels aren't always available for all Python versions.

### Solution: Install Visual Studio Build Tools

1. Download **Visual Studio Build Tools 2022** from:
   https://visualstudio.microsoft.com/visual-cpp-build-tools/

2. Run the installer and select:
   - ✓ **Desktop development with C++**
   - ✓ **MSVC v14.x C++ x64/x86 build tools**
   - ✓ **Windows 11 SDK** (or your OS version)

3. Close all terminals and restart

4. Run `start.bat` again

### Alternative: Use Pre-Built Binary
If you don't want to install build tools, use the compiled `.exe` release:
- Download from [GitHub Releases](https://github.com/jamesdhooks/livery-ai-studio/releases)
- No Python or build tools required

---

## Stuck on Loading Screen

### Symptoms
- App opens, shows splash screen, then freezes
- Browser console shows 304 responses for assets:
  ```
  GET /assets/index-DpnLbuTA.js HTTP/1.1" 304
  GET /assets/index-C9lLxQ8M.css HTTP/1.1" 304
  ```

### Root Cause
The frontend build files (`static/assets/*.js`, `static/assets/*.css`) are missing or not being served correctly. The 304 (Not Modified) response means Flask isn't properly serving the asset files.

### Solutions

**Option 1: Rebuild the Frontend** (if you have Node.js)
```bash
cd frontend
npm install
npm run build
cd ..
start.bat
```

**Option 2: Check the Build Output**
Verify `static/assets/` directory exists and has files:
```bash
# Windows
dir static\assets\

# macOS/Linux
ls -la static/assets/
```

If empty or missing, the build didn't complete. Go back to Option 1.

**Option 3: Use the Binary Release**
If you don't have Node.js installed, download the pre-built `.exe` from Releases — no build required.

---

## Module/Import Errors

### Error Examples
```
ModuleNotFoundError: No module named 'google'
ModuleNotFoundError: No module named 'psd_tools'
```

### Solution
These mean dependencies weren't installed. Try:

```bash
# Activate the virtual environment
.venv\Scripts\activate.bat    # Windows
source .venv/bin/activate      # macOS/Linux

# Reinstall
pip install -r requirements.txt

# On Windows, if psd-tools fails, install build tools first (see above)
```

If that fails, start fresh:
```bash
# Remove the venv and rebuild
rmdir .venv /s /q    # Windows
rm -rf .venv          # macOS/Linux

# Run start.bat (or start.sh)
start.bat
```

---

## Windows-Specific Issues

### Issue: "This app can't run on your PC"
**Cause:** Running a 32-bit Python on 64-bit Windows, or vice versa.

**Solution:** Install Python 3.10+ **64-bit** from [python.org](https://python.org)

### Issue: Permission Denied Errors
**Cause:** Antivirus or Windows Defender blocking file access.

**Solution:**
- Add this folder to Windows Defender exclusions:
  - Settings → Virus & threat protection → Manage settings
  - Add: `C:\Users\YourName\livery-ai-studio`
- Disable real-time scanning temporarily while starting

### Issue: Port 6173 Already in Use
```
Address already in use
```

**Solution:** Start on a different port:
```bash
start.bat --port 8080
```

---

## macOS/Linux Issues

### Issue: Permission Denied on `start.sh`
```bash
chmod +x start.sh
./start.sh
```

### Issue: Python 3.10+ Not Found
```bash
# macOS with Homebrew
brew install python@3.11

# Ubuntu/Debian
sudo apt-get install python3.11 python3.11-venv
```

### Issue: Pillow or psd-tools Build Fails
Install development headers:
```bash
# macOS
brew install python-tk jpeg libpng

# Ubuntu/Debian
sudo apt-get install python3-dev libjpeg-dev zlib1g-dev
```

Then retry:
```bash
./start.sh
```

---

## Getting Help

If you're still stuck:

1. **Check the logs:**
   ```bash
   # Windows: app.log in the repo root
   # macOS/Linux: check terminal output
   ```

2. **Post on GitHub:**
   - Open an issue: https://github.com/jamesdhooks/livery-ai-studio/issues
   - Include:
     - Your Python version (`python --version`)
     - OS and version (Windows 10/11, macOS version, etc.)
     - Full error message from the terminal
     - Output from `pip list`

3. **Check existing issues:**
   - Search GitHub for similar errors
   - See [CONTRIBUTING.md](CONTRIBUTING.md) for more context

---

## Quick Checklist

Before opening an issue, verify:

- [ ] Python 3.10+ is installed (`python --version`)
- [ ] Python is in PATH (`which python` or `where python`)
- [ ] Virtual environment exists (`.venv/` folder)
- [ ] Dependencies installed (`pip list` shows google-genai, flask, etc.)
- [ ] Frontend is built (`static/assets/` has files)
- [ ] No antivirus blocking the app
- [ ] Port 6173 is available (or you used `--port`)
