@echo off
:: ============================================================
:: Livery AI Studio — Start WITH Real-ESRGAN GPU Upscaling
:: Requires an NVIDIA GPU with 6+ GB VRAM and CUDA installed.
:: ============================================================
call "%~dp0start.bat" --realesrgan %*
