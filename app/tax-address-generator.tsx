"use client";

import { useMemo, useState } from "react";

type StateCode = "DE" | "OR" | "NH" | "MT" | "AK";
type GeneratedAddress = {
  id: string;
  recipient: string;
  organization: string;
  street: string;
  city: string;
  state: StateCode;
  stateName: string;
  zip: string;
  phone: string;
  email: string;
};

const stateInfo = [
  { code:"DE" as const, name:"特拉华州", label:"州和地方一般销售税均无", note:"州政府不征收州或地方销售税，但对商家征收总收入税。", source:"https://revenue.delaware.gov/business-tax-forms/exemption-certificates/", area:"302", cities:[{city:"Wilmington",zip:"19801"},{city:"Dover",zip:"19901"},{city:"Newark",zip:"19711"}] },
  { code:"OR" as const, name:"俄勒冈州", label:"无一般销售税", note:"没有一般销售税或交易税；车辆等特定项目仍可能适用其他税费。", source:"https://www.oregon.gov/dor/programs/individuals/pages/pit.aspx", area:"503", cities:[{city:"Portland",zip:"97201"},{city:"Salem",zip:"97301"},{city:"Eugene",zip:"97401"}] },
  { code:"NH" as const, name:"新罕布什尔州", label:"无一般商品销售税", note:"普通商品没有一般销售税，餐饮、住宿和通信等类别可能适用专项税。", source:"https://www.revenue.nh.gov/faq/does-new-hampshire-have-sales-tax", area:"603", cities:[{city:"Manchester",zip:"03101"},{city:"Concord",zip:"03301"},{city:"Nashua",zip:"03060"}] },
  { code:"MT" as const, name:"蒙大拿州", label:"无一般用途销售税", note:"没有一般销售税，但住宿、租车及部分度假地区可能存在专项或地方税。", source:"https://revenue.mt.gov/taxes/general-sales-tax", area:"406", cities:[{city:"Helena",zip:"59601"},{city:"Billings",zip:"59101"},{city:"Missoula",zip:"59801"}] },
  { code:"AK" as const, name:"阿拉斯加州", label:"无州级销售税", note:"州政府不征收销售税，但多个城市和自治市镇会征收地方销售税，必须逐地核对。", source:"https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor/AlaskaSalesTaxInformation.aspx", area:"907", cities:[{city:"Anchorage",zip:"99501"},{city:"Fairbanks",zip:"99701"}] },
];

const streetNames = ["Example Way", "Test Data Avenue", "Sandbox Lane", "Prototype Street", "QA Circle"];

function pick<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function createAddress(stateCode?: StateCode, index = 0): GeneratedAddress {
  const state = stateCode ? stateInfo.find((item) => item.code === stateCode)! : pick(stateInfo);
  const place = pick(state.cities);
  const serial = Math.floor(1000 + Math.random() * 8999);
  const phoneSuffix = String(100 + Math.floor(Math.random() * 100)).slice(-2);
  return {
    id: `${Date.now()}-${index}-${serial}`,
    recipient: `Test User ${String(index + 1).padStart(2, "0")}`,
    organization: "TEST DATA — NOT A REAL RESIDENT",
    street: `TEST DATA — ${serial} ${pick(streetNames)}`,
    city: place.city,
    state: state.code,
    stateName: state.name,
    zip: place.zip,
    phone: `+1 (${state.area}) 555-01${phoneSuffix}`,
    email: `test+${state.code.toLowerCase()}${serial}@example.com`,
  };
}

function formatAddress(item: GeneratedAddress) {
  return `${item.recipient}\n${item.organization}\n${item.street}\n${item.city}, ${item.state} ${item.zip}\nUnited States\n${item.phone}\n${item.email}`;
}

