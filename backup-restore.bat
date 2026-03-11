@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP RESTORE для tgpinbot
:: Откатывается к выбранному бекапу
:: ============================================

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════╗
echo ║     ⏪  BACKUP RESTORE v1.0              ║
echo ╚══════════════════════════════════════════╝
echo.

:: Получаем список бекапов
echo 📋 Доступные бекапы (теги):
echo ─────────────────────────────────────────
echo.

:: Создаем временный файл со списком тегов
git tag -l "v-backup-*" --sort=-creatordate > "%temp%\backup_tags.txt"
git tag -l "v1.*" --sort=-creatordate >> "%temp%\backup_tags.txt" 2>nul

:: Показываем теги с номерами
set count=0
for /f "tokens=*" %%a in ('type "%temp%\backup_tags.txt" ^| findstr /r "v-"') do (
    set /a count+=1
    echo [!count!] %%a
    set "tag_!count!=%%a"
)

if %count% equ 0 (
    echo ❌ Бекапы не найдены!
    echo.
    echo Создай бекап с помощью backup-create.bat
    pause
    exit /b 1
)

echo.
echo [0] Ввести тег вручную
echo.

set /p CHOICE="👉 Выбери номер бекапа: "

if "%CHOICE%"=="0" (
    set /p SELECTED_TAG="Введите имя тега: "
) else (
    set "SELECTED_TAG=!tag_%CHOICE%!"
)

if "%SELECTED_TAG%"=="" (
    echo ❌ Неверный выбор
    pause
    exit /b 1
)

echo.
echo ⚠️  ВНИМАНИЕ! Ты собираешься откатиться к: %SELECTED_TAG%
echo.
echo Это действие может привести к потере текущих изменений!
echo.

set /p CONFIRM="Продолжить? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo ❌ Отменено
    pause
    exit /b 0
)

:: Сохраняем текущее состояние в emergency ветку
set EMERGENCY_BRANCH=emergency-%datetime:~0,8%-%datetime:~8,6%
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set EMERGENCY_BRANCH=emergency-%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%

echo.
echo 💾 Сохраняем текущее состояние в ветку: %EMERGENCY_BRANCH%
git branch "%EMERGENCY_BRANCH%"
git push origin "%EMERGENCY_BRANCH%" 2>nul

:: Откатываемся
echo.
echo ⏪ Откат к %SELECTED_TAG%...
git checkout %SELECTED_TAG%

if %errorlevel% neq 0 (
    echo ❌ Ошибка отката
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ ОТКАТ ВЫПОЛНЕН!                      ║
echo ╠══════════════════════════════════════════╣
echo ║  Текущая версия: %SELECTED_TAG%           ║
echo ║  Текущее состояние в "detached HEAD"     ║
echo ╚══════════════════════════════════════════╝
echo.
echo 🔧 Что делать дальше:
echo.
echo   1. Если всё работает - создать новую ветку:
echo      git checkout -b master-restored
echo      git push -f origin master
echo.
echo   2. Если нужно вернуть как было:
echo      git checkout master
echo.
echo   3. Принудительно обновить master:
echo      git checkout %SELECTED_TAG%
echo      git checkout -B master
echo      git push -f origin master
echo.

del "%temp%\backup_tags.txt" 2>nul
pause
