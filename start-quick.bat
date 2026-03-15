@echo off
:: ============================================================
:: Livery Gen AI — Quick Restart (Skip pip install)
:: Use after first run to skip dependency checks.
:: ============================================================
call "%~dp0start.bat" --skip-install %*
