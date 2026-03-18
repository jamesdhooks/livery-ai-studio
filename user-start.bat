@echo off
REM ═══════════════════════════════════════════════════════════════════════════
REM Livery AI Studio — Custom User Start Script
REM ═══════════════════════════════════════════════════════════════════════════
REM
REM This is a template for you to customize your own startup command.
REM Edit the call below to match your preferences.
REM
REM Examples:
REM   start.bat --realesrgan                    (install Real-ESRGAN upscaling)
REM   start.bat --seedvr                        (install SeedVR2 upscaling)
REM   start.bat --realesrgan --seedvr           (install both upscale engines)
REM   start.bat --skip-install                  (quick restart, no reinstall)
REM   start.bat --realesrgan --skip-install     (quick restart with Real-ESRGAN)
REM   start.bat --port 8080                     (custom port)
REM   start.bat --web-only                      (browser-only, no pywebview)
REM   start.bat --realesrgan --cuda 11          (Real-ESRGAN with CUDA 11 for RTX 30xx)
REM   start.bat --web-only --build-frontend     (browser mode + rebuild frontend)
REM
REM For full options, see README.md → "Start Script Options"
REM ═══════════════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion
set "SCRIPT_DIR=%~dp0"
cd /d "!SCRIPT_DIR!"
call "%SCRIPT_DIR%start.bat" --realesrgan --seedvr --web-only --build-frontend
@REM call "%SCRIPT_DIR%start.bat" --realesrgan --seedvr --web-only --build-frontend 

