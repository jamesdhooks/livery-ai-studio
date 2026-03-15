@echo off
setlocal EnableDelayedExpansion

:: ========================================================================
:: Livery AI Studio - Start Script (Windows)
:: ========================================================================
:: Usage:
::   start.bat                       Launch (fresh venv, py -3.10+)
::   start.bat --gpu                 Also install GPU upscaling deps
::   start.bat --gpu --cuda 11       CUDA 11.x (RTX 30xx)
::   start.bat --gpu --cuda 12       CUDA 12.x (RTX 40xx, default)
::   start.bat --gpu --cuda 50       CUDA 12.8 nightly (RTX 50xx / Blackwell)
::   start.bat --port 8080           Use a custom port
::   start.bat --skip-install        Skip pip install (faster restart)
::   start.bat --build-frontend      Rebuild the React frontend (requires Node.js)
::
:: NOTE: The pre-built frontend is included in static/ — Node.js is NOT
:: required to run the app. Use --build-frontend only if you have modified
:: files in the frontend/ source directory.
:: ========================================================================

title Livery Gen AI

set "APP_DIR=%~dp0"
set "VENV_DIR=%APP_DIR%.venv"
set "PORT=5199"
set "INSTALL_GPU=0"
set "CUDA_VER=12"
set "SKIP_INSTALL=0"
set "BUILD_FRONTEND=0"

:: Parse arguments
:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--gpu"             ( set "INSTALL_GPU=1"    & shift & goto parse_args )
if /i "%~1"=="--skip-install"    ( set "SKIP_INSTALL=1"   & shift & goto parse_args )
if /i "%~1"=="--build-frontend"  ( set "BUILD_FRONTEND=1" & shift & goto parse_args )
if /i "%~1"=="--cuda"         ( set "CUDA_VER=%~2"   & shift & shift & goto parse_args )
if /i "%~1"=="--port"         ( set "PORT=%~2"        & shift & shift & goto parse_args )
shift & goto parse_args
:done_args

echo.
echo  ======================================
echo   Livery AI Studio
echo  ======================================
echo.

:: ── Find Python 3.10+ ────────────────────────────────────────────────────────
set "PY_CMD="
py -3.13 --version >nul 2>&1
if %errorlevel%==0 set "PY_CMD=py -3.13"
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

if "%PY_CMD%"=="" (
    echo  [ERROR] No Python 3.10+ found.
    echo  Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
echo  Python found: %PY_CMD%

:: ── Recreate venv ────────────────────────────────────────────────────────────
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

:: ── Install dependencies ──────────────────────────────────────────────────────
if "%SKIP_INSTALL%"=="1" goto launch

echo.
echo  Installing core dependencies...
"%VENV_DIR%\Scripts\python.exe" -m pip install --upgrade pip
"%VENV_DIR%\Scripts\pip.exe" install -r "%APP_DIR%requirements.txt"
if %errorlevel% neq 0 (
    echo  [ERROR] Failed to install dependencies.
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
    echo  Installing GPU upscaling dependencies...
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

:: ── Frontend build (optional — only needed after editing frontend/ sources) ──
if "%BUILD_FRONTEND%"=="1" (
    echo.
    echo  Building React frontend...
    where node >nul 2>&1
    if %errorlevel% neq 0 (
        echo  [ERROR] Node.js not found. Install from https://nodejs.org
        pause
        exit /b 1
    )
    if not exist "%APP_DIR%frontend\node_modules" (
        echo  Installing frontend dependencies...
        cd /d "%APP_DIR%frontend"
        call npm install
        if %errorlevel% neq 0 (
            echo  [ERROR] npm install failed.
            pause
            exit /b 1
        )
    )
    cd /d "%APP_DIR%frontend"
    call npm run build
    if %errorlevel% neq 0 (
        echo  [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
    cd /d "%APP_DIR%"
    echo  + Frontend built successfully
) else (
    echo  + Using pre-built frontend from static/
    echo    (Run with --build-frontend to rebuild after editing frontend/ sources)
)

:: ── Launch ────────────────────────────────────────────────────────────────────
:launch
echo.
echo  ======================================
echo   Launching on port %PORT%...
echo   Close this window or press CTRL+C to stop.
echo  ======================================
echo.

set "FLASK_PORT=%PORT%"
"%VENV_DIR%\Scripts\python.exe" "%APP_DIR%app.py"

echo.
echo  App stopped.
pause
pause
