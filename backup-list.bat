@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP LIST for tgpinbot
:: ============================================

:: === CONFIG: Set project path here ===
set PROJECT_PATH=

if "%PROJECT_PATH%"=="" (
    echo.
    set /p PROJECT_PATH="Enter project path: "
)

set PROJECT_PATH=%PROJECT_PATH:"=%

if not exist "%PROJECT_PATH%\.git" (
    echo.
    echo ERROR: No Git in this folder!
    echo Path: %PROJECT_PATH%
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo ========================================
echo           BACKUP LIST v1.2
echo ========================================
echo.

echo Backup tags:
echo ----------------------------------------
git tag -l "v-backup-*" --sort=-creatordate

echo.
echo Backup branches:
echo ----------------------------------------
git branch -a | findstr "backup/"

echo.
echo Releases:
echo ----------------------------------------
git tag -l "v1.*" --sort=-creatordate

echo.
echo Repository status:
echo ----------------------------------------
git status -s

echo.
pause
