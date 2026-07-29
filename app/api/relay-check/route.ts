import { NextResponse } from "next/server";

export const runtime = "edge";

type ProbeResult = {
  ok: boolean;
  status: number | null;
  latencyMs: number;
  body: unknown;
  requestId: string | null;
  error: string | null;
};

const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0"]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeBaseUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("请输入完整的 HTTPS 接口地址");
  }

  if (url.protocol !== "https:") throw new Error("检测地址必须使用 HTTPS");
  if (url.username || url.password) throw new Error("接口地址中不能包含账号或密码");
  if (url.port && url.port !== "443") throw new Error("检测地址仅支持标准 HTTPS 端口");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
  const isIpv6 = hostname.includes(":");
  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isIpv4 ||
    isIpv6
  ) {
    throw new Error("出于安全原因，暂不检测本地地址、内网地址或 IP 直连地址");
  }

  const cleanPath = url.pathname.replace(/\/+$/, "").replace(/\/v1$/i, "");
  return `${url.origin}${cleanPath}`;
}

function safeText(value: unknown, fallback = "未知错误") {
  if (typeof value !== "object" || value === null) return fallback;
  const body = value as { error?: { message?: unknown }; message?: unknown };
  if (typeof body.error?.message === "string") return body.error.message.slice(0, 240);
  if (typeof body.message === "string") return body.message.slice(0, 240);
  return fallback;
}

async function probe(url: string, init: RequestInit): Promise<ProbeResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "error" });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 400) };
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: Date.now() - startedAt,
      body,
      requestId:
        response.headers.get("x-request-id") ??
        response.headers.get("request-id") ??
        response.headers.get("cf-ray"),
      error: response.ok ? null : safeText(body, `上游返回 HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      latencyMs: Date.now() - startedAt,
      body: null,
      requestId: null,
      error: error instanceof Error && error.name === "AbortError" ? "上游响应超时" : "无法连接到该接口",
    };
  } finally {
    clearTimeout(timer);
  }
}

function readModelIds(body: unknown) {
  if (typeof body !== "object" || body === null) return [] as string[];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [] as string[];
  return data.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const id = (item as { id?: unknown }).id;
    return typeof id === "string" ? [id] : [];
  });
}

function inspectCompletion(body: unknown, requestedModel: string) {
  if (typeof body !== "object" || body === null) {
    return { schemaValid: false, returnedModel: null, modelMatches: false, hasUsage: false, finishReason: null };
  }
  const value = body as {
    id?: unknown;
    object?: unknown;
    model?: unknown;
    choices?: Array<{ message?: { content?: unknown }; finish_reason?: unknown }>;
    usage?: unknown;
  };
  const returnedModel = typeof value.model === "string" ? value.model : null;
  const firstChoice = Array.isArray(value.choices) ? value.choices[0] : undefined;
  const schemaValid =
    typeof value.id === "string" &&
    typeof value.object === "string" &&
    Boolean(firstChoice) &&
    typeof firstChoice?.message?.content === "string";
  const requestedFamily = requestedModel.toLowerCase().split(/[-.:]/).slice(0, 2).join("-");
  const modelMatches = Boolean(returnedModel?.toLowerCase().includes(requestedFamily));
  return {
    schemaValid,
    returnedModel,
    modelMatches,
    hasUsage: typeof value.usage === "object" && value.usage !== null,
    finishReason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : null,
  };
}

export async function POST(request: Request) {
  let payload: { baseUrl?: unknown; apiKey?: unknown; model?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonError("请求格式无效", 400);
  }

  if (typeof payload.baseUrl !== "string" || typeof payload.apiKey !== "string" || typeof payload.model !== "string") {
    return jsonError("请填写接口地址、API Key 和模型名称", 400);
  }
  const apiKey = payload.apiKey.trim();
  const model = payload.model.trim();
  if (apiKey.length < 8 || apiKey.length > 512) return jsonError("API Key 格式无效", 400);
  if (!/^[a-zA-Z0-9._:/-]{2,120}$/.test(model)) return jsonError("模型名称格式无效", 400);

  let baseUrl: string;
  try {
    baseUrl = normalizeBaseUrl(payload.baseUrl);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "接口地址无效", 400);
  }

  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  const [modelsProbe, completionProbe] = await Promise.all([
    probe(`${baseUrl}/v1/models`, { method: "GET", headers }),
    probe(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with only: RELAY_OK_7" }],
        temperature: 0,
        max_tokens: 12,
      }),
    }),
  ]);

  const modelIds = readModelIds(modelsProbe.body);
  const modelListed = modelIds.some((id) => id.toLowerCase() === model.toLowerCase());
  const completion = inspectCompletion(completionProbe.body, model);
  const checks = [
    { id: "models", label: "模型列表可访问", passed: modelsProbe.ok, weight: 15 },
    { id: "listed", label: "请求模型出现在列表中", passed: modelListed, weight: 20 },
    { id: "completion", label: "对话接口请求成功", passed: completionProbe.ok, weight: 25 },
    { id: "schema", label: "响应结构符合 OpenAI 格式", passed: completion.schemaValid, weight: 15 },
    { id: "model", label: "返回模型与请求模型一致", passed: completion.modelMatches, weight: 15 },
    { id: "usage", label: "返回完整用量字段", passed: completion.hasUsage, weight: 5 },
    { id: "request", label: "存在可追踪请求标识", passed: Boolean(completionProbe.requestId), weight: 5 },
  ];
  const score = checks.reduce((total, item) => total + (item.passed ? item.weight : 0), 0);
  const verdict = score >= 85 ? "high" : score >= 65 ? "medium" : "low";
  const upstreamError = (completionProbe.error ?? modelsProbe.error)?.replaceAll(apiKey, "[已隐藏]") ?? null;

  return NextResponse.json({
    ok: modelsProbe.ok || completionProbe.ok,
    score,
    verdict,
    checkedAt: new Date().toISOString(),
    target: new URL(baseUrl).hostname,
    checks,
    details: {
      modelCount: modelIds.length,
      returnedModel: completion.returnedModel,
      finishReason: completion.finishReason,
      modelsLatencyMs: modelsProbe.latencyMs,
      completionLatencyMs: completionProbe.latencyMs,
      modelsStatus: modelsProbe.status,
      completionStatus: completionProbe.status,
      requestId: completionProbe.requestId,
      error: upstreamError,
    },
    notice: "该结果衡量接口兼容性与响应一致性，不能单独证明上游供应商身份或模型绝对真实性。",
  });
}
