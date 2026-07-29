import type { Metadata } from "next";
import "./globals.css";
import "./ip-checker.css";
import "./price-map.css";
import "./relay-compare.css";
import "./relay-purity.css";
import "./skin-gallery.css";
import "./tax-address-generator.css";
import "./vpn-compare.css";

export const metadata: Metadata = {
  metadataBase: new URL("http://127.0.0.1:3001"),
  title: "数字服务雷达｜订阅、中转站、VPN 与网络工具",
  description: "对比 ChatGPT 全球订阅价格、AI API 中转站和 VPN 实测性能，并使用地址生成与 IP 检测工具。",
  openGraph: {
    title: "数字服务雷达｜数字服务与网络检测工具",
    description: "ChatGPT 全球价格、中转站导航、VPN 实测、地址格式和 IP 出口检测。",
    type: "website",
    locale: "zh_CN",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "数字服务雷达：价格对比与接口检测" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "数字服务雷达｜数字服务与网络检测工具",
    description: "ChatGPT 全球价格、中转站导航、VPN 实测、地址格式和 IP 出口检测。",
    images: ["/og.png"],
  },
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
