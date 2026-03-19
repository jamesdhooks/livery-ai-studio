@echo off
setlocal EnableDelayedExpansion

:: ========================================================================
:: Livery AI Studio - Start Script (Windows)
:: ========================================================================
:: Usage:
::   start.bat                           Launch (fresh venv, py -3.10+)
::   start.bat --realesrgan               Install Real-ESRGAN GPU upscaling
::   start.bat --realesrgan --cuda 11     CUDA 11.x (RTX 30xx)
::   start.bat --realesrgan --cuda 12     CUDA 12.x (RTX 40xx, default)
::   start.bat --realesrgan --cuda 50     CUDA 12.8 nightly (RTX 50xx / Blackwell)
::   start.bat --seedvr                   Install SeedVR2 diffusion upscaler
::   start.bat --realesrgan --seedvr      Install both upscale engines
::   start.bat --port 8080                Use a custom port
::   start.bat --skip-install             Skip pip install (faster restart)
::   start.bat --build-frontend           Rebuild the React frontend (requires Node.js)
::   start.bat --web-only                 Launch in browser instead of pywebview window
::   start.bat --auto-load                Dev mode: HMR + hot reload (implies --web-only)
::
:: NOTE: The pre-built frontend is included in static/ � Node.js is NOT
:: required to run the app. Use --build-frontend only if you have modified
:: files in the frontend/ source directory.
:: ========================================================================

title Livery Gen AI

set "APP_DIR=%~dp0"
set "VENV_DIR=%APP_DIR%.venv"
set "PORT=6173"
set "INSTALL_GPU=0"
set "CUDA_VER=12"
set "INSTALL_SEEDVR=0"
set "SKIP_INSTALL=0"
set "BUILD_FRONTEND=0"
set "WEB_ONLY=0"
set "AUTO_LOAD=0"

:: Parse arguments
:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--realesrgan"       ( set "INSTALL_GPU=1"    & shift & goto parse_args )
if /i "%~1"=="--seedvr"          ( set "INSTALL_SEEDVR=1" & shift & goto parse_args )
if /i "%~1"=="--skip-install"    ( set "SKIP_INSTALL=1"   & shift & goto parse_args )
if /i "%~1"=="--build-frontend"  ( set "BUILD_FRONTEND=1" & shift & goto parse_args )
if /i "%~1"=="--web-only"        ( set "WEB_ONLY=1"       & shift & goto parse_args )
if /i "%~1"=="--auto-load"       ( set "AUTO_LOAD=1" & set "WEB_ONLY=1" & shift & goto parse_args )
if /i "%~1"=="--cuda"         ( set "CUDA_VER=%~2"   & shift & shift & goto parse_args )
if /i "%~1"=="--port"         ( set "PORT=%~2"        & shift & shift & goto parse_args )
shift & goto parse_args
:done_args

echo.
echo  ======================================
echo   Livery AI Studio
echo  ======================================
echo.

:: ?? Find Python 3.10+ ????????????????????????????????????????????????????????
set "PY_CMD="

:: Try the py launcher first (if installed)
py -3.14 --version >nul 2>&1
if %errorlevel%==0 set "PY_CMD=py -3.14"
if "%PY_CMD%"=="" (
    py -3.13 --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=py -3.13"
)
if "%PY_CMD%"=="" (
    py -3.12 --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=py -3.12"
)
if "%PY_CMD%"=="" (
    py -3.11 --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=py -3.11"
)
if "%PY_CMD%"=="" (
    py -3.10 --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=py -3.10"
)

:: Fallback: try 'python' directly if py launcher failed
if "%PY_CMD%"=="" (
    python --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=python"
)

if "%PY_CMD%"=="" (
    echo  [ERROR] No Python 3.10+ found.
    echo  Install Python 3.10+ from https://python.org
    echo  OR ensure 'python' is in your PATH
    pause
    exit /b 1
)
echo  Python found: %PY_CMD%

