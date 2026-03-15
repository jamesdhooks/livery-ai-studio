@echo off
:: ============================================================
:: Livery Gen AI — Start WITH GPU Upscaling
:: Requires an NVIDIA GPU with 6+ GB VRAM and CUDA installed.
:: ============================================================
call "%~dp0start.bat" --gpu %*
