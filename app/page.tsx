"use client";

import { useMemo, useState } from "react";

type Plan = "plus" | "pro";
type Channel = "ios" | "web" | "android";
type SortKey = "price" | "country" | "saving";

type PriceRow = {
  rank: number;
  flag: string;
  country: string;
  code: string;
  localPlus: string;
  localPro: string;
  plusUsd: number;
  proUsd: number;
  tax: string;
  taxTone: "included" | "varies";
  verified: string;
  confidence: "已核验" | "待复核";
};

const countries: PriceRow[] = [
  { rank: 1, flag: "🇵🇭", country: "菲律宾", code: "PH", localPlus: "₱999", localPro: "₱9,990", plusUsd: 16.19, proUsd: 161.9, tax: "含 12% VAT", taxTone: "included", verified: "2026-07-12", confidence: "已核验" },
  { rank: 2, flag: "🇵🇰", country: "巴基斯坦", code: "PK", localPlus: "Rs4,900", localPro: "Rs49,900", plusUsd: 17.62, proUsd: 179.39, tax: "按省份变化", taxTone: "varies", verified: "2026-07-11", confidence: "待复核" },
  { rank: 3, flag: "🇨🇦", country: "加拿大", code: "CA", localPlus: "CA$24.99", localPro: "CA$249", plusUsd: 17.79, proUsd: 177.28, tax: "GST/HST 另计", taxTone: "varies", verified: "2026-07-13", confidence: "已核验" },
  { rank: 4, flag: "🇯🇵", country: "日本", code: "JP", localPlus: "¥3,000", localPro: "¥30,000", plusUsd: 18.5, proUsd: 185.01, tax: "含 10% 消费税", taxTone: "included", verified: "2026-07-14", confidence: "已核验" },
  { rank: 5, flag: "🇰🇷", country: "韩国", code: "KR", localPlus: "₩29,000", localPro: "₩299,000", plusUsd: 19.49, proUsd: 200.9, tax: "含 10% VAT", taxTone: "included", verified: "2026-07-14", confidence: "已核验" },
  { rank: 6, flag: "🇧🇷", country: "巴西", code: "BR", localPlus: "R$99.90", localPro: "R$999.90", plusUsd: 19.68, proUsd: 196.96, tax: "税费因州而异", taxTone: "varies", verified: "2026-07-10", confidence: "待复核" },
  { rank: 7, flag: "🇺🇸", country: "美国", code: "US", localPlus: "$19.99", localPro: "$200", plusUsd: 19.99, proUsd: 200, tax: "销售税另计", taxTone: "varies", verified: "2026-07-15", confidence: "已核验" },
  { rank: 8, flag: "🇮🇳", country: "印度", code: "IN", localPlus: "₹1,999", localPro: "₹19,900", plusUsd: 20.75, proUsd: 206.58, tax: "含 18% GST", taxTone: "included", verified: "2026-07-12", confidence: "已核验" },
  { rank: 9, flag: "🇦🇺", country: "澳大利亚", code: "AU", localPlus: "A$29.99", localPro: "A$300", plusUsd: 20.99, proUsd: 209.95, tax: "含 10% GST", taxTone: "included", verified: "2026-07-13", confidence: "已核验" },
  { rank: 10, flag: "🇹🇷", country: "土耳其", code: "TR", localPlus: "₺999.99", localPro: "₺9,999.99", plusUsd: 21.25, proUsd: 212.47, tax: "含 20% VAT", taxTone: "included", verified: "2026-07-09", confidence: "待复核" },
  { rank: 11, flag: "🇲🇽", country: "墨西哥", code: "MX", localPlus: "MX$399", localPro: "MX$3,999", plusUsd: 22.94, proUsd: 229.9, tax: "含 16% IVA", taxTone: "included", verified: "2026-07-11", confidence: "已核验" },
  { rank: 12, flag: "🇩🇪", country: "德国", code: "DE", localPlus: "€22.99", localPro: "€229", plusUsd: 26.32, proUsd: 262.19, tax: "含 19% VAT", taxTone: "included", verified: "2026-07-15", confidence: "已核验" },
  { rank: 13, flag: "🇫🇷", country: "法国", code: "FR", localPlus: "€22.99", localPro: "€229", plusUsd: 26.32, proUsd: 262.19, tax: "含 20% VAT", taxTone: "included", verified: "2026-07-15", confidence: "已核验" },
  { rank: 14, flag: "🇬🇧", country: "英国", code: "GB", localPlus: "£19.99", localPro: "£200", plusUsd: 26.93, proUsd: 269.45, tax: "含 20% VAT", taxTone: "included", verified: "2026-07-14", confidence: "已核验" },
  { rank: 15, flag: "🇩🇰", country: "丹麦", code: "DK", localPlus: "kr179", localPro: "kr1,799", plusUsd: 27.43, proUsd: 275.73, tax: "含 25% VAT", taxTone: "included", verified: "2026-07-12", confidence: "已核验" },
];

