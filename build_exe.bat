@echo off
setlocal EnableDelayedExpansion

:: ============================================================================
:: Livery AI Studio - EXE Build Script (no-upscale / universal build)
:: ============================================================================
::
:: Builds a self-contained Windows executable using PyInstaller.
:: GPU upscaling (Real-ESRGAN / PyTorch) is intentionally excluded so the
:: output runs on any Windows machine - no NVIDIA GPU required.
::
:: Prerequisites:
::   - Python 3.10+ (py launcher or python on PATH)
::   - Node.js 18+ (for rebuilding the React frontend)
::
:: Usage:
::   build_exe.bat                Build exe (uses existing static/ if current)
::   build_exe.bat --no-frontend  Skip React rebuild (faster, static/ must exist)
::
:: Output:
::   dist\Livery-AI-Studio-v<VERSION>::       Livery-AI-Studio.exe
::       static::       car_library::       livery_map.json
::       ...
::
:: After the build, zip the output folder and attach it to the GitHub release.
:: See RELEASE_GUIDE.md for the full publishing workflow.
:: ============================================================================

title Livery AI Studio - EXE Builder

set "APP_DIR=%~dp0"
set "BUILD_VENV=%APP_DIR%.build-venv"
set "SKIP_FRONTEND=0"

:: Parse arguments
:parse_args
if "%~1"=="" goto done_args
if /i "%~1"=="--no-frontend" ( set "SKIP_FRONTEND=1" & shift & goto parse_args )
shift & goto parse_args
:done_args

echo.
echo  ============================================
echo   Livery AI Studio - EXE Builder
echo  ============================================
echo.

:: Find Python 3.10+
set "PY_CMD="
for %%V in (3.14 3.13 3.12 3.11 3.10) do (
    if "!PY_CMD!"=="" (
        py -%%V --version >nul 2>&1
        if !errorlevel!==0 set "PY_CMD=py -%%V"
    )
)
if "%PY_CMD%"=="" (
    python --version >nul 2>&1
    if %errorlevel%==0 set "PY_CMD=python"
)
if "%PY_CMD%"=="" (
    echo  [ERROR] No Python 3.10+ found.
    echo  Download Python from https://www.python.org/downloads/
    pause & exit /b 1
)
echo  [OK] Python: %PY_CMD%

:: Build React frontend
if "%SKIP_FRONTEND%"=="1" (
    echo  [--] Skipping React frontend build
    goto build_venv
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  [WARN] Node.js not found - skipping frontend build.
    echo         If static\ is already up-to-date this is fine.
    echo         Install Node.js 18+ from https://nodejs.org/ if you need to rebuild.
    goto build_venv
)

echo.
echo  Building React frontend...
pushd "%APP_DIR%frontend"
call npm ci
if %errorlevel% neq 0 ( echo  [ERROR] npm ci failed & popd & pause & exit /b 1 )
call npm run build
if %errorlevel% neq 0 ( echo  [ERROR] npm run build failed & popd & pause & exit /b 1 )
popd
echo  [OK] Frontend built

:: Create/activate build venv
:build_venv
echo.
echo  Setting up build environment...
if not exist "%BUILD_VENV%\Scripts\activate.bat" (
    if exist "%BUILD_VENV%" rmdir /s /q "%BUILD_VENV%"
    %PY_CMD% -m venv "%BUILD_VENV%"
    if %errorlevel% neq 0 ( echo  [ERROR] Failed to create build venv & pause & exit /b 1 )
)
if not exist "%BUILD_VENV%\Scripts\activate.bat" (
    echo  [ERROR] Build venv is missing activate.bat - venv creation failed.
    pause & exit /b 1
)
call "%BUILD_VENV%\Scripts\activate.bat"
echo  [OK] Build venv ready

:: Install core dependencies
echo.
echo  Installing core Python dependencies (no GPU packages)...
"%BUILD_VENV%\Scripts\pip.exe" install --upgrade pip -q
"%BUILD_VENV%\Scripts\pip.exe" install -r "%APP_DIR%requirements.txt" -q
if %errorlevel% neq 0 ( echo  [ERROR] pip install failed & pause & exit /b 1 )

:: Windows-specific dependency (window management)
"%BUILD_VENV%\Scripts\pip.exe" install pywin32 -q

echo  [OK] Dependencies installed

:: Install PyInstaller
echo.
echo  Installing PyInstaller...
"%BUILD_VENV%\Scripts\pip.exe" install "pyinstaller>=6.0" -q
if %errorlevel% neq 0 ( echo  [ERROR] PyInstaller install failed & pause & exit /b 1 )
echo  [OK] PyInstaller ready

:: Clean previous build
echo.
echo  Cleaning previous build artifacts...
if exist "%APP_DIR%build" rmdir /s /q "%APP_DIR%build"
if exist "%APP_DIR%dist"  rmdir /s /q "%APP_DIR%dist"
echo  [OK] Clean

:: Run PyInstaller
echo.
echo  Running PyInstaller (this may take several minutes)...
echo.
"%BUILD_VENV%\Scripts\pyinstaller.exe" "%APP_DIR%livery_ai_studio.spec" --noconfirm
if %errorlevel% neq 0 (
    echo.
    echo  [ERROR] PyInstaller build failed. See output above for details.
    pause & exit /b 1
)

:: Report result
echo.
echo  ============================================
echo   Livery AI Studio - Build SUCCESS
echo  ============================================
for /f "delims=" %%D in ('dir /b "%APP_DIR%dist"') do set "DIST_NAME=%%D"
echo.
echo  Output folder: dist\%DIST_NAME%echo.
echo  Next steps:
echo    1. Test the exe: dist\%DIST_NAME%\Livery-AI-Studio.exe
echo    2. Zip the folder: dist\%DIST_NAME%
echo       (Right-click then Send to then Compressed folder, or use 7-Zip)
echo    3. Attach the zip to your GitHub release.
echo.
echo  See RELEASE_GUIDE.md for the full publishing checklist.
echo.
pause
