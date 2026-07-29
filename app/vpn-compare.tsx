"use client";

import { useMemo, useState } from "react";
import vpnData from "../data/vpn-benchmarks.json";

type Metric = "download" | "upload" | "ping" | "stability" | "reliability";
type VpnRecord = (typeof vpnData.records)[number];

const metricMeta: Record<Metric, { label: string; unit: string; lowerBetter?: boolean }> = {
  download: { label: "下载速度", unit: "Mbps" },
  upload: { label: "上传速度", unit: "Mbps" },
  ping: { label: "网络延迟", unit: "ms", lowerBetter: true },
  stability: { label: "稳定性", unit: "%" },
  reliability: { label: "连接成功率", unit: "%" },
};

function metricValue(record: VpnRecord, metric: Metric) {
  return record[metric] as number | null;
}

export default function VpnCompare() {
  const [metric, setMetric] = useState<Metric>("download");
  const [query, setQuery] = useState("");
  const [completeOnly, setCompleteOnly] = useState(false);

  const ranked = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vpnData.records
      .filter((record) => (!needle || `${record.name} ${record.short} ${record.jurisdiction ?? ""}`.toLowerCase().includes(needle)) && (!completeOnly || record.upload !== null))
      .filter((record) => metricValue(record, metric) !== null)
      .sort((a, b) => {
        const aValue = metricValue(a, metric)!;
        const bValue = metricValue(b, metric)!;
        return metricMeta[metric].lowerBetter ? aValue - bValue : bValue - aValue;
      });
  }, [completeOnly, metric, query]);

  const maximum = Math.max(...ranked.map((record) => metricValue(record, metric) ?? 0), 1);
  const completeRecords = vpnData.records.filter((record) => record.upload !== null);
  const leader = vpnData.records[0];

  return (
    <main className="vpn-page">
      <header className="vpn-nav">
        <a className="vpn-brand" href="#vpn-top"><span><i /></span><div><b>VPN 实测榜</b><small>NETWORK BENCHMARK</small></div></a>
        <nav><a href="#speed-board">速度排行</a><a href="#vpn-table">完整数据</a><a href="#vpn-method">测试方法</a></nav>
        <span className="vpn-location">TOKYO · JP <i /></span>
      </header>

      <section className="vpn-hero" id="vpn-top">
        <div className="vpn-hero-copy"><span>7-DAY REAL-WORLD PERFORMANCE</span><h1>VPN 不只看广告，<br />先看一周<em>实测表现。</em></h1><p>固定东京节点，对比下载、上传、延迟、稳定性和连接成功率。每个数字都绑定测试地点与数据窗口。</p><div className="vpn-hero-meta"><b>测量地点：{vpnData.location}</b><b>数据截至：{vpnData.generatedAt.slice(0, 10)}</b><b>{vpnData.measurementWindow}</b></div></div>
        <aside className="vpn-leader"><div><span>当前下载榜首</span><b>01</b></div><h2>{leader.name}</h2><strong>{leader.download}<small> Mbps</small></strong><div className="leader-metrics"><span>上传 <b>{leader.upload}</b></span><span>延迟 <b>{leader.ping} ms</b></span><span>成功率 <b>{leader.reliability}%</b></span></div><p>东京节点最近 7 天日均表现，并不代表其他地区的实际速度。</p></aside>
      </section>

      <section className="vpn-main" id="speed-board">
        <div className="vpn-heading"><div><span>PERFORMANCE TRACKER</span><h2>性能排行</h2></div><p>{vpnData.notice}</p></div>
        <div className="vpn-controls"><div className="vpn-metrics" aria-label="选择性能指标">{(Object.keys(metricMeta) as Metric[]).map((key) => <button className={metric === key ? "active" : ""} onClick={() => setMetric(key)} type="button" key={key}>{metricMeta[key].label}<small>{metricMeta[key].unit}</small></button>)}</div><label className="vpn-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 VPN 或注册地区" aria-label="搜索 VPN" /></label></div>

        <div className="vpn-chart-card">
          <div className="vpn-chart-head"><div><b>{metricMeta[metric].label}排名</b><span>{ranked.length} 家有可用数据 · {metricMeta[metric].lowerBetter ? "数值越低越好" : "数值越高越好"}</span></div><small>DAILY MEAN · TOKYO</small></div>
          <div className="vpn-bars">{ranked.map((record, index) => {
            const value = metricValue(record, metric)!;
            const visualWidth = metricMeta[metric].lowerBetter ? Math.max(18, 100 - (value / maximum) * 72) : Math.max(18, (value / maximum) * 100);
            return <div className="vpn-bar-row" key={record.id}><span className="vpn-rank">{String(index + 1).padStart(2, "0")}</span><span className="vpn-dot" style={{ background: record.accent }} /><b>{record.short}</b><div><i style={{ width: `${visualWidth}%`, background: record.accent }} /></div><strong>{value}<small> {metricMeta[metric].unit}</small></strong></div>;
          })}</div>
          {ranked.length === 0 && <div className="vpn-no-data">当前筛选条件下没有可用的 {metricMeta[metric].label} 数据</div>}
        </div>

        <section className="vpn-table-section" id="vpn-table">
          <div className="vpn-table-head"><div><span>DATA TABLE</span><h2>完整指标对比</h2><p>缺少来源证据的字段不会估算，统一显示为待补充。</p></div><label><input type="checkbox" checked={completeOnly} onChange={(event) => setCompleteOnly(event.target.checked)} /> 只看完整样本</label></div>
          <div className="vpn-table-wrap"><table className="vpn-table"><thead><tr><th>排名</th><th>VPN</th><th>注册地区</th><th>下载</th><th>上传</th><th>延迟</th><th>稳定性</th><th>成功率</th><th>服务器</th></tr></thead><tbody>{vpnData.records.filter((record) => (!completeOnly || record.upload !== null) && (!query || `${record.name} ${record.jurisdiction ?? ""}`.toLowerCase().includes(query.toLowerCase()))).map((record, index) => <tr key={record.id}><td><b className="table-rank">#{index + 1}</b></td><td><span className="vpn-name"><i style={{ background: record.accent }} /><b>{record.name}</b></span></td><td>{record.jurisdiction ?? <small>待补充</small>}</td><td><strong>{record.download}</strong> Mbps</td><td>{record.upload !== null ? `${record.upload} Mbps` : <small>待补充</small>}</td><td>{record.ping !== null ? `${record.ping} ms` : <small>待补充</small>}</td><td>{record.stability !== null ? `${record.stability}%` : <small>待补充</small>}</td><td>{record.reliability !== null ? `${record.reliability}%` : <small>待补充</small>}</td><td>{record.servers ?? <small>待补充</small>}</td></tr>)}</tbody></table></div>
          <div className="vpn-data-note"><span>完整样本 {completeRecords.length} / {vpnData.records.length}</span><a href={vpnData.sourceUrl} target="_blank" rel="noreferrer">查看首版数据来源 ↗</a></div>
        </section>
      </section>

      <section className="vpn-method" id="vpn-method"><div className="vpn-method-title"><span>HOW IT IS MEASURED</span><h2>同一节点，同一把尺子</h2><p>首版沿用公开监测数据的方法边界；正式版将接入可重复执行的测速任务。</p></div><div className="vpn-method-grid"><article><b>01</b><h3>固定测试节点</h3><p>从日本东京同一网络环境发起测试，减少地区差异造成的不可比性。</p></article><article><b>02</b><h3>连续重复采样</h3><p>下载、上传和延迟来自多次测试的日均值，避免只展示某次峰值。</p></article><article><b>03</b><h3>稳定与成功率</h3><p>通过重复样本的一致性和成功连接占比，补足单纯速度排名的盲区。</p></article><article><b>04</b><h3>保留地区限制</h3><p>东京结果不能外推到所有国家；受封锁地区还需当地真实节点单独测试。</p></article></div><a className="vpn-method-source" href={vpnData.methodUrl} target="_blank" rel="noreferrer">查看公开监测方法与代码 ↗</a></section>

      <footer className="vpn-footer"><div className="vpn-brand"><span><i /></span><div><b>VPN 实测榜</b><small>NETWORK BENCHMARK</small></div></div><p>速度、稳定性与地区条件，缺一不可。</p><small>© 2026 · 实测数据仅代表指定节点与时间窗口</small></footer>
    </main>
  );
}