:: ?? Check for Visual Studio Build Tools (required for psd-tools on Python 3.12+) ?
echo.
echo  Checking for C++ build tools...
where cl.exe >nul 2>&1
if %errorlevel% neq 0 (
    where clang.exe >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [WARNING] C++ build tools not found. psd-tools may fail to install.
        echo.
        echo  To fix, install one of:
        echo    • Visual Studio 2022 with "Desktop development with C++"
        echo    • MinGW-w64 and add to PATH
        echo    • Clang via LLVM
        echo.
        echo  Without build tools, pip will try pre-built wheels (may not exist for your Python version^)
        echo.
    )
) else (
    echo  + C++ build tools found
)

:: ?? Recreate venv ????????????????????????????????????????????????????????????
if not exist "%VENV_DIR%" (
    echo  Creating virtual environment...
    %PY_CMD% -m venv "%VENV_DIR%"
    if %errorlevel% neq 0 (
        echo  [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo  + Virtual environment created
) else (
    echo  + Virtual environment already exists
)

call "%VENV_DIR%\Scripts\activate.bat"
echo  + Virtual environment activated

:: ?? Install dependencies ??????????????????????????????????????????????????????
if "%SKIP_INSTALL%"=="1" goto skip_installs

echo.
echo  Installing core dependencies...
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%VENV_DIR%\Scripts\pip.exe" install -r "%APP_DIR%requirements.txt"
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] Failed to install dependencies.
    echo.
    echo  Common causes:
    echo    • psd-tools build failed: Install Visual Studio Build Tools with C++ support
    echo    • Missing Python development headers: Ensure Python was installed correctly
    echo    • Network error: Check internet connection and try again
    echo.
    echo  For help, see: CONTRIBUTING.md or open an issue on GitHub
    echo.
    pause
    exit /b 1
)

echo  + Core dependencies installed

"%VENV_DIR%\Scripts\pip.exe" install "pywin32>=306"
:: Run pywin32 post-install so pythonnet/clr works
"%VENV_DIR%\Scripts\python.exe" "%VENV_DIR%\Scripts\pywin32_postinstall.py" -install >nul 2>&1
echo  + Windows extras installed

if "%INSTALL_GPU%"=="1" (
    echo.
    echo  Installing Real-ESRGAN GPU upscaling...
    :: Auto-detect GPU CUDA capability if --cuda not explicitly set
    if "!CUDA_VER!"=="12" (
        :: Check nvidia-smi for RTX 50xx series (Blackwell)
        nvidia-smi --query-gpu=name --format=csv,noheader 2>nul | findstr /I "5070 5080 5090" >nul
        if !errorlevel! equ 0 (
            echo  [AUTO] Detected RTX 50xx - using CUDA 12.8 nightly
            set "CUDA_VER=50"
        )
    )
    if "!CUDA_VER!"=="11" goto install_cu118
    if "!CUDA_VER!"=="50" goto install_cu128_nightly
    goto install_cu124
)
goto post_gpu

:install_cu118
echo  Using CUDA 11.8 (RTX 30xx series)
"%VENV_DIR%\Scripts\pip.exe" install torch torchvision --index-url https://download.pytorch.org/whl/cu118
goto install_realesrgan

:install_cu124
echo  Using CUDA 12.4 (RTX 40xx series)
"%VENV_DIR%\Scripts\pip.exe" install torch torchvision --index-url https://download.pytorch.org/whl/cu124
goto install_realesrgan

:install_cu128_nightly
echo  Using PyTorch nightly + CUDA 12.8 (RTX 50xx / Blackwell series)
"%VENV_DIR%\Scripts\pip.exe" install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128
goto install_realesrgan

:install_realesrgan
"%VENV_DIR%\Scripts\pip.exe" install realesrgan
echo  + GPU packages installed
echo  Patching basicsr for torchvision compatibility...
"%VENV_DIR%\Scripts\python.exe" "%APP_DIR%patch_basicsr.py"
"%VENV_DIR%\Scripts\python.exe" "%APP_DIR%setup.py" --upscale

:post_gpu

