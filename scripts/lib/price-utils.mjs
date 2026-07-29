import { createHash } from "node:crypto";

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function countryFlag(code) {
  return [...code.toUpperCase()]
    .map((character) => String.fromCodePoint(127397 + character.charCodeAt(0)))
    .join("");
}

function decodeJsonFragment(value) {
  try {
    return JSON.parse(`"${value.replaceAll('"', '\\"')}"`);
  } catch {
    return value;
  }
}

export function parseNumericPrice(displayPrice) {
  const compact = displayPrice.replace(/[\s\u00a0\u202f]/g, "");
  const numeric = compact.replace(/[^0-9.,]/g, "");
  if (!numeric) return null;

  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  let normalized = numeric;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalMark = lastComma > lastDot ? "," : ".";
    const thousandsMark = decimalMark === "," ? "." : ",";
    normalized = numeric.replaceAll(thousandsMark, "").replace(decimalMark, ".");
  } else {
    const mark = lastComma >= 0 ? "," : lastDot >= 0 ? "." : null;
    if (mark) {
      const parts = numeric.split(mark);
      const finalGroup = parts.at(-1) ?? "";
      if (parts.length > 2 || finalGroup.length === 3) {
        normalized = parts.join("");
      } else {
        normalized = `${parts.slice(0, -1).join("")}.${finalGroup}`;
      }
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function extractApplePrices(html) {
  const pairPattern =
    /"leadingText":"(ChatGPT Plus|ChatGPT Pro 20x)","trailingText":"((?:\\.|[^"\\])*)"/g;
  const matches = [];
  for (const match of html.matchAll(pairPattern)) {
    const label = decodeJsonFragment(match[1]);
    const display = decodeJsonFragment(match[2]);
    const amount = parseNumericPrice(display);
    if (amount !== null) matches.push({ label, display, amount });
  }

  const unique = [...new Map(matches.map((item) => [`${item.label}:${item.display}`, item])).values()];
  const plusCandidates = unique
    .filter((item) => item.label === "ChatGPT Plus")
    .sort((a, b) => a.amount - b.amount);
  const proCandidates = unique
    .filter((item) => item.label === "ChatGPT Pro 20x")
    .sort((a, b) => a.amount - b.amount);

  return {
    candidates: unique,
    selected: {
      plus: plusCandidates[0] ?? null,
      pro: proCandidates[0] ?? null,
    },
    selectionRule: "lowest matching official product label; annual duplicate retained in evidence",
  };
}

export function extractGooglePlayPriceRange(html) {
  const markerIndexes = [];
  for (const marker of ["feature\\u003dmd\\u0026offerId", "feature=md&offerId", "com.openai.chatgpt"]) {
    let markerIndex = html.indexOf(marker);
    while (markerIndex >= 0) {
      markerIndexes.push(markerIndex);
      markerIndex = html.indexOf(marker, markerIndex + marker.length);
    }
  }
  if (!markerIndexes.length) return null;

  const candidates = [];
  for (const match of html.matchAll(/"((?:\\.|[^"\\]){1,100}) per item"/g)) {
    const display = decodeJsonFragment(match[1]);
    const parts = display.split(/\s+[-–]\s+/);
    if (parts.length !== 2) continue;
    const minimum = parseNumericPrice(parts[0]);
    const maximum = parseNumericPrice(parts[1]);
    if (minimum === null || maximum === null || maximum < minimum) continue;
    const priceIndex = match.index ?? 0;
    const distance = Math.min(
      ...markerIndexes
        .filter((markerIndex) => markerIndex <= priceIndex)
        .map((markerIndex) => priceIndex - markerIndex),
    );
    if (Number.isFinite(distance) && distance <= 150_000) {
      candidates.push({ display, minimum, maximum, distance });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const selected = candidates[0];
  return selected
    ? { display: selected.display, minimum: selected.minimum, maximum: selected.maximum }
    : null;
}

export function convertToUsd(amount, currency, exchangeRates) {
  if (currency === "USD") return Number(amount.toFixed(2));
  const localRate = exchangeRates.rates[currency];
  const usdRate = exchangeRates.rates.USD;
  if (!localRate || !usdRate) return null;
  return Number(((amount / localRate) * usdRate).toFixed(2));
}

