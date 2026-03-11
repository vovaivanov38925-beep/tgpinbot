@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP RESTORE for tgpinbot
:: ============================================

:: === CONFIG: Set project path here ===
:: If empty - will ask on startup
set PROJECT_PATH=

:: If path not set - ask user
if "%PROJECT_PATH%"=="" (
    echo.
    echo ========================================
    echo        BACKUP RESTORE v1.2
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
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo ========================================
echo        BACKUP RESTORE v1.2
echo ========================================
echo.

:: Get list of backups
echo Available backups:
echo ----------------------------------------

:: Create temp file with tags
git tag -l "v-backup-*" --sort=-creatordate > "%temp%\backup_tags.txt" 2>nul
git tag -l "v1.*" --sort=-creatordate >> "%temp%\backup_tags.txt" 2>nul

:: Show tags with numbers
set count=0
for /f "tokens=*" %%a in ('type "%temp%\backup_tags.txt%" 2^>nul') do (
    set /a count+=1
    echo [!count!] %%a
    set "tag_!count!=%%a"
)

if %count% equ 0 (
    echo No backups found!
    echo.
    echo Create backup with: backup-create.bat
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 1
)

echo.
echo [0] Enter tag manually
echo.

set /p CHOICE="Select backup number: "

if "%CHOICE%"=="0" (
    set /p SELECTED_TAG="Enter tag name: "
) else (
    set "SELECTED_TAG=!tag_%CHOICE%!"
)

if "%SELECTED_TAG%"=="" (
    echo ERROR: Invalid selection
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 1
)

echo.
echo WARNING! Rolling back to: %SELECTED_TAG%
echo.
echo This may cause loss of current changes!
echo.

set /p CONFIRM="Continue? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo Cancelled
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 0
)

:: Save current state to emergency branch
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set EMERGENCY_BRANCH=emergency-%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%

echo.
echo Saving current state to branch: %EMERGENCY_BRANCH%
git add .
git stash
git branch "%EMERGENCY_BRANCH%" 2>nul
git push origin "%EMERGENCY_BRANCH%" 2>nul

:: Restore
echo.
echo Rolling back to %SELECTED_TAG%...
git checkout %SELECTED_TAG%

if %errorlevel% neq 0 (
    echo ERROR: Rollback failed
    del "%temp%\backup_tags.txt" 2>nul
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
echo What to do next:
echo.
echo   1. Check if everything works
echo.
echo   2. If OK - update master:
echo      git checkout -B master
echo      git push -f origin master
echo.
echo   3. If need to revert:
echo      git checkout master
echo.

del "%temp%\backup_tags.txt" 2>nul
pause
