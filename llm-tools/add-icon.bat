@echo off
REM Helper script to add new Heroicons to the project
REM
REM Usage: add-icon.bat icon-name
REM Example: add-icon.bat arrow-right

if "%1"=="" (
    echo Usage: add-icon.bat ^<icon-name^>
    echo Example: add-icon.bat arrow-right
    echo.
    echo Available icons can be found at:
    echo   - https://heroicons.com
    echo   - node_modules\heroicons\24\outline\
    exit /b 1
)

set ICON_NAME=%1
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set SOURCE_FILE=%PROJECT_ROOT%\node_modules\heroicons\24\outline\%ICON_NAME%.svg
set DEST_FILE=%PROJECT_ROOT%\server\static\images\icons\%ICON_NAME%.svg

REM Check if heroicons is installed
if not exist "%PROJECT_ROOT%\node_modules\heroicons" (
    echo Installing heroicons...
    cd /d "%PROJECT_ROOT%" && call npm install
)

REM Check if the icon exists
if not exist "%SOURCE_FILE%" (
    echo Error: Icon '%ICON_NAME%' not found in node_modules\heroicons\24\outline\
    echo.
    echo Available icons:
    dir /b "%PROJECT_ROOT%\node_modules\heroicons\24\outline\" | more
    exit /b 1
)

REM Copy the icon
copy "%SOURCE_FILE%" "%DEST_FILE%" >nul
echo √ Copied %ICON_NAME%.svg to server\static\images\icons\
echo.
echo To use it in your HTML:
echo   ^<span class="icon-placeholder" data-icon="%ICON_NAME%" data-class="icon"^>^</span^>
echo.
echo To use it in JavaScript:
echo   icon('%ICON_NAME%', 'icon')
