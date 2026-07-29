import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assessRegionalRecords, validateRegionalEvidence } from "./lib/regional-evidence.mjs";
import { convertToUsd } from "./lib/price-utils.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const registry = JSON.parse(await readFile(resolve(projectRoot, "data/price-sources.json"), "utf8"));
const regionalConfig = JSON.parse(await readFile(resolve(projectRoot, "data/regional-price-sources.json"), "utf8"));
const verifiedBase = JSON.parse(await readFile(resolve(projectRoot, "data/verified-prices.json"), "utf8"));
const inboxDirectory = resolve(projectRoot, process.env.REGIONAL_EVIDENCE_DIR ?? "data/evidence/inbox");
const outputPath = resolve(projectRoot, "data/verified-regional-prices.json");
const statusPath = resolve(projectRoot, "data/regional-collection-status.json");
const runsDirectory = resolve(projectRoot, "data/regional-runs");

async function readJsonIfPresent(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function loadInbox() {
  await mkdir(inboxDirectory, { recursive: true });
  const names = (await readdir(inboxDirectory)).filter((name) => name.endsWith(".json")).sort();
  const entries = [];
  const failures = [];
  for (const name of names) {
    try {
      entries.push({ file: name, value: JSON.parse(await readFile(resolve(inboxDirectory, name), "utf8")) });
    } catch (error) {
      failures.push({ file: name, errors: [String(error?.message ?? error)] });
    }
  }
  return { entries, failures };
}

function buildOfficialReferences() {
  const results = [];
  for (const expected of regionalConfig.officialUsdReferences) {
    const source = verifiedBase.officialReferences.find((reference) => reference.kind === expected.sourceKind);
    const observedPrices = [
      ...(source?.evidence?.monthlyUsdPrices ?? []),
      ...(source?.evidence?.detectedUsdAmounts ?? []),
    ];
    if (source?.status !== "reachable" || !observedPrices.includes(expected.expectedMonthlyPrice)) continue;
    results.push({
      channel: expected.channel,
      storefront: expected.storefront,
      plan: expected.plan,
      currency: expected.currency,
      localPrice: expected.expectedMonthlyPrice,
      localPriceDisplay: `$${expected.expectedMonthlyPrice.toFixed(2)}`,
      sourceUrl: source.finalUrl ?? source.url,
      sourceSha256: source.sourceSha256,
      capturedAt: source.collectedAt,
      observedRegion: "US",
      captureType: "official_help_article",
      evidenceScope: "usd_reference",
      evidence: {
        planText: expected.plan === "plus" ? "ChatGPT Plus" : "ChatGPT Pro 20x",
        priceText: `$${expected.expectedMonthlyPrice}/month`,
        regionSignal: "official USD subscription reference",
        collectorVersion: "official-reference-import-v1",
      },
    });
  }
  return results;
}

const runStartedAt = new Date().toISOString();
const runPath = resolve(runsDirectory, `${runStartedAt.replaceAll(":", "-")}.json`);
const previous = await readJsonIfPresent(outputPath);
const inbox = await loadInbox();
const inputs = [
  ...buildOfficialReferences().map((value) => ({ file: "verified-prices.json", value })),
  ...inbox.entries,
];
const records = [];
const failures = [...inbox.failures];

for (const input of inputs) {
  const validation = validateRegionalEvidence(input.value, registry, {
    maxCheckoutAgeHours: regionalConfig.policy.maximumCheckoutAgeHours,
  });
  if (!validation.accepted) {
    failures.push({ file: input.file, errors: validation.errors });
    continue;
  }
  records.push({
    ...validation.record,
    usdEquivalent: convertToUsd(validation.record.localPrice, validation.record.currency, verifiedBase.exchangeRates),
    usdRateDate: verifiedBase.exchangeRates.date,
  });
}

const latestById = new Map();
for (const record of records.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))) {
  latestById.set(record.id, record);
}
const publishedRecords = [...latestById.values()].sort((a, b) => a.id.localeCompare(b.id));
const anomalyCheck = assessRegionalRecords(
  publishedRecords,
  previous,
  regionalConfig.policy.maximumPriceChangeRatio,
);
const webReferences = publishedRecords.filter(
  (record) => record.channel === "web" && record.evidenceScope === "usd_reference",
);
const webCheckout = publishedRecords.filter(
  (record) => record.channel === "web" && record.evidenceScope === "regional_checkout",
);
const androidCheckout = publishedRecords.filter(
  (record) => record.channel === "android" && record.evidenceScope === "regional_checkout",
);
const qualityChecks = [
  {
    id: "official_usd_reference",
    passed: webReferences.some((record) => record.plan === "plus") || webCheckout.some(
      (record) => record.storefront === "US" && record.plan === "plus",
    ),
    detail: webCheckout.some((record) => record.storefront === "US" && record.plan === "plus")
      ? "official US checkout config verified"
      : `${webReferences.length} current official USD plan references`,
  },
  {
    id: "regional_price_change_guard",
    passed: anomalyCheck.accepted,
    detail: anomalyCheck.accepted
      ? `no changes above ${Math.round(anomalyCheck.maximumPriceChangeRatio * 100)}%`
      : `${anomalyCheck.anomalies.length} anomalous regional price changes`,
  },
];
const accepted = qualityChecks.every((check) => check.passed);
const generatedAt = new Date().toISOString();
const output = {
  schemaVersion: 1,
  generatedAt,
  runStartedAt,
  policy: regionalConfig.policy,
  summary: {
    records: publishedRecords.length,
    webUsdReferences: webReferences.length,
    webRegionalCheckoutRecords: webCheckout.length,
    webRegionalStorefronts: new Set(webCheckout.map((record) => record.storefront)).size,
    androidRegionalCheckoutRecords: androidCheckout.length,
    androidRegionalStorefronts: new Set(androidCheckout.map((record) => record.storefront)).size,
    rejectedEvidenceFiles: failures.length,
  },
  quality: { accepted, checks: qualityChecks, anomalies: anomalyCheck.anomalies },
  records: publishedRecords,
  failures,
};

await writeJsonAtomic(runPath, output);
await writeJsonAtomic(statusPath, {
  schemaVersion: 1,
  lastRunAt: generatedAt,
  lastRunStatus: accepted ? "accepted" : "quarantined",
  lastRunArtifact: `data/regional-runs/${runPath.split("/").at(-1)}`,
  lastAcceptedAt: accepted ? generatedAt : previous?.generatedAt ?? null,
  servingLastKnownGood: !accepted && Boolean(previous),
  quality: output.quality,
});

if (!accepted) {
  console.error(JSON.stringify({ status: "quarantined", run: runPath, quality: output.quality }, null, 2));
  process.exitCode = 1;
} else {
  await writeJsonAtomic(outputPath, output);
  console.log(JSON.stringify({ status: "accepted", output: outputPath, ...output.summary }, null, 2));
}
