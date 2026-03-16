@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Livery Gen AI — Custom User Start Script
REM ═══════════════════════════════════════════════════════════════════════════
REM
REM This is a template for you to customize your own startup command.
REM Edit the call below to match your preferences.
REM
REM Examples:
REM   call "%~dp0start.bat" --gpu                   (with GPU upscaling)
REM   call "%~dp0start.bat" --skip-install          (quick restart, no reinstall)
REM   call "%~dp0start.bat" --gpu --skip-install    (GPU upscaling, quick restart)
REM   call "%~dp0start.bat" --port 8080             (custom port)
REM   call "%~dp0start.bat" --web-only              (browser-only, no pywebview)
REM   call "%~dp0start.bat" --gpu --cuda 11         (GPU with CUDA 11 for RTX 30xx)
REM   call "%~dp0start.bat" --web-only --build-frontend  (browser mode + rebuild frontend)
REM
REM For full options, see README.md → "Start Script Options"
REM ═══════════════════════════════════════════════════════════════════════════

call "%~dp0start.bat" --gpu --build-frontend
