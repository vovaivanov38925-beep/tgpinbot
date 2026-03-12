@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: RELEASE CREATOR для tgpinbot
:: Создает стабильную версию (v1.0.0, v1.1.0 и т.д.)
:: ============================================

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════╗
echo ║     🚀  RELEASE CREATOR v1.0            ║
echo ╚══════════════════════════════════════════╝
echo.

:: Получаем последний тег версии
for /f "tokens=*" %%a in ('git describe --tags --abbrev^=0 2^>nul') do set LAST_TAG=%%a

echo 📌 Последняя версия: %LAST_TAG%
echo.

:: Запрос версии
set /p NEW_VERSION="🔢 Новая версия (например, 1.0.0): "

if "%NEW_VERSION%"=="" (
    echo ❌ Версия не указана
    pause
    exit /b 1
)

:: Запрос описания
set /p RELEASE_DESC="📝 Описание релиза: "

echo.
echo ⚠️  Создание релиза v%NEW_VERSION%
echo 📝 %RELEASE_DESC%
echo.

set /p CONFIRM="Продолжить? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo ❌ Отменено
    pause
    exit /b 0
)

:: Проверяем несохраненные изменения
git status --porcelain >nul 2>&1
for /f %%A in ('git status --porcelain') do (
    echo ⚠️  Есть несохраненные изменения!
    set /p COMMIT_NOW="Сохранить и продолжить? (y/n): "
    if /i "!COMMIT_NOW!"=="y" (
        git add .
        git commit -m "chore: prepare for release v%NEW_VERSION%"
    ) else (
        echo ❌ Отменено
        pause
        exit /b 1
    )
)

:: Создаем тег релиза
echo.
echo 🏷️  Создание тега: v%NEW_VERSION%
git tag -a "v%NEW_VERSION%" -m "Release v%NEW_VERSION%: %RELEASE_DESC%"

if %errorlevel% neq 0 (
    echo ❌ Ошибка создания тега
    pause
    exit /b 1
)

:: Пушим всё
echo 📤 Отправка в репозиторий...
git push
git push --tags

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ РЕЛИЗ СОЗДАН!                        ║
echo ╠══════════════════════════════════════════╣
echo ║  Версия: v%NEW_VERSION%                      ║
echo ║  Описание: %RELEASE_DESC%                    ║
echo ╚══════════════════════════════════════════╝
echo.
echo 💡 Этот релиз всегда можно восстановить:
echo    git checkout v%NEW_VERSION%
echo.

pause
