'use client'

import Script from 'next/script'
import { useEffect } from 'react'

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize Telegram WebApp when script loads
    const initTelegram = () => {
      if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp
        tg.ready()
        tg.expand()
        console.log('Telegram WebApp initialized')
      }
    }

    // Check if already loaded
    if ((window as any).Telegram?.WebApp) {
      initTelegram()
    }
  }, [])

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => {
          if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
            (window as any).Telegram.WebApp.ready()
            ;(window as any).Telegram.WebApp.expand()
            console.log('Telegram WebApp ready')
          }
        }}
      />
      {children}
    </>
  )
}
