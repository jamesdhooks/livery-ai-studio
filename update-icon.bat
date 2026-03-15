@echo off
:: Regenerate icon.ico from icon.png
:: Run this whenever icon.png is updated.

set "APP_DIR=%~dp0"

echo Regenerating icon.ico from icon.png...
"%APP_DIR%.venv\Scripts\python.exe" -c ^
"from PIL import Image; img = Image.open('icon.png').convert('RGBA'); img.save('icon.ico', format='ICO', sizes=[(256,256),(64,64),(48,48),(32,32),(16,16)]); print('icon.ico updated')"

if %errorlevel% neq 0 (
    echo [ERROR] Failed to generate icon.ico. Make sure the .venv is set up.
    pause & exit /b 1
)
echo Done.
