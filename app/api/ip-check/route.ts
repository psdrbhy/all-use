import { NextResponse } from "next/server";

export const runtime = "edge";

function readClientIp(request: Request) {
  const direct = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  if (direct) return direct.trim();
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
}

function ipVersion(ip: string) {
  if (ip.includes(":")) return "IPv6";
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) return "IPv4";
  return "未知";
}

function isLocalAddress(ip: string) {
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

function parseUserAgent(userAgent: string) {
  const browser = userAgent.includes("Edg/") ? "Microsoft Edge" : userAgent.includes("Chrome/") ? "Chrome" : userAgent.includes("Safari/") && !userAgent.includes("Chrome/") ? "Safari" : userAgent.includes("Firefox/") ? "Firefox" : "其他浏览器";
  const os = userAgent.includes("Mac OS X") ? "macOS" : userAgent.includes("Windows") ? "Windows" : userAgent.includes("Android") ? "Android" : /iPhone|iPad/.test(userAgent) ? "iOS / iPadOS" : userAgent.includes("Linux") ? "Linux" : "未知系统";
  return { browser, os };
}

export async function GET(request: Request) {
  const ip = readClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const client = parseUserAgent(userAgent);
  const local = isLocalAddress(ip);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ip,
    version: ipVersion(ip),
    local,
    source: request.headers.get("x-vercel-id") ? "vercel-edge" : "local-preview",
    location: {
      country: request.headers.get("x-vercel-ip-country"),
      region: request.headers.get("x-vercel-ip-country-region"),
      regionCode: request.headers.get("x-vercel-ip-country-region"),
      city: request.headers.get("x-vercel-ip-city"),
      postalCode: request.headers.get("x-vercel-ip-postal-code"),
      timezone: request.headers.get("x-vercel-ip-timezone"),
      continent: null,
      latitude: request.headers.get("x-vercel-ip-latitude"),
      longitude: request.headers.get("x-vercel-ip-longitude"),
    },
    network: {
      asn: null,
      organization: null,
      colo: request.headers.get("x-vercel-id"),
      protocol: request.headers.get("x-forwarded-proto"),
      tlsVersion: null,
      tlsCipher: null,
      rttMs: null,
    },
    client: {
      ...client,
      language: request.headers.get("accept-language")?.split(",")[0] ?? null,
    },
    risk: {
      proxy: "unknown",
      vpn: "unknown",
      tor: "unknown",
      reason: "未接入商业 IP 信誉与代理数据库，不能仅凭 ASN 或地理位置可靠判断。",
    },
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex",
    },
  });
}