:: ── SeedVR2 installation (optional — diffusion-based resample/upscale) ───────
if "%INSTALL_SEEDVR%"=="1" (
    echo.
    echo  Installing SeedVR2 diffusion upscaler...

    :: Ensure torch is installed (SeedVR2 needs it even without Real-ESRGAN)
    "%VENV_DIR%\Scripts\python.exe" -c "import torch" >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [INFO] torch not found — installing CUDA 12.4 PyTorch for SeedVR2...
        if "!CUDA_VER!"=="11" (
            "%VENV_DIR%\Scripts\pip.exe" install torch torchvision --index-url https://download.pytorch.org/whl/cu118
        ) else if "!CUDA_VER!"=="50" (
            "%VENV_DIR%\Scripts\pip.exe" install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu128
        ) else (
            "%VENV_DIR%\Scripts\pip.exe" install torch torchvision --index-url https://download.pytorch.org/whl/cu124
        )
    )

    :: Clone the SeedVR2 repo if not already present
    if not exist "%APP_DIR%seedvr2_videoupscaler" (
        echo  Cloning SeedVR2 repository...
        where git >nul 2>&1
        if %errorlevel% neq 0 (
            echo  [ERROR] Git not found. Install Git from https://git-scm.com
            echo  SeedVR2 requires Git to clone the repository.
            goto post_seedvr
        )
        cd /d "%APP_DIR%"
        git clone https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler.git seedvr2_videoupscaler
        if %errorlevel% neq 0 (
            echo  [ERROR] Failed to clone SeedVR2 repository.
            goto post_seedvr
        )
        echo  + SeedVR2 repository cloned
    ) else (
        echo  + SeedVR2 repository already exists
    )

    :: Install SeedVR2 requirements
    if exist "%APP_DIR%seedvr2_videoupscaler\requirements.txt" (
        echo  Installing SeedVR2 dependencies...
        "%VENV_DIR%\Scripts\pip.exe" install -r "%APP_DIR%seedvr2_videoupscaler\requirements.txt"
        echo  + SeedVR2 dependencies installed
    )

    :: Download SeedVR2 GGUF model for low-VRAM usage
    echo.
    echo  Checking for SeedVR2 GGUF model...
    if not exist "%APP_DIR%seedvr2_videoupscaler\models\SEEDVR2\seedvr2_ema_3b-Q8_0.gguf" (
        echo.
        echo  ======================================
        echo   SeedVR2 GGUF Model
        echo  ======================================
        echo  The quantized GGUF model is optional but recommended for low-VRAM systems.
        echo  SeedVR2 will fall back to the default FP8 model if download fails.
        echo.
        "%VENV_DIR%\Scripts\python.exe" "%APP_DIR%download_gguf.py" "%APP_DIR%seedvr2_videoupscaler\models\SEEDVR2"
        echo.
        if !errorlevel! equ 0 (
            echo  + GGUF model ready for use
        ) else (
            echo  [INFO] GGUF model download skipped - SeedVR2 will use default FP8 model
            echo  If you need low-VRAM support, download manually from:
            echo    https://huggingface.co/numz/SeedVR2/resolve/main/seedvr2_ema_3b-Q8_0.gguf
            echo  And save to: %APP_DIR%seedvr2_videoupscaler\models\SEEDVR2\seedvr2_ema_3b-Q8_0.gguf
            echo.
        )
    ) else (
        echo  + SeedVR2 GGUF model already present
        echo.
    )
    echo  + SeedVR2 installation complete
)

:skip_installs

:: ?? Frontend build (if requested) ?????????????????????????????????????????????????????????
if "%BUILD_FRONTEND%"=="0" goto skip_build

echo.
echo  Building React frontend...

set "npm_cmd="

:: Check common installation paths (avoids calling npm.cmd directly from bash context)
if exist "C:\Program Files\nodejs\npm.cmd" (
    set "npm_cmd=C:\Program Files\nodejs\npm.cmd"
) else if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
    set "npm_cmd=C:\Program Files (x86)\nodejs\npm.cmd"
) else if exist "%APPDATA%\nvm\npm.cmd" (
    set "npm_cmd=%APPDATA%\nvm\npm.cmd"
) else if exist "%APPDATA%\npm\npm.cmd" (
    set "npm_cmd=%APPDATA%\npm\npm.cmd"
) else if exist "%ProgramFiles%\nodejs\npm.cmd" (
    set "npm_cmd=%ProgramFiles%\nodejs\npm.cmd"
) else (
    for /f "delims=" %%i in ('where.exe npm.cmd 2^>nul') do (
        set "npm_cmd=%%i"
        goto :npm_found
    )
    for /f "delims=" %%i in ('where.exe npm 2^>nul') do (
        set "npm_cmd=%%i"
        goto :npm_found
    )
)

