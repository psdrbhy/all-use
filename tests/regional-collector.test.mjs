import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessRegionalRecords,
  extractChatGptCheckoutCandidates,
  validateRegionalEvidence,
} from "../scripts/lib/regional-evidence.mjs";
import { parseCheckoutPricingConfig } from "../scripts/lib/checkout-pricing-config.mjs";

const registry = {
  storefronts: [
    { code: "US", nameZh: "美国", currency: "USD" },
    { code: "JP", nameZh: "日本", currency: "JPY" },
    { code: "PH", nameZh: "菲律宾", currency: "PHP" },
  ],
};

test("normalizes the official country pricing config into publishable Plus and Pro evidence", () => {
  const parsed = parseCheckoutPricingConfig({
    country_code: "PH",
    currency_config: {
      symbol_code: "PHP",
      plus: { month: { amount: 1100, tax: "inclusive" } },
      pro: { month: { amount: 9990, tax: "inclusive" } },
    },
  }, {
    storefront: "PH",
    expectedCurrency: "PHP",
    capturedAt: "2026-07-17T11:00:00.000Z",
    sourceUrl: "https://chatgpt.com/backend-api/checkout_pricing_config/configs/PH",
  });

  assert.equal(parsed.countryCode, "PH");
  assert.equal(parsed.currency, "PHP");
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].localPrice, 1100);
  assert.equal(parsed.records[1].localPrice, 9990);
  assert.equal(parsed.records[0].captureType, "checkout_pricing_config");
  assert.equal(parsed.records[0].evidence.taxBehavior, "inclusive");
  assert.equal(parsed.sourceSha256.length, 64);
});

test("rejects a pricing config whose country or currency does not match the request", () => {
  const payload = {
    country_code: "JP",
    currency_config: {
      symbol_code: "JPY",
      plus: { month: { amount: 3000, tax: "inclusive" } },
      pro: { month: { amount: 16800, tax: "inclusive" } },
    },
  };
  assert.throws(() => parseCheckoutPricingConfig(payload, {
    storefront: "PH",
    expectedCurrency: "PHP",
    sourceUrl: "https://chatgpt.com/backend-api/checkout_pricing_config/configs/PH",
  }), /country mismatch/);
});

test("extracts only unambiguous monthly prices adjacent to official plan labels", () => {
  const html = `
    <article><h2>ChatGPT Plus</h2><strong>$20.00 / month</strong></article>
    <article><h2>ChatGPT Pro 20x</h2><strong>$200.00 / month</strong></article>
  `;
  const result = extractChatGptCheckoutCandidates(html, "USD");
  assert.equal(result.selected.plus.localPrice, 20);
  assert.equal(result.selected.pro.localPrice, 200);
  assert.equal(result.candidates.length, 2);
});

test("accepts sanitized official checkout evidence and rejects region mismatch", () => {
  const evidence = {
    channel: "web",
    storefront: "JP",
    plan: "plus",
    currency: "JPY",
    localPrice: 3000,
    localPriceDisplay: "¥3,000",
    sourceUrl: "https://chatgpt.com/pricing/",
    sourceSha256: "a".repeat(64),
    capturedAt: "2026-07-17T10:00:00.000Z",
    observedRegion: "JP",
    captureType: "checkout_dom",
    evidenceScope: "regional_checkout",
    evidence: { planText: "ChatGPT Plus", priceText: "¥3,000", regionSignal: "JP egress" },
  };
  const accepted = validateRegionalEvidence(evidence, registry, { now: "2026-07-17T11:00:00.000Z" });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.record.evidenceSha256.length, 64);

  const rejected = validateRegionalEvidence(
    { ...evidence, observedRegion: "US" },
    registry,
    { now: "2026-07-17T11:00:00.000Z" },
  );
  assert.equal(rejected.accepted, false);
  assert.ok(rejected.errors.includes("observed checkout region does not match storefront"));
});

test("rejects unofficial source hosts and stale checkout captures", () => {
  const evidence = {
    channel: "android",
    storefront: "US",
    plan: "plus",
    currency: "USD",
    localPrice: 20,
    localPriceDisplay: "$20.00",
    sourceUrl: "https://example.com/fake-checkout",
    capturedAt: "2026-06-01T00:00:00.000Z",
    observedRegion: "US",
    captureType: "billing_dialog",
    evidenceScope: "regional_checkout",
  };
  const result = validateRegionalEvidence(evidence, registry, { now: "2026-07-17T11:00:00.000Z" });
  assert.equal(result.accepted, false);
  assert.ok(result.errors.includes("source host is not official for channel"));
  assert.ok(result.errors.includes("regional checkout evidence is stale"));
});

test("quarantines large changes against the last accepted regional record", () => {
  const previous = { records: [{ id: "web:jp:plus", localPrice: 3000, evidenceScope: "regional_checkout" }] };
  const current = [{ id: "web:jp:plus", localPrice: 4500, evidenceScope: "regional_checkout" }];
  const quality = assessRegionalRecords(current, previous, 0.2);
  assert.equal(quality.accepted, false);
  assert.equal(quality.anomalies[0].changeRatio, 0.5);
});

test("generated regional dataset contains only validated official records", async () => {
  const data = JSON.parse(
    await readFile(new URL("../data/verified-regional-prices.json", import.meta.url), "utf8"),
  );
  assert.equal(data.quality.accepted, true);
  assert.ok(
    data.summary.webUsdReferences >= 1 ||
    data.records.some((record) =>
      record.channel === "web" &&
      record.storefront === "US" &&
      record.plan === "plus" &&
      record.evidenceScope === "regional_checkout"),
  );
  for (const record of data.records) {
    assert.match(record.sourceUrl, /^https:\/\/(chatgpt\.com|help\.openai\.com|openai\.com|play\.google\.com)\//);
    assert.equal(record.evidenceSha256.length, 64);
  }
});
