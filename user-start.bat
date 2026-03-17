@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Livery Gen AI — Custom User Start Script
REM ═══════════════════════════════════════════════════════════════════════════
REM
REM This is a template for you to customize your own startup command.
REM Edit the call below to match your preferences.
REM
REM Examples:
REM   start.bat --gpu                   (with GPU upscaling)
REM   start.bat --skip-install          (quick restart, no reinstall)
REM   start.bat --gpu --skip-install    (GPU upscaling, quick restart)
REM   start.bat --port 8080             (custom port)
REM   start.bat --web-only              (browser-only, no pywebview)
REM   start.bat --gpu --cuda 11         (GPU with CUDA 11 for RTX 30xx)
REM   start.bat --web-only --build-frontend  (browser mode + rebuild frontend)
REM
REM For full options, see README.md → "Start Script Options"
REM ═══════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "!SCRIPT_DIR!"
"%SCRIPT_DIR%start.bat" --gpu --skip-install --build-frontend --web-only