:npm_found

if "%npm_cmd%"=="" (
    echo  [ERROR] npm not found.
    echo  Please install Node.js from https://nodejs.org
    echo  Or ensure your Node.js installation is in the PATH.
    pause
    exit /b 1
)

echo  + npm found: %npm_cmd%

if not exist "%APP_DIR%frontend\node_modules" (
    echo  Installing frontend dependencies...
    cd /d "%APP_DIR%frontend"
    call %npm_cmd% install
    if !errorlevel! neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    cd /d "%APP_DIR%"
)

echo  Building frontend...
cd /d "%APP_DIR%frontend"
call %npm_cmd% run build
if !errorlevel! neq 0 (
    echo  [ERROR] Frontend build failed.
    pause
    exit /b 1
)
echo  + Frontend built successfully
cd /d "%APP_DIR%"

:skip_build

:: ?? Launch ????????????????????????????????????????????????????????????????????????
if /i "%AUTO_LOAD%"=="1" goto do_auto_load
echo.
echo  + Using pre-built frontend from static/
echo    (Run with --build-frontend to rebuild after editing frontend/ sources)
goto launch

:do_auto_load
echo.
echo  Starting frontend dev server with HMR...

:: Attempt to find and use npm
set "npm_cmd="

:: First try: npm in PATH
npm --version >nul 2>&1
if %errorlevel%==0 (
    set "npm_cmd=npm"
)

:: Second try: Common installation paths
if "!npm_cmd!"=="" (
    if exist "C:\Program Files\nodejs\npm.cmd" (
        set "npm_cmd=C:\Program Files\nodejs\npm.cmd"
    )
)
if "!npm_cmd!"=="" (
    if exist "C:\Program Files (x86)\nodejs\npm.cmd" (
        set "npm_cmd=C:\Program Files (x86)\nodejs\npm.cmd"
    )
)

:: Third try: Check AppData for nvm or similar
if "!npm_cmd!"=="" (
    if exist "%APPDATA%\nvm\npm.cmd" (
        set "npm_cmd=%APPDATA%\nvm\npm.cmd"
    )
)

if "!npm_cmd!"=="" (
    echo  [ERROR] npm not found.
    echo  Please install Node.js from https://nodejs.org
    echo  Or ensure your Node.js installation is in the PATH.
    pause
    exit /b 1
)

echo  + npm found: !npm_cmd!

if not exist "%APP_DIR%frontend\node_modules" (
    echo  Installing frontend dependencies...
    cd /d "%APP_DIR%frontend"
    call !npm_cmd! install
    if !errorlevel! neq 0 (
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    cd /d "%APP_DIR%frontend"
)

cd /d "%APP_DIR%frontend"
echo  + Frontend dev server starting (HMR enabled)
echo.
REM Start Flask in background, then Vite dev server in foreground
start "Livery AI Studio - Flask Backend" /B "%VENV_DIR%\Scripts\python.exe" "%APP_DIR%app.py"
ping -n 3 127.0.0.1 >nul 2>&1
echo  + Flask backend started on port 6173
echo  + Press CTRL+C to stop both servers
call !npm_cmd! run dev
REM Kill Flask process when npm dev exits (user pressed Ctrl+C)
taskkill /FI "WINDOWTITLE eq Livery AI Studio - Flask Backend" /T /F >nul 2>&1
exit /b 0

:launch
echo.
echo  ======================================
echo   Launching on port %PORT%...
echo   Close this window or press CTRL+C to stop.
echo  ======================================
echo.

set "FLASK_PORT=%PORT%"
set "WEB_ONLY=%WEB_ONLY%"
"%VENV_DIR%\Scripts\python.exe" "%APP_DIR%app.py"

echo.
echo  App stopped.
pause

