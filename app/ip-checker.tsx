"use client";

import { FormEvent, useEffect, useState } from "react";
import "./ip-intelligence.css";

type IpResult = {
  checkedAt: string;
  ip: string;
  version: string;
  local: boolean;
  source: "vercel-edge" | "local-preview";
  location: { country:string|null; region:string|null; regionCode:string|null; city:string|null; postalCode:string|null; timezone:string|null; continent:string|null; latitude:string|null; longitude:string|null };
  network: { asn:number|null; organization:string|null; colo:string|null; protocol:string|null; tlsVersion:string|null; tlsCipher:string|null; rttMs:number|null };
  client: { browser:string; os:string; language:string|null };
  risk: { proxy:"unknown"; vpn:"unknown"; tor:"unknown"; reason:string };
};

type IntelResult = {
  ip:string;
  checkedAt:string;
  score:number;
  verdict:"safe"|"low"|"medium"|"high";
  flags:{vpn:boolean;proxy:boolean;tor:boolean;hosting:boolean;abuser:boolean};
  categoryScores:{threat:number;anonymity:number;reputation:number;network:number;behavior:number};
  network:{type:string;asn:number|string|null;organization:string|null};
  locations:Array<{source:string;country:string|null;region:string|null;city:string|null;timezone:string|null}>;
  sources:Array<{id:string;name:string;status:"ok"|"unavailable"|"error";mode:string;latencyMs:number|null;summary:string;signals:string[]}>;
  blacklists:Array<{name:string;status:"pending"|"hit"|"clean"}>;
  privacy:string;
};

const verdictMeta = {
  safe:{label:"安全信号",note:"当前已启用来源未发现明显风险"},
  low:{label:"低风险",note:"存在轻微信号，建议结合业务场景"},
  medium:{label:"中风险",note:"发现匿名网络或声誉风险信号"},
  high:{label:"高风险",note:"发现强威胁或多源高风险信号"},
};

function shown(value: string | number | null) {
  return value === null || value === "" ? "部署后可用" : String(value);
}

