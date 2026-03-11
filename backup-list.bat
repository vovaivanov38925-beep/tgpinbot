@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP LIST для tgpinbot
:: Можно запускать откуда угодно!
:: ============================================

:: === НАСТРОЙКА: Укажи путь к проекту ===
:: Если пусто - спросит при запуске
set PROJECT_PATH=

:: Если путь не задан выше - спрашиваем
if "%PROJECT_PATH%"=="" (
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
echo ║     📋  BACKUP LIST v1.1                ║
echo ╚══════════════════════════════════════════╝
echo.

echo 📦 Теги бекапов:
echo ─────────────────────────────────────────
git tag -l "v-backup-*" --sort=-creatordate

echo.
echo 🌿 Ветки бекапов:
echo ─────────────────────────────────────────
git branch -a | findstr "backup/"

echo.
echo 🏷️  Версии (релизы):
echo ─────────────────────────────────────────
git tag -l "v1.*" --sort=-creatordate

echo.
echo 📊 Статус репозитория:
echo ─────────────────────────────────────────
git status -s

echo.
pause
