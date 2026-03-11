@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP CREATOR для tgpinbot
:: Можно запускать откуда угодно!
:: ============================================

:: === НАСТРОЙКА: Укажи путь к проекту ===
:: Если пусто - спросит при запуске
set PROJECT_PATH=

:: Если путь не задан выше - спрашиваем
if "%PROJECT_PATH%"=="" (
    echo.
    echo ╔══════════════════════════════════════════╗
    echo ║     🛡️  BACKUP CREATOR v1.1              ║
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
    echo 💡 Укажи путь к папке где есть папка .git
    echo    Пример: C:\Users\Name\Projects\tgpinbot
    echo.
    pause
    exit /b 1
)

cd /d "%PROJECT_PATH%"

echo.
echo ╔══════════════════════════════════════════╗
echo ║     🛡️  BACKUP CREATOR v1.1              ║
echo ╚══════════════════════════════════════════╝
echo.
echo 📁 Проект: %PROJECT_PATH%
echo.

:: Получаем текущую дату и время
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DATE=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%
set BACKUP_NAME=backup-%BACKUP_DATE%

:: Запрос описания бекапа
set /p BACKUP_DESC="📝 Описание бекапа: "

if "%BACKUP_DESC%"=="" set BACKUP_DESC=manual-backup

:: Заменяем пробелы на дефисы
set BACKUP_DESC=%BACKUP_DESC: =-%

echo.
echo 📦 Создание бекапа: %BACKUP_NAME%
echo 📝 Описание: %BACKUP_DESC%
echo.

:: Проверяем есть ли несохраненные изменения
for /f %%A in ('git status --porcelain') do (
    echo ⚠️  Есть несохраненные изменения!
    set /p COMMIT_CHANGES="Сохранить изменения? (y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        git add .
        git commit -m "chore: auto-commit before backup %BACKUP_NAME%"
        git push
        echo ✅ Изменения сохранены
    )
)

:: Создаем тег
echo.
echo 🏷️  Создание тега: v-%BACKUP_NAME%
git tag -a "v-%BACKUP_NAME%" -m "Backup: %BACKUP_DESC%"
if %errorlevel% neq 0 (
    echo ❌ Ошибка создания тега
    pause
    exit /b 1
)

:: Пушим тег
echo 📤 Отправка на GitHub...
git push origin "v-%BACKUP_NAME%"
if %errorlevel% neq 0 (
    echo ❌ Ошибка отправки тега
    pause
    exit /b 1
)

:: Создаем backup ветку
echo 🌿 Создание ветки бекапа: backup/%BACKUP_NAME%
git branch "backup/%BACKUP_NAME%" 2>nul
if %errorlevel% equ 0 (
    git push origin "backup/%BACKUP_NAME%"
    echo ✅ Ветка бекапа создана
) else (
    echo ℹ️  Ветка уже существует
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ BACKUP СОЗДАН УСПЕШНО!               ║
echo ╠══════════════════════════════════════════╣
echo ║  Тег:   v-%BACKUP_NAME%            ║
echo ║  Ветка: backup/%BACKUP_NAME%       ║
echo ╚══════════════════════════════════════════╝
echo.
echo 💡 Для отката используй: backup-restore.bat
echo.

pause