export function assessCandidateDataset(candidate, previous, reliability = {}) {
  const minimumCoverage = reliability.minimumCompleteCoverage ?? 0.8;
  const maximumPriceChangeRatio = reliability.maximumPriceChangeRatio ?? 0.2;
  const minimumSupportedWebCurrencies = reliability.minimumSupportedWebCurrencies ?? null;
  const minimumAndroidRangeCoverage = reliability.minimumAndroidRangeCoverage ?? null;
  const requiredBaselines = reliability.requiredBaselines ?? [
    { channel: "ios", storefront: "US", plans: ["plus", "pro"] },
  ];
  const records = candidate.records ?? [];
  const configured = candidate.summary?.configuredStorefronts ?? 0;
  const complete = candidate.summary?.completeStorefronts ?? 0;
  const coverage = configured > 0 ? complete / configured : 0;
  const ids = records.map((record) => record.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const invalidRecords = records.filter(
    (record) => !Number.isFinite(record.localPrice) || record.localPrice <= 0 || !record.sourceUrl,
  );
  const missingBaselines = [];

  for (const baseline of requiredBaselines) {
    for (const plan of baseline.plans) {
      const exists = records.some(
        (record) =>
          record.channel === baseline.channel &&
          record.storefront === baseline.storefront &&
          record.plan === plan,
      );
      if (!exists) missingBaselines.push(`${baseline.channel}:${baseline.storefront}:${plan}`);
    }
  }

  const previousById = new Map((previous?.records ?? []).map((record) => [record.id, record]));
  const priceAnomalies = [];
  for (const record of records) {
    const oldRecord = previousById.get(record.id);
    if (!oldRecord) continue;
    if (oldRecord.currency !== record.currency) {
      priceAnomalies.push({
        id: record.id,
        reason: "currency_changed",
        previousCurrency: oldRecord.currency,
        currentCurrency: record.currency,
      });
      continue;
    }
    const changeRatio = Math.abs(record.localPrice - oldRecord.localPrice) / oldRecord.localPrice;
    if (changeRatio > maximumPriceChangeRatio) {
      priceAnomalies.push({
        id: record.id,
        reason: "price_change_exceeded_threshold",
        previousPrice: oldRecord.localPrice,
        currentPrice: record.localPrice,
        changeRatio: Number(changeRatio.toFixed(4)),
      });
    }
  }

  const checks = [
    {
      id: "minimum_coverage",
      passed: coverage >= minimumCoverage,
      detail: `${complete}/${configured} storefronts (${Math.round(coverage * 100)}%)`,
    },
    {
      id: "required_baselines",
      passed: missingBaselines.length === 0,
      detail: missingBaselines.length ? `missing ${missingBaselines.join(", ")}` : "all required baselines present",
    },
    {
      id: "unique_record_ids",
      passed: duplicateIds.length === 0,
      detail: duplicateIds.length ? `duplicates: ${[...new Set(duplicateIds)].join(", ")}` : "all record IDs unique",
    },
    {
      id: "valid_official_records",
      passed: invalidRecords.length === 0,
      detail: invalidRecords.length ? `invalid: ${invalidRecords.map((record) => record.id).join(", ")}` : "all records have a positive price and source URL",
    },
    {
      id: "price_change_guard",
      passed: priceAnomalies.length === 0,
      detail: previous
        ? priceAnomalies.length
          ? `${priceAnomalies.length} anomalous changes`
          : `no changes above ${Math.round(maximumPriceChangeRatio * 100)}%`
        : "first accepted dataset; no prior comparison",
    },
  ];

  if (minimumSupportedWebCurrencies !== null) {
    const supportedWebCurrencies = candidate.webChannel?.supportedCurrencies?.length ?? 0;
    checks.push({
      id: "web_currency_reference",
      passed: supportedWebCurrencies >= minimumSupportedWebCurrencies,
      detail: `${supportedWebCurrencies} official web billing currencies found`,
    });
  }


  if (minimumAndroidRangeCoverage !== null) {
    const androidConfigured = candidate.androidChannel?.configuredStorefronts ?? 0;
    const androidCollected = candidate.androidChannel?.collectedStorefronts ?? 0;
    const androidCoverage = androidConfigured > 0 ? androidCollected / androidConfigured : 0;
    checks.push({
      id: "android_range_coverage",
      passed: androidCoverage >= minimumAndroidRangeCoverage,
      detail: `${androidCollected}/${androidConfigured} official Google Play ranges (${Math.round(androidCoverage * 100)}%)`,
    });
  }

  return {
    accepted: checks.every((check) => check.passed),
    checkedAt: new Date().toISOString(),
    thresholds: {
      minimumCoverage,
      maximumPriceChangeRatio,
      minimumSupportedWebCurrencies,
      minimumAndroidRangeCoverage,
    },
    checks,
    anomalies: priceAnomalies,
  };
}