export default function IpChecker() {
  const [data, setData] = useState<IpResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [device, setDevice] = useState({ timezone:"", screen:"" });
  const [scanIp, setScanIp] = useState("");
  const [intel, setIntel] = useState<IntelResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");

  async function inspect() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ip-check", { cache:"no-store" });
      if (!response.ok) throw new Error("检测接口暂时不可用");
      const body = await response.json() as IpResult;
      setData(body);
      if (!body.local) setScanIp((current) => current || body.ip);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "检测失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    inspect();
    setDevice({ timezone:Intl.DateTimeFormat().resolvedOptions().timeZone, screen:`${window.screen.width} × ${window.screen.height}` });
  }, []);

  async function copyIp() {
    if (!data) return;
    await navigator.clipboard.writeText(data.ip);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function scanIntelligence(event: FormEvent) {
    event.preventDefault();
    setScanning(true);
    setScanError("");
    setIntel(null);
    try {
      const response = await fetch(`/api/ip-intelligence?ip=${encodeURIComponent(scanIp.trim())}`, { cache:"no-store" });
      const body = await response.json() as IntelResult & {error?:string};
      if (!response.ok) throw new Error(body.error || "多源扫描失败");
      setIntel(body);
    } catch (reason) {
      setScanError(reason instanceof Error ? reason.message : "多源扫描失败，请稍后重试");
    } finally {
      setScanning(false);
    }
  }

  const locationLabel = data ? [data.location.city, data.location.region, data.location.country].filter(Boolean).join(" · ") || "本地预览暂无地理信息" : "正在定位网络出口";

  return (
    <main className="ip-page">
      <header className="ip-nav"><a className="ip-brand" href="#ip-top"><span><i /><i /></span><div><b>IP 体检站</b><small>NETWORK INSPECTOR</small></div></a><nav><a href="#intel-scan">多源扫描</a><a href="#ip-report">连接报告</a><a href="#ip-limits">能力边界</a></nav><span className="ip-private"><i /> NO HISTORY</span></header>

      <section className="ip-hero" id="ip-top"><div className="ip-hero-copy"><span>YOUR CURRENT NETWORK EXIT</span><h1>你的网络出口，<br />现在看起来<em>在哪里？</em></h1><p>检测当前请求暴露的 IP、地区、ASN、边缘节点和连接协议。不上传历史，也不把未知风险包装成确定结论。</p><div className="ip-status-row"><b><i />即时请求</b><b>不写数据库</b><b>基础检测零第三方</b></div></div>
        <aside className="ip-identity"><div className="ip-identity-head"><span>{data?.source === "vercel-edge" ? "LIVE EDGE RESULT" : "LOCAL PREVIEW"}</span><button type="button" onClick={inspect} disabled={loading}>{loading ? "检测中…" : "重新检测 ↻"}</button></div>{error ? <div className="ip-error">{error}</div> : <><span className="ip-label">CURRENT IP ADDRESS</span><strong>{loading ? "•••.•••.•••.•••" : data?.ip ?? "不可用"}</strong><div className="ip-location"><span>{data?.version ?? "—"}</span><p>{locationLabel}</p></div><button className="copy-ip" type="button" onClick={copyIp} disabled={!data}>{copied ? "✓ 已复制 IP" : "复制 IP 地址"}</button>{data?.local && <p className="local-hint">当前是本地回环地址。部署到 Vercel 后才会显示访客公网出口和边缘地理信息。</p>}</>}</aside>
      </section>

      <section className="intel-scan" id="intel-scan">
        <div className="intel-heading"><div><span>MULTI-SOURCE INTELLIGENCE</span><h2>聚合 IP 风险扫描</h2></div><p>主动扫描会把待查 IP 发送给已启用的公开情报提供商。当前接入 3 个匿名来源，另外 3 个来源等待服务器 API Key。</p></div>
        <form className="intel-form" onSubmit={scanIntelligence}><label><span>IPv4 / IPv6</span><input value={scanIp} onChange={(event) => setScanIp(event.target.value)} placeholder="例如 8.8.8.8 或 2606:4700:4700::1111" required autoComplete="off" /></label><button type="button" onClick={() => setScanIp(data?.local ? "" : data?.ip ?? "")} disabled={!data || data.local}>填入我的公网 IP</button><button type="submit" disabled={scanning}>{scanning ? <><i />正在查询多个情报源…</> : <>开始扫描 <b>↗</b></>}</button></form>
        <div className="intel-privacy"><span>隐私提示</span><p>基础连接检测不会发送到第三方；只有点击“开始扫描”后，输入的 IP 才会发送给启用的情报源。本站不保存扫描历史。</p></div>
        {scanError && <div className="intel-error" role="alert">{scanError}</div>}
        {!intel && !scanning ? <div className="intel-empty"><span>06 + 06</span><div><h3>等待扫描一个公网 IP</h3><p>结果将包含 VPN、代理、Tor、托管、滥用、网络类型、来源差异和风险类别。私网或本地回环地址通常没有公开情报。</p></div></div> : null}
        {intel && <div className={`intel-result verdict-${intel.verdict}`}>
          <div className="intel-overview"><div className="intel-score"><span>聚合风险分</span><strong>{intel.score}<small>/100</small></strong><b>{verdictMeta[intel.verdict].label}</b><p>{verdictMeta[intel.verdict].note}</p></div><div className="intel-summary"><div><span>SCANNED IP</span><h3>{intel.ip}</h3><p>{intel.network.organization ?? "网络组织未知"} · {intel.network.asn ? `AS${intel.network.asn}` : "ASN 未知"} · {intel.network.type}</p></div><div className="intel-flags">{Object.entries(intel.flags).map(([key,value]) => <span className={value?"hit":"clear"} key={key}><i>{value?"!":"✓"}</i>{({vpn:"VPN",proxy:"代理",tor:"Tor",hosting:"托管",abuser:"滥用"} as Record<string,string>)[key]}</span>)}</div><small>{intel.privacy}</small></div></div>
          <div className="category-grid">{Object.entries(intel.categoryScores).map(([key,value]) => <article key={key}><span>{({threat:"威胁库",anonymity:"匿名网络",reputation:"声誉评分",network:"网络类型",behavior:"攻击行为"} as Record<string,string>)[key]}</span><strong>{value}<small>/100</small></strong><i><b style={{width:`${value}%`}} /></i></article>)}</div>
          <section className="source-section"><div className="source-heading"><div><span>LIVE SOURCES</span><h3>风险与 IP 类型</h3></div><b>{intel.sources.filter((source)=>source.status==="ok").length} / {intel.sources.length} 源已返回</b></div><div className="source-grid">{intel.sources.map((source) => <article className={`source-${source.status}`} key={source.id}><div><span>{source.name.slice(0,2).toUpperCase()}</span><b>{source.name}</b><i>{source.status==="ok"?"已返回":source.status==="unavailable"?"待配置":"失败"}</i></div><p>{source.summary}</p><div>{source.signals.length?source.signals.map((signal)=><em key={signal}>{signal}</em>):<small>未返回正向风险信号</small>}</div><footer><span>{source.mode==="anonymous"?"匿名额度":source.mode==="api-key"?"服务器密钥":"需要 API Key"}</span><span>{source.latencyMs!==null?`${source.latencyMs} ms`:"—"}</span></footer></article>)}</div></section>
          <section className="geo-sources"><div><span>GEO COMPARISON</span><h3>各源地理位置</h3></div><div>{intel.locations.map((location)=><article key={location.source}><b>{location.source}</b><strong>{location.country??"未知"}</strong><p>{[location.city,location.region].filter(Boolean).join(" · ")||"城市未知"}</p><small>{location.timezone??"时区未知"}</small></article>)}</div></section>
          <section className="blacklist-section"><div><span>OFFLINE LISTS</span><h3>黑名单数据库</h3><p>需要在生产服务器按小时/按日同步，首版先展示接入状态。</p></div><div>{intel.blacklists.map((list)=><span className={list.status} key={list.name}><i />{list.name}<b>{list.status==="pending"?"待同步":list.status==="hit"?"命中":"未命中"}</b></span>)}</div></section>
        </div>}
      </section>

      <section className="ip-report" id="ip-report"><div className="ip-heading"><div><span>INSPECTION REPORT</span><h2>当前连接报告</h2></div><p>位置是 IP 网络出口的近似地理信息，不代表用户精确位置或实际居住地。</p></div>
        <div className="ip-summary-grid"><article><span>IP 协议</span><strong>{data?.version ?? "—"}</strong><small>{data?.version === "IPv6" ? "原生或代理 IPv6 出口" : "当前请求使用 IPv4 出口"}</small></article><article><span>网络组织</span><strong>{shown(data?.network.organization ?? null)}</strong><small>{data?.network.asn ? `AS${data.network.asn}` : "ASN 等待边缘部署"}</small></article><article><span>近似位置</span><strong>{shown(data?.location.country ?? null)}</strong><small>{[data?.location.city, data?.location.region].filter(Boolean).join(" · ") || "城市与地区暂无"}</small></article><article><span>连接延迟</span><strong>{data?.network.rttMs !== null && data?.network.rttMs !== undefined ? `${data.network.rttMs} ms` : "部署后可用"}</strong><small>客户端到边缘节点的平滑 RTT</small></article></div>

        <div className="ip-detail-grid"><section><div className="ip-panel-head"><span>GEO</span><h3>网络位置</h3></div><dl><div><dt>国家/地区</dt><dd>{shown(data?.location.country ?? null)}</dd></div><div><dt>州/省</dt><dd>{shown(data?.location.region ?? null)}</dd></div><div><dt>城市</dt><dd>{shown(data?.location.city ?? null)}</dd></div><div><dt>邮编</dt><dd>{shown(data?.location.postalCode ?? null)}</dd></div><div><dt>网络时区</dt><dd>{shown(data?.location.timezone ?? null)}</dd></div><div><dt>设备时区</dt><dd>{device.timezone || "—"}</dd></div></dl></section><section><div className="ip-panel-head"><span>CONNECTION</span><h3>网络连接</h3></div><dl><div><dt>ASN</dt><dd>{data?.network.asn ? `AS${data.network.asn}` : "部署后可用"}</dd></div><div><dt>运营组织</dt><dd>{shown(data?.network.organization ?? null)}</dd></div><div><dt>边缘机房</dt><dd>{shown(data?.network.colo ?? null)}</dd></div><div><dt>HTTP 协议</dt><dd>{shown(data?.network.protocol ?? null)}</dd></div><div><dt>TLS 版本</dt><dd>{shown(data?.network.tlsVersion ?? null)}</dd></div><div><dt>检测时间</dt><dd>{data ? new Date(data.checkedAt).toLocaleString("zh-CN") : "—"}</dd></div></dl></section><section><div className="ip-panel-head"><span>DEVICE</span><h3>客户端环境</h3></div><dl><div><dt>浏览器</dt><dd>{data?.client.browser ?? "—"}</dd></div><div><dt>操作系统</dt><dd>{data?.client.os ?? "—"}</dd></div><div><dt>首选语言</dt><dd>{data?.client.language ?? "—"}</dd></div><div><dt>屏幕尺寸</dt><dd>{device.screen || "—"}</dd></div><div><dt>代理状态</dt><dd className="unknown">无法可靠判断</dd></div><div><dt>Tor 状态</dt><dd className="unknown">无法可靠判断</dd></div></dl></section></div>
      </section>

      <section className="network-path" id="network-path"><div><span>REQUEST PATH</span><h2>这次请求经过哪里</h2><p>部署后，Vercel 会在请求头中提供其边缘网络观察到的可用元数据。</p></div><div className="path-flow"><article><b>01</b><span>你的设备</span><strong>{data?.client.browser ?? "Browser"}</strong><small>{data?.client.os ?? "Operating System"}</small></article><i>→</i><article><b>02</b><span>公网出口</span><strong>{data?.ip ?? "Checking…"}</strong><small>{locationLabel}</small></article><i>→</i><article><b>03</b><span>边缘节点</span><strong>{shown(data?.network.colo ?? null)}</strong><small>{shown(data?.network.protocol ?? null)}</small></article><i>→</i><article><b>04</b><span>本站接口</span><strong>即时返回</strong><small>不写入历史数据库</small></article></div></section>

      <section className="ip-limits" id="ip-limits"><div><span>WHAT IT CAN & CANNOT TELL</span><h2>检测能力边界</h2></div><div className="limit-grid"><article className="can"><b>✓ 可以检测</b><p>本次请求的出口 IP、IP 版本、近似地区、ASN、边缘节点、协议、TLS 和浏览器环境；主动扫描还能聚合已启用情报源的 VPN、代理、Tor、托管与滥用信号。</p></article><article className="cannot"><b>× 不能证明</b><p>真实住址、精确定位、真实身份、是否本人使用，以及连接背后的物理设备位置。风险结果也不是对用户身份的判定。</p></article><article className="pending"><b>◌ 部分接入</b><p>3 个匿名实时来源已接入；AbuseIPDB、CrowdSec、VirusTotal 需要服务器密钥，6 个离线黑名单需要生产服务器定时同步。</p></article></div><p className="risk-note">多源结果可能随数据库、查询额度和网络状态变化；页面会同时展示来源状态，不把缺失结果当作“安全”。</p></section>

      <footer className="ip-footer"><div className="ip-brand"><span><i /><i /></span><div><b>IP 体检站</b><small>NETWORK INSPECTOR</small></div></div><p>看见网络暴露面，也尊重能力边界。</p><small>© 2026 · 单次即时检测，不保存 IP 历史</small></footer>
    </main>
  );
}
