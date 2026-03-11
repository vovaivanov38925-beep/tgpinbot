@echo off

echo ========================================
echo        BACKUP CREATOR v2.0
echo ========================================
echo.

set /p PROJECT_PATH="Enter project path: "

set PROJECT_PATH=%PROJECT_PATH:"=%

if not exist "%PROJECT_PATH%\.git" (
    echo.
    echo ERROR: No Git found in this folder!
    echo Path: %PROJECT_PATH%
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo Project: %PROJECT_PATH%
echo.

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DATE=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%
set BACKUP_NAME=backup-%BACKUP_DATE%

set /p BACKUP_DESC="Backup description: "

if "%BACKUP_DESC%"=="" set BACKUP_DESC=manual-backup

set BACKUP_DESC=%BACKUP_DESC: =-%

echo.
echo Creating backup: %BACKUP_NAME%
echo Description: %BACKUP_DESC%
echo.

git tag -a "v-%BACKUP_NAME%" -m "Backup: %BACKUP_DESC%"
if errorlevel 1 (
    echo ERROR: Failed to create tag
    pause
    exit /b 1
)

git push origin "v-%BACKUP_NAME%"
if errorlevel 1 (
    echo ERROR: Failed to push tag
    pause
    exit /b 1
)

git branch "backup/%BACKUP_NAME%" 2>nul
git push origin "backup/%BACKUP_NAME%" 2>nul

echo.
echo ========================================
echo      BACKUP CREATED SUCCESSFULLY!
echo ========================================
echo   Tag: v-%BACKUP_NAME%
echo   Branch: backup/%BACKUP_NAME%
echo ========================================
echo.

pause