export default function TaxAddressGenerator() {
  const [stateCode, setStateCode] = useState<"random" | StateCode>("random");
  const [count, setCount] = useState(3);
  const [results, setResults] = useState<GeneratedAddress[]>(() => Array.from({ length: 3 }, (_, index) => createAddress(undefined, index)));
  const [copied, setCopied] = useState("");

  const selectedState = useMemo(() => stateCode === "random" ? null : stateInfo.find((item) => item.code === stateCode)!, [stateCode]);

  function generate() {
    setResults(Array.from({ length: count }, (_, index) => createAddress(stateCode === "random" ? undefined : stateCode, index)));
    setCopied("");
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(""), 1600);
  }

  return (
    <main className="address-page">
      <header className="address-nav"><a className="address-brand" href="#address-top"><span>A</span><div><b>地址试验室</b><small>US TEST DATA LAB</small></div></a><nav><a href="#generator">生成器</a><a href="#state-guide">五州说明</a><a href="#address-faq">使用边界</a></nav><span className="address-safety"><i /> SYNTHETIC ONLY</span></header>

      <section className="address-hero" id="address-top"><div className="address-hero-copy"><span>US ADDRESS FORMAT GENERATOR</span><h1>生成测试地址，<br />不生成<em>虚假身份。</em></h1><p>面向结账页、注册表单和税率逻辑的开发测试。覆盖美国五个无州级一般销售税的州，所有结果强制携带测试标记。</p><div className="address-trust"><b>5 个州</b><b>格式有效</b><b>零真实身份</b><b>仅保存在当前页面</b></div></div><aside className="address-warning"><span>USAGE BOUNDARY</span><h2>这些地址不能用于</h2><ul><li>冒充当地居民或企业</li><li>绕过账单地址与身份验证</li><li>逃避依法应缴的销售税</li><li>接收邮件、包裹或金融服务</li></ul><p>实际税务义务取决于交易类型、买卖双方所在地及当地规则。</p></aside></section>

      <section className="address-main" id="generator"><div className="address-heading"><div><span>GENERATOR</span><h2>美国测试地址</h2></div><p>城市和邮编采用正确州内格式；街道、姓名、邮箱和电话均为明确标记的虚构测试数据。</p></div>
        <div className="address-workbench"><div className="address-controls"><label><span>选择州</span><select value={stateCode} onChange={(event) => setStateCode(event.target.value as "random" | StateCode)}><option value="random">随机五州</option>{stateInfo.map((state) => <option value={state.code} key={state.code}>{state.name} · {state.code}</option>)}</select></label><label><span>生成数量</span><select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={1}>1 条</option><option value={3}>3 条</option><option value={5}>5 条</option></select></label><button type="button" onClick={generate}>重新生成 <b>↻</b></button></div>
          <div className="selected-tax-note"><span>{selectedState ? `${selectedState.name} · ${selectedState.code}` : "NOMAD 五州随机"}</span><p>{selectedState?.note ?? "随机结果覆盖特拉华、俄勒冈、新罕布什尔、蒙大拿和阿拉斯加；其中阿拉斯加需要额外核对地方销售税。"}</p></div>
          <div className="address-results">{results.map((item, index) => <article key={item.id}><div className="address-card-head"><span>TEST PROFILE {String(index + 1).padStart(2, "0")}</span><b>{item.state}</b></div><div className="address-lines"><strong>{item.recipient}</strong><em>{item.organization}</em><p>{item.street}<br />{item.city}, {item.state} {item.zip}<br />United States</p></div><dl><div><dt>电话</dt><dd>{item.phone}</dd></div><div><dt>邮箱</dt><dd>{item.email}</dd></div></dl><button type="button" onClick={() => copyText(formatAddress(item), item.id)}>{copied === item.id ? "✓ 已复制" : "复制测试资料"}</button></article>)}</div>
          <div className="copy-all"><span>输出包含不可投递的 TEST DATA 街道行</span><button type="button" onClick={() => copyText(results.map(formatAddress).join("\n\n---\n\n"), "all")}>{copied === "all" ? "✓ 已复制全部" : "复制全部"}</button></div>
        </div>
      </section>

      <section className="state-guide" id="state-guide"><div className="state-guide-title"><span>STATE GUIDE · 2026</span><h2>五州并不完全相同</h2><p>“无销售税州”通常指没有州级一般销售税，并不意味着所有商品、服务和地方都永远为零。</p></div><div className="state-grid">{stateInfo.map((state, index) => <article key={state.code}><div><b>{String(index + 1).padStart(2, "0")}</b><span>{state.code}</span></div><h3>{state.name}</h3><strong>{state.label}</strong><p>{state.note}</p><a href={state.source} target="_blank" rel="noreferrer">州政府来源 ↗</a></article>)}</div></section>

      <section className="address-faq" id="address-faq"><div><span>FAQ & SAFETY</span><h2>使用前先确认</h2></div><div className="address-faq-list"><details open><summary>地址是真实存在的吗？<i>＋</i></summary><p>不是。城市、州缩写和邮编用于验证格式，但街道行带有 TEST DATA，姓名为 Test User，邮箱使用 example.com，不能作为真实住址或身份资料。</p></details><details><summary>可以用来修改商店或银行卡账单地址吗？<i>＋</i></summary><p>不可以。账单、税务和身份资料应如实填写。此工具仅适合开发、演示、自动化测试和数据校验。</p></details><details><summary>这些州的所有消费都没有税吗？<i>＋</i></summary><p>不是。部分州仍有地方税或针对住宿、餐饮、通信、车辆等类别的专项税，具体交易应查询州与地方政府规则。</p></details></div></section>

      <footer className="address-footer"><div className="address-brand"><span>A</span><div><b>地址试验室</b><small>US TEST DATA LAB</small></div></div><p>格式用于测试，身份必须真实。</p><small>© 2026 · 不提供可冒用的住址、身份或税务建议</small></footer>
    </main>
  );
}
