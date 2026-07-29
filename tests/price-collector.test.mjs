import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessCandidateDataset,
  convertToUsd,
  countryFlag,
  extractApplePrices,
  extractGooglePlayPriceRange,
  parseNumericPrice,
  sha256,
} from "../scripts/lib/price-utils.mjs";

test("parses localized price formats without guessing the currency", () => {
  assert.equal(parseNumericPrice("Rs 4,900.00"), 4900);
  assert.equal(parseNumericPrice("22,99 €"), 22.99);
  assert.equal(parseNumericPrice("₺9.999,99"), 9999.99);
  assert.equal(parseNumericPrice("¥30,000"), 30000);
  assert.equal(parseNumericPrice("not a price"), null);
});

test("selects monthly Plus and explicit Pro while retaining annual evidence", () => {
  const fixture = [
    '"leadingText":"ChatGPT Plus","trailingText":"¥30,000"',
    '"leadingText":"ChatGPT Pro 20x","trailingText":"¥30,000"',
    '"leadingText":"ChatGPT Plus","trailingText":"¥3,000"',
  ].join(",");
  const result = extractApplePrices(fixture);
  assert.equal(result.selected.plus?.amount, 3000);
  assert.equal(result.selected.pro?.amount, 30000);
  assert.equal(result.candidates.length, 3);
});

test("extracts the official app in-purchase range nearest Google Play's product marker", () => {
  const fixture = [
    'feature\\u003dmd\\u0026offerId"],null,["Install"]',
    '["$8.00 - $200.00 per item",[0]]',
    'recommended-app-data["$0.99 - $999.99 per item",[0]]',
  ].join("---");
  assert.deepEqual(extractGooglePlayPriceRange(fixture), {
    display: "$8.00 - $200.00",
    minimum: 8,
    maximum: 200,
  });
});

test("converts only currencies present in the official rate set", () => {
  const exchangeRates = { rates: { EUR: 1, USD: 1.15, JPY: 186.5 } };
  assert.equal(convertToUsd(3000, "JPY", exchangeRates), 18.5);
  assert.equal(convertToUsd(19.99, "USD", exchangeRates), 19.99);
  assert.equal(convertToUsd(4900, "PKR", exchangeRates), null);
});

test("accepts a healthy candidate and rejects missing baselines", () => {
  const records = [
    { id: "ios:us:plus", channel: "ios", storefront: "US", plan: "plus", currency: "USD", localPrice: 19.99, sourceUrl: "https://apps.apple.com/us/app/id1" },
    { id: "ios:us:pro", channel: "ios", storefront: "US", plan: "pro", currency: "USD", localPrice: 199.99, sourceUrl: "https://apps.apple.com/us/app/id1" },
  ];
  const healthy = assessCandidateDataset(
    { summary: { configuredStorefronts: 1, completeStorefronts: 1 }, records },
    null,
  );
  assert.equal(healthy.accepted, true);

  const missingBaseline = assessCandidateDataset(
    { summary: { configuredStorefronts: 1, completeStorefronts: 1 }, records: records.slice(0, 1) },
    null,
  );
  assert.equal(missingBaseline.accepted, false);
  assert.equal(missingBaseline.checks.find((check) => check.id === "required_baselines")?.passed, false);
});

test("quarantines unexpected local-price jumps while keeping normal changes", () => {
  const previous = {
    records: [
      { id: "ios:us:plus", channel: "ios", storefront: "US", plan: "plus", currency: "USD", localPrice: 19.99, sourceUrl: "https://apps.apple.com/us/app/id1" },
      { id: "ios:us:pro", channel: "ios", storefront: "US", plan: "pro", currency: "USD", localPrice: 199.99, sourceUrl: "https://apps.apple.com/us/app/id1" },
    ],
  };
  const candidate = {
    summary: { configuredStorefronts: 1, completeStorefronts: 1 },
    records: previous.records.map((record) => ({ ...record })),
  };
  assert.equal(assessCandidateDataset(candidate, previous).accepted, true);
  candidate.records[0].localPrice = 29.99;
  const quality = assessCandidateDataset(candidate, previous);
  assert.equal(quality.accepted, false);
  assert.equal(quality.anomalies[0]?.id, "ios:us:plus");
});

test("generated dataset contains only official Apple records with evidence", async () => {
  const data = JSON.parse(await readFile(new URL("../data/verified-prices.json", import.meta.url), "utf8"));
  assert.equal(data.summary.configuredStorefronts, 17);
  assert.equal(data.summary.completeStorefronts, 17);
  assert.equal(data.summary.failedStorefronts, 0);
  assert.equal(data.records.length, 34);
  if (data.schemaVersion >= 2) {
    assert.equal(data.quality.accepted, true);
    assert.ok(data.webChannel.supportedCurrencies.length >= 60);
    assert.match(data.webChannel.referenceUrl, /^https:\/\/help\.openai\.com\//);
    assert.ok(
      data.androidChannel.collectedStorefronts / data.androidChannel.configuredStorefronts >= 0.7,
    );
  }
  for (const record of data.records) {
    assert.equal(record.sourceType, "official_apple_app_store_listing");
    assert.match(record.sourceUrl, /^https:\/\/apps\.apple\.com\//);
    assert.equal(record.sourceSha256.length, 64);
    assert.equal(record.verificationStatus, "official_source_collected");
    assert.ok(record.evidence.candidates.length >= 2);
  }
  assert.deepEqual(
    data.records.filter((record) => ["AR", "NG"].includes(record.storefront)).map((record) => record.id).sort(),
    ["ios:ar:plus", "ios:ar:pro", "ios:ng:plus", "ios:ng:pro"],
  );
});

test("hashes and country flags are deterministic", () => {
  assert.equal(sha256("snapshot").length, 64);
  assert.equal(countryFlag("JP"), "🇯🇵");
});
