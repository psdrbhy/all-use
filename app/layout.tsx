import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "订阅雷达｜ChatGPT 全球订阅价格对比",
  description: "对比 ChatGPT 在不同地区、不同购买渠道的订阅价格、税费和美元等值。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
