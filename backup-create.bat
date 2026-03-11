@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP CREATOR for tgpinbot
:: ============================================

:: === CONFIG: Set project path here ===
:: If empty - will ask on startup
set PROJECT_PATH=

:: If path not set - ask user
if "%PROJECT_PATH%"=="" (
    echo.
    echo ========================================
    echo        BACKUP CREATOR v1.2
    echo ========================================
    echo.
    set /p PROJECT_PATH="Enter project path: "
)

:: Remove quotes if present
set PROJECT_PATH=%PROJECT_PATH:"=%

:: Go to project folder
if not exist "%PROJECT_PATH%\.git" (
    echo.
    echo ERROR: No Git in this folder!
    echo Path: %PROJECT_PATH%
    echo.
    echo Enter path to folder with .git folder
    echo Example: C:\Users\Name\Projects\tgpinbot
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo ========================================
echo        BACKUP CREATOR v1.2
echo ========================================
echo.
echo Project: %PROJECT_PATH%
echo.

:: Get date and time
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DATE=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%
set BACKUP_NAME=backup-%BACKUP_DATE%

:: Ask for description
set /p BACKUP_DESC="Backup description: "

if "%BACKUP_DESC%"=="" set BACKUP_DESC=manual-backup

:: Replace spaces with dashes
set BACKUP_DESC=%BACKUP_DESC: =-%

echo.
echo Creating backup: %BACKUP_NAME%
echo Description: %BACKUP_DESC%
echo.

:: Check for uncommitted changes
for /f %%A in ('git status --porcelain') do (
    echo WARNING: Uncommitted changes found!
    set /p COMMIT_CHANGES="Commit changes? (y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        git add .
        git commit -m "auto-commit before backup %BACKUP_NAME%"
        git push
        echo Changes committed
    )
)

:: Create tag
echo.
echo Creating tag: v-%BACKUP_NAME%
git tag -a "v-%BACKUP_NAME%" -m "Backup: %BACKUP_DESC%"
if %errorlevel% neq 0 (
    echo ERROR: Failed to create tag
    pause
    exit /b 1
)

:: Push tag
echo Pushing to GitHub...
git push origin "v-%BACKUP_NAME%"
if %errorlevel% neq 0 (
    echo ERROR: Failed to push tag
    pause
    exit /b 1
)

:: Create backup branch
echo Creating backup branch: backup/%BACKUP_NAME%
git branch "backup/%BACKUP_NAME%" 2>nul
if %errorlevel% equ 0 (
    git push origin "backup/%BACKUP_NAME%"
    echo Backup branch created
) else (
    echo Branch already exists
)

echo.
echo ========================================
echo      BACKUP CREATED SUCCESSFULLY!
echo ========================================
echo   Tag:   v-%BACKUP_NAME%
echo   Branch: backup/%BACKUP_NAME%
echo ========================================
echo.
echo To restore, use: backup-restore.bat
echo.

pause
