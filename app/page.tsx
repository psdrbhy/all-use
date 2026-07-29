"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import collectionStatus from "../data/collection-status.json";
import verifiedPriceData from "../data/verified-prices.json";
import verifiedRegionalPrices from "../data/verified-regional-prices.json";
import IpChecker from "./ip-checker";
import RelayCompare from "./relay-compare";
import RelayPurity from "./relay-purity";
import SkinGallery from "./skin-gallery";
import TaxAddressGenerator from "./tax-address-generator";
import VpnCompare from "./vpn-compare";

type Plan = "plus" | "pro";
type Channel = "ios" | "web" | "android";
type SortKey = "price" | "country" | "saving";

type MapRecord = {
  code: string;
  country: string;
  flag: string;
  localDisplay: string;
  usd: number | null;
  sourceUrl: string;
  verified: string;
  evidence: "price" | "range";
};

type PriceRow = {
  flag: string;
  country: string;
  code: string;
  localPlus: string;
  localPro: string;
  plusUsd: number | null;
  proUsd: number | null;
  sourceUrl: string;
  verified: string;
};

type CollectedRecord = (typeof verifiedPriceData.records)[number];

const collectedByStorefront = new Map<string, Partial<Record<Plan, CollectedRecord>>>();
for (const record of verifiedPriceData.records) {
  if (record.plan !== "plus" && record.plan !== "pro") continue;
  const current = collectedByStorefront.get(record.storefront) ?? {};
  current[record.plan] = record;
  collectedByStorefront.set(record.storefront, current);
}

const countries: PriceRow[] = [...collectedByStorefront.entries()]
  .flatMap(([code, plans]) => {
    if (!plans.plus || !plans.pro) return [];
    return [{
      flag: plans.plus.flag,
      country: plans.plus.storefrontNameZh,
      code,
      localPlus: plans.plus.localPriceDisplay,
      localPro: plans.pro.localPriceDisplay,
      plusUsd: plans.plus.usdEquivalent,
      proUsd: plans.pro.usdEquivalent,
      sourceUrl: plans.plus.sourceUrl,
      verified: plans.plus.collectedAt.slice(0, 10),
    }];
  })
  .sort((a, b) => (a.plusUsd ?? Number.POSITIVE_INFINITY) - (b.plusUsd ?? Number.POSITIVE_INFINITY));

const collectedDate = verifiedPriceData.generatedAt.slice(0, 10);
const exchangeRateDate = verifiedPriceData.exchangeRates.date;
const collectionCoverage = Math.round(
  (verifiedPriceData.summary.completeStorefronts / verifiedPriceData.summary.configuredStorefronts) * 100,
);
const passedQualityChecks = collectionStatus.quality.checks.filter((check) => check.passed).length;
const totalQualityChecks = collectionStatus.quality.checks.length;
const supportedWebCurrencies = verifiedPriceData.webChannel.supportedCurrencies.length;
const collectedAndroidRanges = verifiedPriceData.androidChannel.collectedStorefronts;
const webRegionalStorefronts = verifiedRegionalPrices.summary.webRegionalStorefronts;

const channelLabels: Record<Channel, string> = {
  ios: "App Store",
  web: "网页订阅",
  android: "Google Play",
};

const mapCoordinates: Record<string, { x:number; y:number }> = {
  US:{x:18,y:39}, CA:{x:17,y:27}, MX:{x:18,y:51}, BR:{x:35,y:69}, AR:{x:32,y:79},
  GB:{x:47,y:29}, FR:{x:49,y:37}, DE:{x:52,y:34}, DK:{x:51,y:25},
  TR:{x:58,y:43}, NG:{x:50,y:59}, IN:{x:70,y:53}, PK:{x:67,y:47}, KR:{x:84,y:41},
  JP:{x:89,y:40}, PH:{x:82,y:59}, AU:{x:86,y:79},
};

