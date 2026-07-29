import { parseNumericPrice, sha256 } from "./price-utils.mjs";

const OFFICIAL_HOSTS = {
  web: new Set(["chatgpt.com", "help.openai.com", "openai.com"]),
  android: new Set(["play.google.com"]),
};

const CURRENCY_MARKERS = [
  ["US$", "USD"], ["CA$", "CAD"], ["A$", "AUD"], ["R$", "BRL"],
  ["MX$", "MXN"], ["TRY", "TRY"], ["₺", "TRY"], ["₹", "INR"],
  ["₱", "PHP"], ["₩", "KRW"], ["¥", null], ["€", "EUR"], ["£", "GBP"],
  ["Rs", null], ["kr", null], ["$", null],
];

function readablePageText(html) {
  return html
    .replaceAll("\\u0024", "$")
    .replaceAll("\\u002F", "/")
    .replaceAll("\\u00a0", " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#36;", "$")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function inferCurrency(display, expectedCurrency) {
  for (const [marker, currency] of CURRENCY_MARKERS) {
    if (!display.includes(marker)) continue;
    if (currency) return currency;
    if (marker === "¥" && ["JPY", "CNY"].includes(expectedCurrency)) return expectedCurrency;
    if (marker === "Rs" && ["PKR", "INR", "LKR"].includes(expectedCurrency)) return expectedCurrency;
    if (marker === "kr" && ["DKK", "SEK", "NOK", "ISK"].includes(expectedCurrency)) return expectedCurrency;
    if (marker === "$" && expectedCurrency) return expectedCurrency;
  }
  return null;
}

function normalizePlan(label) {
  const compact = label.toLowerCase().replace(/chatgpt\s+/g, "").trim();
  if (compact.startsWith("plus")) return "plus";
  if (compact.includes("20x")) return "pro";
  if (compact.startsWith("pro")) return "pro";
  return null;
}

export function extractChatGptCheckoutCandidates(html, expectedCurrency = null) {
  const text = readablePageText(html);
  const candidates = [];
  const pattern = /(ChatGPT\s+)?(Plus|Pro(?:\s+(?:5x|20x))?)[\s\S]{0,220}?((?:US\$|CA\$|A\$|R\$|MX\$|TRY|Rs|kr|[$€£¥₺₹₱₩])\s*[0-9][0-9.,\s]*)\s*(?:\/|per)\s*(?:month|mo)/gi;
  for (const match of text.matchAll(pattern)) {
    const planLabel = `${match[1] ?? ""}${match[2]}`.trim();
    const plan = normalizePlan(planLabel);
    const priceText = match[3].trim();
    const localPrice = parseNumericPrice(priceText);
    const currency = inferCurrency(priceText, expectedCurrency);
    if (!plan || !localPrice || !currency) continue;
    candidates.push({ plan, planLabel, priceText, localPrice, currency });
  }

  const unique = [...new Map(
    candidates.map((candidate) => [
      `${candidate.plan}:${candidate.currency}:${candidate.localPrice}`,
      candidate,
    ]),
  ).values()];
  const selected = {};
  for (const plan of ["plus", "pro"]) {
    const matching = unique.filter((candidate) => candidate.plan === plan);
    if (matching.length === 1) selected[plan] = matching[0];
  }

  return {
    candidates: unique,
    selected,
    selectionRule: "publish only when one unambiguous monthly amount is adjacent to an official plan label",
  };
}

export function validateRegionalEvidence(raw, registry, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const errors = [];
  const storefront = registry.storefronts.find((item) => item.code === raw.storefront);
  if (!storefront) errors.push("unknown storefront");
  if (!OFFICIAL_HOSTS[raw.channel]) errors.push("unsupported channel");
  if (!["plus", "pro"].includes(raw.plan)) errors.push("unsupported plan");
  if (!Number.isFinite(raw.localPrice) || raw.localPrice <= 0) errors.push("invalid local price");
  if (!raw.localPriceDisplay) errors.push("missing displayed price");
  if (storefront && raw.currency !== storefront.currency) errors.push("currency does not match storefront registry");

  let sourceHost = null;
  try {
    const source = new URL(raw.sourceUrl);
    sourceHost = source.hostname.toLowerCase();
    if (source.protocol !== "https:") errors.push("source URL must use HTTPS");
    if (!OFFICIAL_HOSTS[raw.channel]?.has(sourceHost)) errors.push("source host is not official for channel");
  } catch {
    errors.push("invalid source URL");
  }

  const capturedAt = new Date(raw.capturedAt);
  if (Number.isNaN(capturedAt.getTime())) {
    errors.push("invalid capture time");
  } else if (capturedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
    errors.push("capture time is in the future");
  } else if (raw.evidenceScope === "regional_checkout") {
    const ageHours = (now.getTime() - capturedAt.getTime()) / 3_600_000;
    if (ageHours > (options.maxCheckoutAgeHours ?? 336)) errors.push("regional checkout evidence is stale");
  }

  if (raw.evidenceScope === "regional_checkout" && raw.observedRegion !== raw.storefront) {
    errors.push("observed checkout region does not match storefront");
  }
  if (!["regional_checkout", "usd_reference"].includes(raw.evidenceScope)) {
    errors.push("unsupported evidence scope");
  }
  if (
    raw.evidenceScope === "regional_checkout" &&
    !["checkout_dom", "billing_dialog", "checkout_pricing_config"].includes(raw.captureType)
  ) {
    errors.push("regional evidence requires a checkout capture type");
  }
  if (raw.evidenceScope === "usd_reference" && raw.captureType !== "official_help_article") {
    errors.push("USD reference requires an official help article");
  }
  if (raw.sourceSha256 && !/^[a-f0-9]{64}$/i.test(raw.sourceSha256)) errors.push("invalid source SHA-256");

  if (errors.length) return { accepted: false, errors };
  const normalized = {
    id: `${raw.channel}:${raw.storefront.toLowerCase()}:${raw.plan}`,
    product: "ChatGPT",
    channel: raw.channel,
    storefront: raw.storefront,
    storefrontNameZh: storefront.nameZh,
    plan: raw.plan,
    currency: raw.currency,
    localPrice: raw.localPrice,
    localPriceDisplay: raw.localPriceDisplay,
    sourceUrl: raw.sourceUrl,
    sourceHost,
    sourceSha256: raw.sourceSha256 ?? null,
    capturedAt: capturedAt.toISOString(),
    observedRegion: raw.observedRegion ?? null,
    captureType: raw.captureType,
    evidenceScope: raw.evidenceScope,
    verificationStatus: raw.evidenceScope === "regional_checkout"
      ? "official_checkout_evidence"
      : "official_usd_reference",
    evidence: {
      planText: raw.evidence?.planText ?? null,
      priceText: raw.evidence?.priceText ?? raw.localPriceDisplay,
      regionSignal: raw.evidence?.regionSignal ?? null,
      endpointCountry: raw.evidence?.endpointCountry ?? null,
      priceInterval: raw.evidence?.priceInterval ?? null,
      taxBehavior: raw.evidence?.taxBehavior ?? null,
      collectorVersion: raw.evidence?.collectorVersion ?? "regional-evidence-v1",
    },
  };
  normalized.evidenceSha256 = sha256(JSON.stringify([
    normalized.channel,
    normalized.storefront,
    normalized.plan,
    normalized.currency,
    normalized.localPrice,
    normalized.sourceUrl,
    normalized.capturedAt,
    normalized.evidence,
  ]));
  return { accepted: true, record: normalized };
}

export function assessRegionalRecords(records, previous, maximumPriceChangeRatio = 0.2) {
  const previousById = new Map((previous?.records ?? []).map((record) => [record.id, record]));
  const anomalies = [];
  for (const record of records) {
    const oldRecord = previousById.get(record.id);
    if (!oldRecord || oldRecord.evidenceScope !== record.evidenceScope) continue;
    const ratio = Math.abs(record.localPrice - oldRecord.localPrice) / oldRecord.localPrice;
    if (ratio > maximumPriceChangeRatio) {
      anomalies.push({
        id: record.id,
        previousPrice: oldRecord.localPrice,
        currentPrice: record.localPrice,
        changeRatio: Number(ratio.toFixed(4)),
      });
    }
  }
  return { accepted: anomalies.length === 0, anomalies, maximumPriceChangeRatio };
}
