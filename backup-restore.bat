@echo off

echo ========================================
echo        BACKUP RESTORE v2.0
echo ========================================
echo.

set /p PROJECT_PATH="Enter project path: "

set PROJECT_PATH=%PROJECT_PATH:"=%

if not exist "%PROJECT_PATH%\.git" (
    echo.
    echo ERROR: No Git found in this folder!
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo Available backups:
echo ----------------------------------------

git tag -l "v-backup-*" --sort=-creatordate
git tag -l "v1.*" --sort=-creatordate

echo.
set /p SELECTED_TAG="Enter tag name to restore: "

if "%SELECTED_TAG%"=="" (
    echo ERROR: No tag specified
    pause
    exit /b 1
)

echo.
echo WARNING! Rolling back to: %SELECTED_TAG%
echo This may cause loss of current changes!
echo.

set /p CONFIRM="Continue? (yes/no): "

if /i not "%CONFIRM%"=="yes" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo Rolling back to %SELECTED_TAG%...
git checkout %SELECTED_TAG%

if errorlevel 1 (
    echo ERROR: Rollback failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo      ROLLBACK COMPLETE!
echo ========================================
echo   Current version: %SELECTED_TAG%
echo ========================================
echo.
echo Next steps:
echo   1. Check if everything works
echo   2. To update master branch:
echo      git checkout -B master
echo      git push -f origin master
echo.

pause
