@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP RESTORE для tgpinbot
:: Можно запускать откуда угодно!
:: ============================================

:: === НАСТРОЙКА: Укажи путь к проекту ===
:: Если пусто - спросит при запуске
set PROJECT_PATH=

:: Если путь не задан выше - спрашиваем
if "%PROJECT_PATH%"=="" (
    echo.
    echo ╔══════════════════════════════════════════╗
    echo ║     ⏪  BACKUP RESTORE v1.1             ║
    echo ╚══════════════════════════════════════════╝
    echo.
    set /p PROJECT_PATH="📁 Введи путь к проекту: "
)

:: Убираем кавычки если есть
set PROJECT_PATH=%PROJECT_PATH:"=%

:: Переходим в папку проекта
if not exist "%PROJECT_PATH%\.git" (
    echo.
    echo ❌ Ошибка: В этой папке нет Git!
    echo    Путь: %PROJECT_PATH%
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo ╔══════════════════════════════════════════╗
echo ║     ⏪  BACKUP RESTORE v1.1             ║
echo ╚══════════════════════════════════════════╝
echo.

:: Получаем список бекапов
echo 📋 Доступные бекапы:
echo ─────────────────────────────────────────

:: Создаем временный файл со списком тегов
git tag -l "v-backup-*" --sort=-creatordate > "%temp%\backup_tags.txt" 2>nul
git tag -l "v1.*" --sort=-creatordate >> "%temp%\backup_tags.txt" 2>nul

:: Показываем теги с номерами
set count=0
for /f "tokens=*" %%a in ('type "%temp%\backup_tags.txt%" 2^>nul') do (
    set /a count+=1
    echo [!count!] %%a
    set "tag_!count!=%%a"
)

if %count% equ 0 (
    echo ❌ Бекапы не найдены!
    echo.
    echo Создай бекап с помощью backup-create.bat
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 1
)

echo.
echo [0] Ввести тег вручную
echo.

set /p CHOICE="👉 Выбери номер бекапа: "

if "%CHOICE%"=="0" (
    set /p SELECTED_TAG="Введи имя тега: "
) else (
    set "SELECTED_TAG=!tag_%CHOICE%!"
)

if "%SELECTED_TAG%"=="" (
    echo ❌ Неверный выбор
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 1
)

echo.
echo ⚠️  ВНИМАНИЕ! Откат к: %SELECTED_TAG%
echo.
echo Это действие может привести к потере текущих изменений!
echo.

set /p CONFIRM="Продолжить? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo ❌ Отменено
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 0
)

:: Сохраняем текущее состояние в emergency ветку
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set EMERGENCY_BRANCH=emergency-%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%

echo.
echo 💾 Сохраняем текущее состояние в ветку: %EMERGENCY_BRANCH%
git add .
git stash
git branch "%EMERGENCY_BRANCH%" 2>nul
git push origin "%EMERGENCY_BRANCH%" 2>nul

:: Откатываемся
echo.
echo ⏪ Откат к %SELECTED_TAG%...
git checkout %SELECTED_TAG%

if %errorlevel% neq 0 (
    echo ❌ Ошибка отката
    del "%temp%\backup_tags.txt" 2>nul
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ ОТКАТ ВЫПОЛНЕН!                      ║
echo ╠══════════════════════════════════════════╣
echo ║  Текущая версия: %SELECTED_TAG%           ║
echo ╚══════════════════════════════════════════╝
echo.
echo 🔧 Что делать дальше:
echo.
echo   1. Проверь что всё работает
echo.
echo   2. Если всё ОК - обнови master:
echo      git checkout -B master
echo      git push -f origin master
echo.
echo   3. Если нужно вернуть как было:
echo      git checkout master
echo.

del "%temp%\backup_tags.txt" 2>nul
pause