const channelLabels: Record<Channel, string> = {
  ios: "App Store",
  web: "网页订阅",
  android: "Google Play",
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  const [plan, setPlan] = useState<Plan>("plus");
  const [channel, setChannel] = useState<Channel>("ios");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("price");
  const benchmark = plan === "plus" ? 19.99 : 200;

  const rows = useMemo(() => {
    const filtered = countries.filter((item) =>
      `${item.country}${item.code}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const aPrice = plan === "plus" ? a.plusUsd : a.proUsd;
      const bPrice = plan === "plus" ? b.plusUsd : b.proUsd;
      if (sort === "country") return a.country.localeCompare(b.country, "zh-CN");
      if (sort === "saving") return Math.abs(benchmark - bPrice) - Math.abs(benchmark - aPrice);
      return aPrice - bPrice;
    });
  }, [benchmark, plan, query, sort]);

  const lowest = plan === "plus" ? countries[0].plusUsd : countries[0].proUsd;
  const highest = plan === "plus" ? countries.at(-1)!.plusUsd : countries.at(-1)!.proUsd;
  const spread = Math.round(((highest - lowest) / lowest) * 100);

  return (
    <main>
      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="订阅雷达首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>订阅雷达</span>
        </a>
        <nav aria-label="主导航">
          <a href="#ranking">价格排行</a>
          <a href="#method">数据方法</a>
          <a href="#faq">常见问题</a>
        </nav>
        <span className="nav-status"><i /> 数据更新于 7 月 15 日</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><span>ChatGPT 全球订阅观察</span><b>2026</b></div>
          <h1>同一个 ChatGPT，<br /><em>不同地区差多少？</em></h1>
          <p>对比全球 App Store 订阅价格、当地税费和美元等值。所有数据展示来源状态与核验日期。</p>
          <div className="hero-actions">
            <a className="primary-btn" href="#ranking">查看全球价格 <span>↓</span></a>
            <a className="secondary-btn" href="#method">了解数据来源</a>
          </div>
          <div className="trust-row">
            <span><b>15</b> 个地区</span>
            <span><b>2</b> 个套餐</span>
            <span><b>每日</b> 汇率换算</span>
          </div>
        </div>

        <aside className="hero-card" aria-label="今日价格摘要">
          <div className="card-topline"><span>今日观察</span><b>LIVE SNAPSHOT</b></div>
          <div className="price-spotlight">
            <span>最低月费</span>
            <strong>{formatUsd(lowest)}</strong>
            <small>{countries[0].flag} {countries[0].country} · {plan === "plus" ? countries[0].localPlus : countries[0].localPro}</small>
          </div>
          <div className="range-rail" aria-hidden="true">
            <span style={{ width: `${Math.max(12, 100 - spread)}%` }} />
            <i />
          </div>
          <div className="range-labels"><span>{formatUsd(lowest)}</span><span>{formatUsd(highest)}</span></div>
          <div className="spread-note">
            <span>最贵地区比最低价高</span>
            <strong>+{spread}%</strong>
          </div>
          <p className="card-disclaimer">基于公开 App Store 列表及当日汇率，实际结账金额可能受税费影响。</p>
        </aside>
      </section>

      <section className="ranking" id="ranking">
        <div className="section-heading">
          <div>
            <span className="section-kicker">GLOBAL PRICE INDEX</span>
            <h2>全球价格排行</h2>
          </div>
          <p>美国标价作为比较基准，低于基准显示为节省，高于基准显示为溢价。</p>
        </div>

        <div className="control-bar">
          <div className="segmented" aria-label="选择套餐">
            <button className={plan === "plus" ? "active" : ""} onClick={() => setPlan("plus")}>Plus <small>$20 基准</small></button>
            <button className={plan === "pro" ? "active" : ""} onClick={() => setPlan("pro")}>Pro <small>$200 基准</small></button>
          </div>
          <div className="channel-switch" aria-label="选择购买渠道">
            {(Object.keys(channelLabels) as Channel[]).map((key) => (
              <button key={key} className={channel === key ? "active" : ""} onClick={() => setChannel(key)}>
                {channelLabels[key]}{key !== "ios" && <span>筹备中</span>}
              </button>
            ))}
          </div>
        </div>

        {channel !== "ios" ? (
          <div className="coming-soon">
            <span className="radar-orbit"><i /></span>
            <div>
              <b>{channelLabels[channel]}价格正在核验</b>
              <p>我们只发布可以追溯来源的价格。首批数据完成交叉核验后将在这里开放。</p>
            </div>
            <button onClick={() => setChannel("ios")}>先看 App Store 数据</button>
          </div>
        ) : (
          <>
            <div className="winner-grid">
              {countries.slice(0, 3).map((item, index) => {
                const price = plan === "plus" ? item.plusUsd : item.proUsd;
                const saving = Math.round(((benchmark - price) / benchmark) * 100);
                return (
                  <article className={`winner-card winner-${index + 1}`} key={item.code}>
                    <span className="winner-rank">#{index + 1}</span>
                    <span className="winner-flag">{item.flag}</span>
                    <div><h3>{item.country}</h3><p>{plan === "plus" ? item.localPlus : item.localPro} / 月</p></div>
                    <strong>{formatUsd(price)}</strong>
                    <small>比美国低 {saving}%</small>
                  </article>
                );
              })}
              <article className="insight-card">
                <span>本月洞察</span>
                <p>菲律宾的 {plan === "plus" ? "Plus" : "Pro"} 价格当前最低，欧洲高税率地区的美元等值普遍更高。</p>
                <b>数据核验率 80% <i><em /></i></b>
              </article>
            </div>

            <div className="table-card">
              <div className="table-toolbar">
                <label className="search-box">
                  <span>⌕</span>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索国家或地区代码" aria-label="搜索国家或地区" />
                </label>
                <label className="sort-box">
                  <span>排序</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} aria-label="排序方式">
                    <option value="price">价格从低到高</option>
                    <option value="saving">与美国差异最大</option>
                    <option value="country">按国家名称</option>
                  </select>
                </label>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>地区</th><th>当地标价</th><th>美元等值</th><th>对比美国</th><th>税费说明</th><th>数据状态</th></tr></thead>
                  <tbody>
                    {rows.map((item) => {
                      const price = plan === "plus" ? item.plusUsd : item.proUsd;
                      const delta = Math.round(((price - benchmark) / benchmark) * 100);
                      return (
                        <tr key={item.code}>
                          <td><span className="country-cell"><b>{item.flag}</b><span><strong>{item.country}</strong><small>{item.code}</small></span></span></td>
                          <td><strong className="local-price">{plan === "plus" ? item.localPlus : item.localPro}</strong><small className="per-month">每月</small></td>
                          <td>{formatUsd(price)}</td>
                          <td><span className={`delta ${delta <= 0 ? "down" : "up"}`}>{delta > 0 ? "+" : ""}{delta}%</span></td>
                          <td><span className={`tax-tag ${item.taxTone}`}>{item.tax}</span></td>
                          <td><span className={`verify-dot ${item.confidence === "已核验" ? "ok" : "pending"}`}><i />{item.confidence}</span><small className="verified-date">{item.verified}</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <div className="empty-state">没有找到匹配的地区</div>}
              <div className="table-note"><span>ⓘ</span> 页面价格用于信息对比，并非购买建议。请以 ChatGPT 或应用商店结账页显示金额为准。</div>
            </div>
          </>
        )}
      </section>

      <section className="method" id="method">
        <div className="section-heading light">
          <div><span className="section-kicker">DATA METHODOLOGY</span><h2>每个数字，都能说清来处</h2></div>
          <p>首版聚焦公开列表价格，后续将加入网页订阅和 Google Play 数据。</p>
        </div>
        <div className="method-grid">
          <article><span>01</span><b>采集官方列表</b><p>记录当地币种、套餐、渠道和页面更新时间，不混用不同购买渠道。</p></article>
          <article><span>02</span><b>换算统一币种</b><p>使用同一天的参考汇率计算美元和人民币等值，避免跨日期比较偏差。</p></article>
          <article><span>03</span><b>标记税费口径</b><p>区分已含税、结账另计和地区变化，不把税前价当成最终支付价。</p></article>
          <article><span>04</span><b>保留核验记录</b><p>展示最近核验日期和数据状态，价格发生变化时保留历史版本。</p></article>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="faq-title"><span>FAQ</span><h2>价格对比前，先了解这些</h2></div>
        <div className="faq-list">
          <details open><summary>为什么不同地区价格不一样？<i>＋</i></summary><p>应用商店会按当地币种、税费和价格层级展示订阅金额，汇率变化也会影响换算后的美元价格。</p></details>
          <details><summary>App Store 价格等于网页价格吗？<i>＋</i></summary><p>不一定。网页、App Store 和 Google Play 是不同计费渠道，因此本站始终分渠道展示，不直接混合比较。</p></details>
          <details><summary>价格中已经包含税费了吗？<i>＋</i></summary><p>取决于地区。表格会标记“已含税”或“结账另计”，实际金额仍应以结账页面为准。</p></details>
          <details><summary>本站多久更新一次？<i>＋</i></summary><p>汇率计划每日更新，订阅标价采用定期检查加人工复核。每条记录都会展示最近核验日期。</p></details>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="brand-mark"><i /><i /><i /></span><span>订阅雷达</span></div>
        <p>看清全球数字订阅价格。</p>
        <div><a href="#method">数据方法</a><a href="#faq">常见问题</a><a href="#top">返回顶部 ↑</a></div>
        <small>© 2026 订阅雷达 · 非 OpenAI 官方网站</small>
      </footer>
    </main>
  );
}