function formatUsd(value: number | null) {
  if (value === null) return "暂无官方汇率";
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function countryFlag(code: string) {
  return [...code.toUpperCase()]
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

function PriceRadar() {
  const [plan, setPlan] = useState<Plan>("plus");
  const [channel, setChannel] = useState<Channel>("ios");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("price");
  const [selectedCode, setSelectedCode] = useState("PH");
  const usBaseline = countries.find((item) => item.code === "US");
  if (!usBaseline) throw new Error("Verified US App Store baseline is required");
  const benchmark = (plan === "plus" ? usBaseline.plusUsd : usBaseline.proUsd) ?? 0;

  const rows = useMemo(() => {
    const filtered = countries.filter((item) =>
      `${item.country}${item.code}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return [...filtered].sort((a, b) => {
      const aPrice = plan === "plus" ? a.plusUsd : a.proUsd;
      const bPrice = plan === "plus" ? b.plusUsd : b.proUsd;
      if (sort === "country") return a.country.localeCompare(b.country, "zh-CN");
      if (aPrice === null) return 1;
      if (bPrice === null) return -1;
      if (sort === "saving") return Math.abs(benchmark - bPrice) - Math.abs(benchmark - aPrice);
      return aPrice - bPrice;
    });
  }, [benchmark, plan, query, sort]);

  const pricedCountries = [...countries]
    .filter((item) => (plan === "plus" ? item.plusUsd : item.proUsd) !== null)
    .sort((a, b) => ((plan === "plus" ? a.plusUsd : a.proUsd) ?? 0) - ((plan === "plus" ? b.plusUsd : b.proUsd) ?? 0));
  const lowestCountry = pricedCountries[0];
  const highestCountry = pricedCountries.at(-1)!;
  const lowest = (plan === "plus" ? lowestCountry.plusUsd : lowestCountry.proUsd)!;
  const highest = (plan === "plus" ? highestCountry.plusUsd : highestCountry.proUsd)!;
  const spread = Math.round(((highest - lowest) / lowest) * 100);
  const webRecords = verifiedRegionalPrices.records
    .filter((record) => record.channel === "web" && record.plan === plan)
    .sort((a, b) => (a.usdEquivalent ?? Number.POSITIVE_INFINITY) - (b.usdEquivalent ?? Number.POSITIVE_INFINITY));

  const mapRecords = useMemo<MapRecord[]>(() => {
    if (channel === "ios") {
      return countries.map((item) => ({
        code:item.code,
        country:item.country,
        flag:item.flag,
        localDisplay:plan === "plus" ? item.localPlus : item.localPro,
        usd:plan === "plus" ? item.plusUsd : item.proUsd,
        sourceUrl:item.sourceUrl,
        verified:item.verified,
        evidence:"price",
      }));
    }
    if (channel === "web") {
      return verifiedRegionalPrices.records
        .filter((record) => record.channel === "web" && record.plan === plan)
        .map((record) => ({
          code:record.storefront,
          country:record.storefrontNameZh,
          flag:countryFlag(record.storefront),
          localDisplay:record.localPriceDisplay,
          usd:record.usdEquivalent,
          sourceUrl:record.sourceUrl,
          verified:record.capturedAt.slice(0,10),
          evidence:"price",
        }));
    }
    return verifiedPriceData.androidChannel.priceRanges.map((record) => ({
      code:record.storefront,
      country:record.storefrontNameZh,
      flag:countryFlag(record.storefront),
      localDisplay:record.rangeDisplay,
      usd:null,
      sourceUrl:record.sourceUrl,
      verified:record.collectedAt.slice(0,10),
      evidence:"range",
    }));
  }, [channel, plan]);

  useEffect(() => {
    if (!mapRecords.some((record) => record.code === selectedCode)) {
      setSelectedCode(mapRecords.find((record) => record.code === "US")?.code ?? mapRecords[0]?.code ?? "US");
    }
  }, [mapRecords, selectedCode]);

  const selectedMapRecord = mapRecords.find((record) => record.code === selectedCode) ?? mapRecords[0];
  const mapBaseline = mapRecords.find((record) => record.code === "US")?.usd ?? benchmark;
  const selectedDelta = selectedMapRecord?.usd === null || !selectedMapRecord
    ? null
    : Math.round(((selectedMapRecord.usd - mapBaseline) / mapBaseline) * 100);

  function mapTone(record: MapRecord) {
    if (record.evidence === "range") return "range";
    if (record.usd === null) return "unrated";
    const delta = Math.round(((record.usd - mapBaseline) / mapBaseline) * 100);
    if (delta <= -10) return "low";
    if (delta < 10) return "mid";
    return "high";
  }

  return (
    <main>
      <header className="nav-shell">
        <a className="brand" href="#top" aria-label="订阅雷达首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>订阅雷达</span>
        </a>
        <nav aria-label="主导航">
          <a href="#price-map">全球地图</a>
          <a href="#ranking">价格排行</a>
          <a href="#method">数据方法</a>
          <a href="#faq">常见问题</a>
        </nav>
        <span className="nav-status"><i /> {passedQualityChecks}/{totalQualityChecks} 项质量检查通过 · {collectedDate}</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><span>ChatGPT 全球订阅观察</span><b>2026</b></div>
          <h1>同一个 ChatGPT，<br /><em>不同地区差多少？</em></h1>
          <p>对比全球 App Store 官方公开订阅价格与美元等值。每条记录都保留来源页面、采集时间和内容指纹。</p>
          <div className="hero-actions">
            <a className="primary-btn" href="#price-map">打开价格地图 <span>↓</span></a>
            <a className="secondary-btn" href="#method">了解数据来源</a>
          </div>
          <div className="trust-row">
            <span><b>{verifiedPriceData.summary.completeStorefronts}</b> 个地区</span>
            <span><b>{verifiedPriceData.summary.records}</b> 条官方记录</span>
            <span><b>{passedQualityChecks}/{totalQualityChecks}</b> 质量检查</span>
          </div>
        </div>

        <aside className="hero-card" aria-label="今日价格摘要">
          <div className="card-topline"><span>今日观察</span><b>LIVE SNAPSHOT</b></div>
          <div className="price-spotlight">
            <span>最低月费</span>
            <strong>{formatUsd(lowest)}</strong>
            <small>{lowestCountry.flag} {lowestCountry.country} · {plan === "plus" ? lowestCountry.localPlus : lowestCountry.localPro}</small>
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
          <p className="card-disclaimer">标价来自 Apple 官方商品页；美元换算使用欧洲央行 {exchangeRateDate} 参考汇率。未自动推断税费。</p>
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
                {channelLabels[key]}
                {key === "web" && <span>{supportedWebCurrencies} 币种已确认</span>}
                {key === "android" && <span>{collectedAndroidRanges} 地区范围</span>}
              </button>
            ))}
          </div>
        </div>

        <section className="price-map" id="price-map" aria-label="全球订阅价格地图">
          <div className="map-main">
            <div className="map-toolbar">
              <div><span>INTERACTIVE PRICE ATLAS</span><h3>全球订阅价格地图</h3></div>
              <div className="map-legend" aria-label="地图图例">
                <span><i className="low" />低于美国 10%+</span>
                <span><i className="mid" />接近美国</span>
                <span><i className="high" />高于美国 10%+</span>
                <span><i className="range" />仅有价格范围</span>
                <span><i className="unrated" />暂无官方汇率</span>
              </div>
            </div>
            <div className="world-map" role="group" aria-label={`${channelLabels[channel]} ${plan === "plus" ? "Plus" : "Pro"} 地区价格`}>
              <div className="map-grid" aria-hidden="true" />
              <i className="continent north-america" aria-hidden="true" />
              <i className="continent south-america" aria-hidden="true" />
              <i className="continent europe" aria-hidden="true" />
              <i className="continent africa" aria-hidden="true" />
              <i className="continent asia" aria-hidden="true" />
              <i className="continent australia" aria-hidden="true" />
              <span className="map-label label-americas">AMERICAS</span>
              <span className="map-label label-emea">EUROPE · AFRICA</span>
              <span className="map-label label-apac">ASIA PACIFIC</span>
              {mapRecords.map((record) => {
                const point = mapCoordinates[record.code];
                if (!point) return null;
                return (
                  <button
                    className={`map-point tone-${mapTone(record)} ${selectedCode === record.code ? "selected" : ""}`}
                    style={{ left:`${point.x}%`, top:`${point.y}%` }}
                    type="button"
                    aria-pressed={selectedCode === record.code}
                    aria-label={`${record.country} ${record.localDisplay}`}
                    title={`${record.country} · ${record.localDisplay}`}
                    onClick={() => setSelectedCode(record.code)}
                    key={record.code}
                  >
                    <i />
                    <b>{record.code}</b>
                  </button>
                );
              })}
              <div className="map-readout"><span>DATA COVERAGE</span><strong>{mapRecords.length}</strong><small>个地区有当前渠道证据</small></div>
            </div>
          </div>

          {selectedMapRecord && <aside className="map-detail" aria-live="polite">
            <div className="map-detail-head"><span>SELECTED MARKET</span><b>{selectedMapRecord.flag}</b></div>
            <div className="map-country"><span>{selectedMapRecord.code}</span><div><h3>{selectedMapRecord.country}</h3><p>{channelLabels[channel]} · {plan === "plus" ? "Plus" : "Pro"}</p></div></div>
            <div className="map-price"><span>{selectedMapRecord.evidence === "range" ? "官方内购范围" : "官方月费"}</span><strong>{selectedMapRecord.localDisplay}</strong><small>{selectedMapRecord.usd === null ? "套餐级价格尚未公开" : `约 ${formatUsd(selectedMapRecord.usd)} / 月`}</small></div>
            <div className="map-comparison">
              <span>相对美国基准</span>
              {selectedDelta === null ? <strong className="neutral">不可直接比较</strong> : <strong className={selectedDelta <= 0 ? "down" : "up"}>{selectedDelta > 0 ? "+" : ""}{selectedDelta}%</strong>}
            </div>
            <dl>
              <div><dt>证据状态</dt><dd><i />{selectedMapRecord.evidence === "range" ? "官方范围已采集" : "官方价格已验证"}</dd></div>
              <div><dt>采集日期</dt><dd>{selectedMapRecord.verified}</dd></div>
              <div><dt>数据覆盖</dt><dd>{mapRecords.length} 个市场</dd></div>
            </dl>
            <a href={selectedMapRecord.sourceUrl} target="_blank" rel="noreferrer">查看官方价格来源 <span>↗</span></a>
            <p>地图只为有当前渠道证据的地区着色；灰色区域不代表高价或低价。</p>
          </aside>}
        </section>

        {channel === "web" ? (
          <div className="regional-channel">
            <div className="regional-overview">
              <div>
                <span>WEB CHECKOUT PIPELINE</span>
                <h3>网页订阅证据链已启用</h3>
                <p>官方网页价格配置已经自动核验；国家代码、结算币种、套餐周期和金额同时匹配后才会进入本表。</p>
              </div>
              <dl>
                <div><dt>支持币种</dt><dd>{supportedWebCurrencies}</dd></div>
                <div><dt>地区结账证据</dt><dd>{webRegionalStorefronts}</dd></div>
                <div><dt>本次正式记录</dt><dd>{webRecords.length}</dd></div>
              </dl>
            </div>
            <div className="table-card">
              <div className="table-toolbar regional-toolbar">
                <div><b>{plan === "plus" ? "Plus" : "Pro 20x"} 官方网页价格</b><span>按国家代码自动读取并保留证据指纹</span></div>
                <span className="pipeline-state"><i />证据校验已开启</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>适用范围</th><th>官方月费</th><th>证据类型</th><th>价格来源</th><th>核验时间</th></tr></thead>
                  <tbody>
                    {webRecords.map((record) => (
                      <tr key={record.id}>
                        <td><span className="country-cell"><b>{countryFlag(record.storefront)}</b><span><strong>{record.storefrontNameZh}</strong><small>{record.storefront}</small></span></span></td>
                        <td><strong className="local-price">{record.localPriceDisplay}</strong><small className="per-month">每月</small></td>
                        <td><span className="verify-dot ok"><i />官方结账配置</span></td>
                        <td><a className="source-link" href={record.sourceUrl} target="_blank" rel="noreferrer">ChatGPT 官方配置 ↗</a></td>
                        <td><small>{record.capturedAt.slice(0, 10)}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {webRecords.length === 0 && <div className="empty-state">该套餐的官方网页基准正在重新核验</div>}
              <div className="table-note"><span>ⓘ</span> 土耳其当前由官方接口回退为美元配置，因与预期当地币种不匹配而未发布；采集失败不会覆盖上一版可靠数据。</div>
            </div>
          </div>
        ) : channel === "android" ? (
          <div className="coming-soon">
            <span className="radar-orbit"><i /></span>
            <div>
              <b>已采集 {collectedAndroidRanges} 个地区的 Google Play 官方内购范围</b>
              <p>Google Play 公开商品页只给出整个应用的内购价格区间，没有公开 Plus 与 Pro 的逐项对应关系，因此当前只保存证据范围；套餐级价格需要来自官方购买弹窗证据。</p>
            </div>
            <button onClick={() => setChannel("ios")}>先看 App Store 数据</button>
          </div>
        ) : (
          <>
            <div className="winner-grid">
              {pricedCountries.slice(0, 3).map((item, index) => {
                const price = plan === "plus" ? item.plusUsd : item.proUsd;
                const saving = Math.round(((benchmark - price!) / benchmark) * 100);
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
                <p>{lowestCountry.country}的 {plan === "plus" ? "Plus" : "Pro"} 官方列表价当前最低；美元等值会随每日参考汇率变化。</p>
                <b>官方页面采集覆盖率 {collectionCoverage}% <i><em style={{ width: `${collectionCoverage}%` }} /></i></b>
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
                  <thead><tr><th>地区</th><th>当地标价</th><th>美元等值</th><th>对比美国</th><th>价格来源</th><th>采集状态</th></tr></thead>
                  <tbody>
                    {rows.map((item) => {
                      const price = plan === "plus" ? item.plusUsd : item.proUsd;
                      const delta = price === null ? null : Math.round(((price - benchmark) / benchmark) * 100);
                      return (
                        <tr key={item.code}>
                          <td><span className="country-cell"><b>{item.flag}</b><span><strong>{item.country}</strong><small>{item.code}</small></span></span></td>
                          <td><strong className="local-price">{plan === "plus" ? item.localPlus : item.localPro}</strong><small className="per-month">每月</small></td>
                          <td>{formatUsd(price)}</td>
                          <td>{delta === null ? <span className="delta">—</span> : <span className={`delta ${delta <= 0 ? "down" : "up"}`}>{delta > 0 ? "+" : ""}{delta}%</span>}</td>
                          <td><a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Apple 官方页面 ↗</a></td>
                          <td><span className="verify-dot ok"><i />官方来源已采集</span><small className="verified-date">{item.verified}</small></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <div className="empty-state">没有找到匹配的地区</div>}
              <div className="table-note"><span>ⓘ</span> 所有标价均来自对应地区 Apple 官方商品页；本次数据已通过覆盖率、美国基准、唯一性、字段完整性和价格突变检查。税费未推断，实际金额仍以结账页为准。</div>
            </div>
          </>
        )}
      </section>

      <section className="method" id="method">
        <div className="section-heading light">
          <div><span className="section-kicker">DATA METHODOLOGY</span><h2>每个数字，都能说清来处</h2></div>
          <p>目前已覆盖 App Store 与网页订阅；Google Play 套餐级价格仍等待官方购买弹窗证据。</p>
        </div>
        <div className="method-grid">
          <article><span>01</span><b>采集官方列表</b><p>记录当地币种、套餐、渠道和页面更新时间，不混用不同购买渠道。</p></article>
          <article><span>02</span><b>统一汇率日期</b><p>只使用欧洲央行同一交易日参考汇率；缺少币种时不生成美元估算。</p></article>
          <article><span>03</span><b>异常不覆盖</b><p>覆盖率不足、美国基准缺失或当地价格突变超过 20% 时，新结果会被隔离，页面继续使用上一版有效数据。</p></article>
          <article><span>04</span><b>保留历史证据</b><p>每次成功或失败采集都保存独立记录、来源链接、候选商品和页面内容 SHA-256，方便复核变化。</p></article>
        </div>
      </section>

      <section className="faq" id="faq">
        <div className="faq-title"><span>FAQ</span><h2>价格对比前，先了解这些</h2></div>
        <div className="faq-list">
          <details open><summary>为什么不同地区价格不一样？<i>＋</i></summary><p>应用商店会按当地币种、税费和价格层级展示订阅金额，汇率变化也会影响换算后的美元价格。</p></details>
          <details><summary>App Store 价格等于网页价格吗？<i>＋</i></summary><p>不一定。网页、App Store 和 Google Play 是不同计费渠道，因此本站始终分渠道展示，不直接混合比较。</p></details>
          <details><summary>价格中已经包含税费了吗？<i>＋</i></summary><p>当前采集器不根据标价自动判断税费，避免把推测当事实。是否含税应以当地 App Store 结账页为准。</p></details>
          <details><summary>本站多久更新一次？<i>＋</i></summary><p>采集任务可按日运行；页面会展示真实采集日期和欧洲央行汇率日期，采集失败的地区不会沿用伪造的新日期。</p></details>
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

type Experience = "pricing" | "purity" | "relayCompare" | "vpn" | "address" | "ip" | "skins";

const experienceLabels: Record<Experience, { name: string; aria: string }> = {
  pricing: { name: "订阅雷达", aria: "ChatGPT 价格对比" },
  purity: { name: "中转站纯度检测", aria: "中转站纯度检测" },
  relayCompare: { name: "中转站对比", aria: "中转站对比与导航" },
  vpn: { name: "VPN 对比", aria: "VPN 性能实测对比" },
  address: { name: "美国测试地址", aria: "美国免销售税州测试地址生成器" },
  ip: { name: "IP 检测器", aria: "IP 与网络出口检测器" },
  skins: { name: "Dream Skin", aria: "Dream Skin 皮肤库" },
};

export default function Home() {
  const [experience, setExperience] = useState<Experience>("pricing");
  const [menuOpen, setMenuOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("preferred-tool");
    if (saved === "pricing" || saved === "purity" || saved === "relayCompare" || saved === "vpn" || saved === "address" || saved === "ip" || saved === "skins") setExperience(saved);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!switcherRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const switchExperience = (next: Experience) => {
    setExperience(next);
    setMenuOpen(false);
    window.localStorage.setItem("preferred-tool", next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className={`tool-switcher tool-switcher-${experience}`} ref={switcherRef}>
        <button
          className="tool-switch-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <i aria-hidden="true" />
          <span><small>当前工具</small><strong>{experienceLabels[experience].name}</strong></span>
          <b aria-hidden="true">⌄</b>
        </button>
        {menuOpen && (
          <div className="tool-menu" role="menu" aria-label="选择工具">
            <div className="tool-menu-title"><span>选择工作区</span><small>ONE SITE · SEVEN TOOLS</small></div>
            <button className={experience === "pricing" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("pricing")}>
              <span className="tool-number">01</span>
              <span><strong>ChatGPT 价格对比</strong><small>全球订阅价格与地区排行</small></span>
              <i>{experience === "pricing" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "purity" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("purity")}>
              <span className="tool-number">02</span>
              <span><strong>中转站纯度检测</strong><small>接口兼容性与响应证据评分</small></span>
              <i>{experience === "purity" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "relayCompare" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("relayCompare")}>
              <span className="tool-number">03</span>
              <span><strong>中转站对比</strong><small>价格、模型、支付与运营信息</small></span>
              <i>{experience === "relayCompare" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "vpn" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("vpn")}>
              <span className="tool-number">04</span>
              <span><strong>VPN 对比</strong><small>地区、协议、价格与可用性</small></span>
              <i>{experience === "vpn" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "skins" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("skins")}>
              <span className="tool-number">05</span>
              <span><strong>Dream Skin</strong><small>Codex 皮肤浏览与下载</small></span>
              <i>{experience === "skins" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "address" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("address")}>
              <span className="tool-number">06</span>
              <span><strong>美国免税州信息</strong><small>安全的测试地址与州税说明</small></span>
              <i>{experience === "address" ? "✓" : "→"}</i>
            </button>
            <button className={experience === "ip" ? "active" : ""} type="button" role="menuitem" onClick={() => switchExperience("ip")}>
              <span className="tool-number">07</span>
              <span><strong>IP 检测器</strong><small>出口、地区、ASN 与连接信息</small></span>
              <i>{experience === "ip" ? "✓" : "→"}</i>
            </button>
          </div>
        )}
      </div>
      <div className="tool-stage" key={experience} aria-label={experienceLabels[experience].aria}>
        {experience === "pricing" ? <PriceRadar /> : experience === "purity" ? <RelayPurity /> : experience === "relayCompare" ? <RelayCompare /> : experience === "vpn" ? <VpnCompare /> : experience === "address" ? <TaxAddressGenerator /> : experience === "ip" ? <IpChecker /> : <SkinGallery />}
      </div>
    </>
  );
}
