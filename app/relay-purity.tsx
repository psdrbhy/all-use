"use client";

import { FormEvent, useState } from "react";

type Check = { id: string; label: string; passed: boolean; weight: number };
type Result = {
  ok: boolean;
  score: number;
  verdict: "high" | "medium" | "low";
  checkedAt: string;
  target: string;
  checks: Check[];
  details: {
    modelCount: number;
    returnedModel: string | null;
    finishReason: string | null;
    modelsLatencyMs: number;
    completionLatencyMs: number;
    modelsStatus: number | null;
    completionStatus: number | null;
    requestId: string | null;
    error: string | null;
  };
  notice: string;
};

const verdictCopy = {
  high: { title: "高度一致", note: "主要兼容性证据均通过", tone: "good" },
  medium: { title: "部分一致", note: "存在缺失或不一致的证据", tone: "warn" },
  low: { title: "一致性较低", note: "建议谨慎使用并人工复核", tone: "risk" },
} as const;

export default function RelayPurity() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function runCheck(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/relay-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, apiKey, model }),
      });
      const body = await response.json() as Result & { error?: string };
      if (!response.ok) throw new Error(body.error || "检测请求失败");
      setResult(body);
      setApiKey("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "检测请求失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const verdict = result ? verdictCopy[result.verdict] : null;

  return (
    <main className="purity-page">
      <header className="purity-nav">
        <a className="purity-brand" href="#purity-top" aria-label="中转站纯度检测首页">
          <span className="purity-logo"><i /><i /></span>
          <span><b>接口鉴证所</b><small>RELAY EVIDENCE LAB</small></span>
        </a>
        <nav aria-label="纯度检测导航"><a href="#tester">开始检测</a><a href="#signals">检测信号</a><a href="#purity-faq">说明</a></nav>
        <span className="privacy-chip"><i /> Key 不保存</span>
      </header>

      <section className="purity-hero" id="purity-top">
        <div className="purity-copy">
          <span className="purity-kicker">OPENAI-COMPATIBLE API CHECKER · BETA</span>
          <h1>别只看模型名，<br /><em>看看它返回了什么。</em></h1>
          <p>通过一组低成本探针，检查中转接口的模型列表、响应结构、模型回报、用量字段与请求标识。结果是证据评分，不做无法验证的“百分百官方”承诺。</p>
          <div className="purity-points"><span>7 项证据检查</span><span>单次即时检测</span><span>不落库 API Key</span></div>
        </div>

        <form className="probe-panel" id="tester" onSubmit={runCheck}>
          <div className="probe-panel-head"><div><span>NEW INSPECTION</span><h2>检测一个中转接口</h2></div><b>01</b></div>
          <label><span>接口地址</span><input type="url" inputMode="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com" required autoComplete="url" /><small>填写域名即可，末尾带 /v1 也能识别</small></label>
          <label><span>API Key</span><div className="secret-input"><input type={showKey ? "text" : "password"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-••••••••••••" required autoComplete="off" /><button type="button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "隐藏 API Key" : "显示 API Key"}>{showKey ? "隐藏" : "显示"}</button></div><small>仅用于本次探针请求，页面不会保存</small></label>
          <label><span>检测模型</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" required autoComplete="off" /><small>需要是该中转站实际支持的模型 ID</small></label>
          <button className="run-probe" type="submit" disabled={loading}>{loading ? <><i />正在发送探针…</> : <>开始检测 <span>→</span></>}</button>
          <p className="cost-note">本次会调用一次模型列表和一次短对话，可能产生极少量 Token 费用。</p>
          {error && <div className="probe-error" role="alert">{error}</div>}
        </form>
      </section>

      <section className="result-section" aria-live="polite">
        {!result ? (
          <div className="result-empty">
            <div className="empty-radar"><span /><i /></div>
            <div><span>AWAITING SAMPLE</span><h2>等待第一份检测样本</h2><p>提交接口后，这里会显示证据分数、通过项、延迟和返回模型。API Key 不会出现在检测报告中。</p></div>
          </div>
        ) : (
          <div className={`result-card result-${verdict?.tone}`}>
            <div className="score-block"><span>证据评分</span><strong>{result.score}<small>/100</small></strong><b>{verdict?.title}</b><p>{verdict?.note}</p></div>
            <div className="check-report">
              <div className="report-head"><div><span>{result.target}</span><h2>检测报告</h2></div><time>{new Date(result.checkedAt).toLocaleString("zh-CN")}</time></div>
              <div className="check-grid">{result.checks.map((check) => <div className={check.passed ? "passed" : "failed"} key={check.id}><i>{check.passed ? "✓" : "×"}</i><span>{check.label}<small>权重 {check.weight}</small></span></div>)}</div>
              <dl className="probe-details">
                <div><dt>返回模型</dt><dd>{result.details.returnedModel ?? "未返回"}</dd></div>
                <div><dt>模型列表</dt><dd>{result.details.modelCount} 个</dd></div>
                <div><dt>对话延迟</dt><dd>{result.details.completionLatencyMs} ms</dd></div>
                <div><dt>HTTP 状态</dt><dd>{result.details.completionStatus ?? "连接失败"}</dd></div>
              </dl>
              {result.details.error && <p className="upstream-error">上游提示：{result.details.error}</p>}
              <p className="report-notice">{result.notice}</p>
            </div>
          </div>
        )}
      </section>

      <section className="signal-section" id="signals">
        <div className="signal-heading"><span>WHAT WE ACTUALLY CHECK</span><h2>“纯度”不是猜出来的</h2><p>我们只展示请求中能够观察到的信号，并把无法验证的部分明确留白。</p></div>
        <div className="signal-grid">
          <article><span>01 / DISCOVERY</span><h3>模型目录</h3><p>确认模型列表端点可访问，并检查你指定的模型 ID 是否真实出现在返回列表。</p></article>
          <article><span>02 / STRUCTURE</span><h3>协议结构</h3><p>检查响应 ID、对象类型、choices、finish reason 与 usage 等 OpenAI 兼容字段。</p></article>
          <article><span>03 / CONSISTENCY</span><h3>模型一致性</h3><p>比较请求模型和接口实际回报的模型，标记改名、回退或返回信息缺失。</p></article>
          <article><span>04 / TRACE</span><h3>请求可追踪性</h3><p>记录请求标识、HTTP 状态和响应延迟，帮助定位中转层是否隐藏了关键证据。</p></article>
        </div>
      </section>

      <section className="purity-faq" id="purity-faq">
        <div><span>LIMITS & PRIVACY</span><h2>先把边界说清楚</h2></div>
        <div className="purity-faq-list">
          <details open><summary>高分就代表一定是 OpenAI 官方上游吗？<i>＋</i></summary><p>不是。兼容接口可以仿造部分响应字段，单次黑盒请求不能证明真实供应商。高分只表示可观察到的协议与模型证据更加完整、一致。</p></details>
          <details><summary>API Key 会被保存吗？<i>＋</i></summary><p>第一版不写入数据库、不放进链接，也不生成包含 Key 的报告。服务端只在本次请求期间将它转发给你填写的接口。</p></details>
          <details><summary>为什么只允许 HTTPS 域名？<i>＋</i></summary><p>这是为了避免密钥明文传输以及检测器被用于访问本地或内网服务。IP 直连和非标准端口目前不开放。</p></details>
        </div>
      </section>

      <footer className="purity-footer"><div className="purity-brand"><span className="purity-logo"><i /><i /></span><span><b>接口鉴证所</b><small>RELAY EVIDENCE LAB</small></span></div><p>用可复核的信号，少一点盲猜。</p><small>© 2026 · 检测结果仅供技术评估，不构成供应商背书</small></footer>
    </main>
  );
}
