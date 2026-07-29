import { NextResponse } from "next/server";

export const runtime = "edge";

type SourceStatus = "ok" | "unavailable" | "error";
type SourceResult = { id:string; name:string; status:SourceStatus; mode:"anonymous"|"api-key"|"not-configured"; latencyMs:number|null; summary:string; signals:string[] };

function isValidIp(value: string) {
  if (value.length > 45 || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  if (value.includes(":")) return value.includes("::") || value.split(":").length >= 3;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

async function getJson(url: string, headers?: Record<string,string>) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9_000);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers, signal:controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { ok:true as const, data:await response.json() as Record<string,unknown>, latencyMs:Date.now()-startedAt };
  } catch {
    return { ok:false as const, data:null, latencyMs:Date.now()-startedAt };
  } finally {
    clearTimeout(timer);
  }
}

function flag(value: unknown) {
  return value === true || value === "yes" || value === "true";
}

function numberValue(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export async function GET(request: Request) {
  const ip = new URL(request.url).searchParams.get("ip")?.trim() ?? "";
  if (!isValidIp(ip)) return NextResponse.json({ error:"请输入有效的 IPv4 或 IPv6 地址" }, { status:400 });

  const abuseKey = process.env.ABUSEIPDB_API_KEY;
  const virusTotalKey = process.env.VIRUSTOTAL_API_KEY;
  const crowdSecKey = process.env.CROWDSEC_CTI_API_KEY;
  const proxyCheckKey = process.env.PROXYCHECK_API_KEY;
  const encodedIp = encodeURIComponent(ip);

  const [ipapi, technik, proxycheck, abuse, virusTotal, crowdSec] = await Promise.all([
    getJson(`https://api.ipapi.is/?q=${encodedIp}`),
    getJson(`https://api.techniknews.net/ipgeo/${encodedIp}`),
    getJson(`https://proxycheck.io/v2/${encodedIp}?vpn=1&asn=1&risk=1${proxyCheckKey ? `&key=${encodeURIComponent(proxyCheckKey)}` : ""}`),
    abuseKey ? getJson(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodedIp}&maxAgeInDays=90`, { Accept:"application/json", Key:abuseKey }) : Promise.resolve(null),
    virusTotalKey ? getJson(`https://www.virustotal.com/api/v3/ip_addresses/${encodedIp}`, { "x-apikey":virusTotalKey }) : Promise.resolve(null),
    crowdSecKey ? getJson(`https://cti.api.crowdsec.net/v2/smoke/${encodedIp}`, { accept:"application/json", "x-api-key":crowdSecKey }) : Promise.resolve(null),
  ]);

  const ipapiData = ipapi.ok ? ipapi.data : null;
  const technikData = technik.ok ? technik.data : null;
  const proxyRoot = proxycheck.ok ? proxycheck.data : null;
  const proxyData = proxyRoot && typeof proxyRoot[ip] === "object" ? proxyRoot[ip] as Record<string,unknown> : null;
  const abuseData = abuse?.ok && typeof abuse.data.data === "object" ? abuse.data.data as Record<string,unknown> : null;
  const vtAttributes = virusTotal?.ok && typeof virusTotal.data.data === "object" ? (virusTotal.data.data as { attributes?:Record<string,unknown> }).attributes ?? null : null;
  const vtStats = vtAttributes && typeof vtAttributes.last_analysis_stats === "object" ? vtAttributes.last_analysis_stats as Record<string,unknown> : null;
  const crowdData = crowdSec?.ok ? crowdSec.data : null;

  const ipapiSignals = [flag(ipapiData?.is_vpn) && "VPN", flag(ipapiData?.is_proxy) && "代理", flag(ipapiData?.is_tor) && "Tor", flag(ipapiData?.is_datacenter) && "数据中心", flag(ipapiData?.is_abuser) && "滥用源"].filter(Boolean) as string[];
  const technikSignals = [flag(technikData?.proxy) && "代理", flag(technikData?.hosting) && "托管网络", flag(technikData?.mobile) && "移动网络"].filter(Boolean) as string[];
  const proxySignals = proxyData ? [flag(proxyData.proxy) && "代理", String(proxyData.type ?? "").toLowerCase().includes("vpn") && "VPN", String(proxyData.type ?? "").toLowerCase().includes("tor") && "Tor"].filter(Boolean) as string[] : [];
  const abuseConfidence = numberValue(abuseData?.abuseConfidenceScore);
  const vtMalicious = numberValue(vtStats?.malicious);
  const vtSuspicious = numberValue(vtStats?.suspicious);
  const proxyRisk = numberValue(proxyData?.risk);
  const crowdReputation = String(crowdData?.reputation ?? crowdData?.background_noise ?? "unknown");
  const crowdBehaviors = Array.isArray(crowdData?.behaviors) ? crowdData.behaviors.map(String).slice(0,4) : [];

  const sources: SourceResult[] = [
    { id:"ipapi", name:"ipapi.is", status:ipapi.ok?"ok":"error", mode:"anonymous", latencyMs:ipapi.latencyMs, summary:ipapi.ok?"地理、ASN 与匿名网络信号已返回":"匿名接口请求失败", signals:ipapiSignals },
    { id:"technik", name:"TechnikNews", status:technik.ok?"ok":"error", mode:"anonymous", latencyMs:technik.latencyMs, summary:technik.ok?"地理与简易代理/托管标记已返回":"匿名接口请求失败", signals:technikSignals },
    { id:"proxycheck", name:"ProxyCheck", status:proxycheck.ok&&proxyData?"ok":"error", mode:proxyCheckKey?"api-key":"anonymous", latencyMs:proxycheck.latencyMs, summary:proxyData?`风险 ${proxyRisk}/100 · 类型 ${String(proxyData.type ?? "未知")}`:"查询失败或匿名额度已用尽", signals:proxySignals },
    { id:"abuseipdb", name:"AbuseIPDB", status:abuseKey?(abuseData?"ok":"error"):"unavailable", mode:abuseKey?"api-key":"not-configured", latencyMs:abuse?.latencyMs??null, summary:abuseData?`滥用置信度 ${abuseConfidence}/100 · 90 天举报 ${numberValue(abuseData.totalReports)} 次`:abuseKey?"API 请求失败":"需要配置 ABUSEIPDB_API_KEY", signals:abuseConfidence>0?[`滥用 ${abuseConfidence}`]:[] },
    { id:"crowdsec", name:"CrowdSec CTI", status:crowdSecKey?(crowdData?"ok":"error"):"unavailable", mode:crowdSecKey?"api-key":"not-configured", latencyMs:crowdSec?.latencyMs??null, summary:crowdData?`声誉 ${crowdReputation}`:crowdSecKey?"API 请求失败":"需要配置 CROWDSEC_CTI_API_KEY", signals:crowdBehaviors },
    { id:"virustotal", name:"VirusTotal", status:virusTotalKey?(vtStats?"ok":"error"):"unavailable", mode:virusTotalKey?"api-key":"not-configured", latencyMs:virusTotal?.latencyMs??null, summary:vtStats?`恶意 ${vtMalicious} · 可疑 ${vtSuspicious} · 无害 ${numberValue(vtStats.harmless)}`:virusTotalKey?"API 请求失败":"需要配置 VIRUSTOTAL_API_KEY", signals:[vtMalicious>0&&`恶意引擎 ${vtMalicious}`,vtSuspicious>0&&`可疑引擎 ${vtSuspicious}`].filter(Boolean) as string[] },
  ];

  const tor = ipapiSignals.includes("Tor") || proxySignals.includes("Tor");
  const proxy = ipapiSignals.includes("代理") || technikSignals.includes("代理") || proxySignals.includes("代理");
  const vpn = ipapiSignals.includes("VPN") || proxySignals.includes("VPN");
  const hosting = ipapiSignals.includes("数据中心") || technikSignals.includes("托管网络");
  const abuser = ipapiSignals.includes("滥用源");
  const categoryScores = {
    threat: vtMalicious>=3?80:0,
    anonymity: tor?65:proxy?50:vpn?45:0,
    reputation: Math.max(abuseConfidence>=75?80:abuseConfidence,vtMalicious>=3?80:vtMalicious*20,proxyRisk,crowdReputation==="malicious"?80:crowdReputation==="suspicious"?50:0),
    network: hosting?25:0,
    behavior: crowdBehaviors.length?35:abuser?30:0,
  };
  const score = Math.min(100, Math.max(...Object.values(categoryScores)));
  const verdict = score<=15?"safe":score<=39?"low":score<=69?"medium":"high";

  const locations = [
    ipapiData ? { source:"ipapi.is", country:(ipapiData.location as Record<string,unknown>|undefined)?.country??null, region:(ipapiData.location as Record<string,unknown>|undefined)?.state??null, city:(ipapiData.location as Record<string,unknown>|undefined)?.city??null, timezone:(ipapiData.location as Record<string,unknown>|undefined)?.timezone??null } : null,
    technikData ? { source:"TechnikNews", country:technikData.country??null, region:technikData.regionName??null, city:technikData.city??null, timezone:technikData.timezone??null } : null,
    proxyData ? { source:"ProxyCheck", country:proxyData.country??null, region:proxyData.region??null, city:proxyData.city??null, timezone:proxyData.timezone??null } : null,
  ].filter(Boolean);

  return NextResponse.json({
    ip,
    checkedAt:new Date().toISOString(),
    score,
    verdict,
    flags:{ vpn,proxy,tor,hosting,abuser },
    categoryScores,
    network:{
      type:String((ipapiData?.company as Record<string,unknown>|undefined)?.type ?? proxyData?.type ?? (hosting?"hosting":"unknown")),
      asn:(ipapiData?.asn as Record<string,unknown>|undefined)?.asn ?? proxyData?.asn ?? null,
      organization:(ipapiData?.asn as Record<string,unknown>|undefined)?.org ?? technikData?.isp ?? proxyData?.provider ?? null,
    },
    locations,
    sources,
    blacklists:[
      {name:"Spamhaus DROP",status:"pending"},{name:"Spamhaus ASN-DROP",status:"pending"},{name:"Feodo Tracker",status:"pending"},{name:"CINS Army",status:"pending"},{name:"Blocklist.de",status:"pending"},{name:"Tor Exit List",status:"pending"}
    ],
    privacy:"本次主动扫描会把待查 IP 发送给已启用的情报提供商；本站不保存扫描历史。",
  }, { headers:{ "Cache-Control":"no-store, max-age=0", "X-Robots-Tag":"noindex" } });
}
