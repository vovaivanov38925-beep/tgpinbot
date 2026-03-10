import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pinterest to Action - Превращаем вдохновение в действия",
  description: "Telegram Mini App для сохранения Pinterest пинов и превращения их в задачи. AI-категоризация, геймификация и премиум функции.",
  keywords: ["Pinterest", "Telegram", "Mini App", "Задачи", "Продуктивность", "AI"],
  authors: [{ name: "Pinterest to Action Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Pinterest to Action",
    description: "Превращаем вдохновение в действия",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pinterest to Action",
    description: "Превращаем вдохновение в действия",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Telegram WebApp SDK - must load before app initializes */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
          onLoad={() => {
            if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
              (window as any).Telegram.WebApp.ready();
              (window as any).Telegram.WebApp.expand();
            }
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
