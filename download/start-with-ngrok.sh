#!/bin/bash

# Запуск Pinterest-to-Action Bot через ngrok

echo "🚀 Запуск Pinterest to Action Bot..."
echo ""

# 1. Запускаем ngrok в фоне
echo "📡 Запускаем ngrok..."
ngrok http 3000 > /dev/null 2>&1 &
NGROK_PID=$!
sleep 3

# 2. Получаем публичный URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok\.io' | head -1)

if [ -z "$NGROK_URL" ]; then
  echo "❌ Не удалось получить ngrok URL"
  exit 1
fi

echo "✅ Публичный URL: $NGROK_URL"
echo ""

# 3. Показываем инструкцию
echo "📱 Настройка Telegram бота:"
echo "   1. Откройте @BotFather"
echo "   2. Отправьте /newbot"
echo "   3. Скопируйте токен"
echo ""
echo "   4. Настройте WebApp URL:"
echo "      Отправьте BotFather: /setmenubutton"
echo "      Введите URL: $NGROK_URL"
echo ""
echo "🌐 Приложение доступно по адресу:"
echo "   $NGROK_URL"
echo ""
echo "⏹️  Для остановки нажмите Ctrl+C"
echo ""

# Ждём завершения
wait $NGROK_PID
