"use client";

import { useMemo, useState } from "react";
import relayData from "../data/relay-providers.json";

type RelayRecord = (typeof relayData.records)[number];
type SortMode = "featured" | "recharge" | "duration" | "newest";

const models = ["全部模型", "OpenAI", "Claude", "Gemini", "Grok", "国产模型"];
const payments = ["全部支付", "微信", "支付宝", "USDT", "VISA"];

export default function RelayCompare() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState("全部模型");
  const [payment, setPayment] = useState("全部支付");
  const [sort, setSort] = useState<SortMode>("featured");
  const [selected, setSelected] = useState<string[]>([]);

  const records = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = relayData.records.filter((record) => {
      const searchMatch = !needle || `${record.name} ${record.domain} ${record.tags.join(" ")}`.toLowerCase().includes(needle);
      const modelMatch = model === "全部模型" || record.models.includes(model);
      const paymentMatch = payment === "全部支付" || record.payments.includes(payment);
      return searchMatch && modelMatch && paymentMatch;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "recharge") return a.rechargeUsdApprox - b.rechargeUsdApprox;
      if (sort === "duration") return b.operatingMonths - a.operatingMonths;
      if (sort === "newest") return a.operatingMonths - b.operatingMonths;
      return Number(b.tags.includes("平台认证")) - Number(a.tags.includes("平台认证"));
    });
  }, [model, payment, query, sort]);

  const selectedRecords = selected.flatMap((id) => relayData.records.find((record) => record.id === id) ?? []);

  function toggleCompare(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  }

  function clearFilters() {
    setQuery("");
    setModel("全部模型");
    setPayment("全部支付");
    setSort("featured");
  }

  return (
    <main className="relay-directory">
      <header className="directory-nav">
        <a className="directory-brand" href="#directory-top"><span>R</span><div><b>中转雷达</b><small>RELAY DIRECTORY</small></div></a>
        <nav><a href="#directory-list">中转站</a><a href="#compare-board">对比台</a><a href="#directory-method">收录说明</a></nav>
        <span className="submit-link">投稿收录 · 即将开放</span>
      </header>

      <section className="directory-hero" id="directory-top">
        <div className="directory-hero-copy">
          <span>AI API RELAY FINDER · PUBLIC BETA</span>
          <h1>找中转站，<br />先把条件<em>摆上桌。</em></h1>
          <p>按模型、起充金额、支付方式和运营时长筛选，再把候选站放进同一张表比较。公开信息只是第一步，购买前仍应小额测试。</p>
        </div>
        <div className="directory-stats">
          <div><strong>{relayData.records.length}</strong><span>首版样本</span></div>
          <div><strong>5</strong><span>模型类别</span></div>
          <div><strong>4</strong><span>支付方式</span></div>
          <small>PUBLIC DATASET · {relayData.generatedAt.slice(0, 10)}</small>
        </div>
      </section>

      <section className="directory-main" id="directory-list">
        <div className="directory-title"><div><span>RELAY INDEX</span><h2>中转站目录</h2></div><p>{relayData.notice} <a href={relayData.sourceUrl} target="_blank" rel="noreferrer">查看首版样本来源 ↗</a></p></div>

        <div className="directory-filters">
          <label className="directory-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、域名或标签" aria-label="搜索中转站" /></label>
          <label><span>支持模型</span><select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>支付方式</span><select value={payment} onChange={(event) => setPayment(event.target.value)}>{payments.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span>排序方式</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="featured">优先展示认证信息</option><option value="recharge">最低起充</option><option value="duration">运营时间最长</option><option value="newest">最新收录</option></select></label>
        </div>

        <div className="directory-count"><span>找到 <b>{records.length}</b> / {relayData.records.length} 个中转站</span><button type="button" onClick={clearFilters}>重置筛选</button></div>

        <div className="relay-card-grid">
          {records.map((record, index) => {
            const isSelected = selected.includes(record.id);
            const isLocked = !isSelected && selected.length >= 3;
            return <article className={`relay-card ${isSelected ? "selected" : ""}`} key={record.id}>
              <div className="relay-card-head">
                <span className="relay-avatar" style={{ background: record.accent }}>{record.initials}</span>
                <div><h3>{record.name}</h3><a href={record.officialUrl} target="_blank" rel="noreferrer">{record.domain} ↗</a></div>
                <small>#{String(index + 1).padStart(2, "0")}</small>
              </div>
              <div className="relay-price"><span>{record.billing}</span><strong>{record.rechargeDisplay}</strong>{record.subscriptionDisplay && <b>订阅 {record.subscriptionDisplay}</b>}</div>
              <div className="relay-tags">{record.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className="relay-facts"><div><span>支持模型</span><p>{record.models.map((item) => <b key={item}>{item}</b>)}</p></div><div><span>支付方式</span><p>{record.payments.map((item) => <b key={item}>{item}</b>)}</p></div></div>
              <div className="relay-card-foot"><div><span>已运营</span><b>{record.operatingDisplay}</b><small>{record.evidence}</small></div><button type="button" disabled={isLocked} onClick={() => toggleCompare(record.id)}>{isSelected ? "✓ 已加入" : isLocked ? "最多 3 个" : "＋ 加入对比"}</button></div>
            </article>;
          })}
        </div>

        {records.length === 0 && <div className="directory-empty"><b>没有找到符合条件的中转站</b><button type="button" onClick={clearFilters}>清空筛选</button></div>}

        <section className="compare-board" id="compare-board">
          <div className="compare-board-head"><div><span>SIDE-BY-SIDE</span><h2>候选对比台</h2><p>选择 2–3 个中转站，关键条件会并排显示。</p></div><b>{selected.length}/3</b></div>
          {selectedRecords.length < 2 ? <div className="compare-placeholder"><span>＋</span><p>还差 {2 - selectedRecords.length} 个候选<br /><small>点击卡片底部的“加入对比”</small></p></div> : <div className="compare-table-wrap"><table className="compare-table"><thead><tr><th>比较项目</th>{selectedRecords.map((record) => <th key={record.id}>{record.name}<button type="button" onClick={() => toggleCompare(record.id)} aria-label={`移除 ${record.name}`}>×</button></th>)}</tr></thead><tbody><tr><td>计费方式</td>{selectedRecords.map((record) => <td key={record.id}>{record.billing}</td>)}</tr><tr><td>最低起充</td>{selectedRecords.map((record) => <td key={record.id}><strong>{record.rechargeDisplay}</strong></td>)}</tr><tr><td>订阅方案</td>{selectedRecords.map((record) => <td key={record.id}>{record.subscriptionDisplay ?? "—"}</td>)}</tr><tr><td>模型覆盖</td>{selectedRecords.map((record) => <td key={record.id}>{record.models.join(" · ")}</td>)}</tr><tr><td>支付方式</td>{selectedRecords.map((record) => <td key={record.id}>{record.payments.join(" · ")}</td>)}</tr><tr><td>运营时长</td>{selectedRecords.map((record) => <td key={record.id}>{record.operatingDisplay}</td>)}</tr><tr><td>下一步</td>{selectedRecords.map((record) => <td key={record.id}><a href={record.officialUrl} target="_blank" rel="noreferrer">去官网核对 ↗</a></td>)}</tr></tbody></table></div>}
        </section>
      </section>

      <section className="directory-method" id="directory-method">
        <div><span>LISTING POLICY</span><h2>收录不等于推荐</h2></div>
        <div className="directory-method-grid"><article><b>01</b><h3>公开信息建档</h3><p>先记录官网域名、公开价格、模型与支付方式，并保留来源及更新时间。</p></article><article><b>02</b><h3>关键字段复核</h3><p>下一阶段会逐站验证价格页、可用模型、接口连通性与服务条款。</p></article><article><b>03</b><h3>异常及时标记</h3><p>无法访问、价格突变或长期未更新的站点将被降级或暂停展示。</p></article><article><b>04</b><h3>先小额再长期</h3><p>目录无法替代资金安全判断，不建议因为排名或标签直接大额充值。</p></article></div>
      </section>

      <footer className="directory-footer"><div className="directory-brand"><span>R</span><div><b>中转雷达</b><small>RELAY DIRECTORY</small></div></div><p>把公开条件放在一起，再做自己的选择。</p><small>© 2026 · 非任何中转站官方或担保平台</small></footer>
    </main>
  );
}
