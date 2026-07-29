import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessCandidateDataset,
  convertToUsd,
  countryFlag,
  extractApplePrices,
  extractGooglePlayPriceRange,
  sha256,
} from "./lib/price-utils.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const registryPath = resolve(projectRoot, "data/price-sources.json");
const outputPath = resolve(projectRoot, "data/verified-prices.json");
const statusPath = resolve(projectRoot, "data/collection-status.json");
const runsDirectory = resolve(projectRoot, "data/runs");
const registry = JSON.parse(await readFile(registryPath, "utf8"));

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 SubscriptionRadar/1.0";

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { response, body, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 750));
    }
  }
  throw lastError;
}

async function collectEcbRates(source) {
  const { response, body } = await fetchWithRetry(source.url);
  const date = body.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1] ?? null;
  const rates = { EUR: 1 };
  for (const match of body.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    rates[match[1]] = Number(match[2]);
  }
  if (!date || !rates.USD) throw new Error("ECB response did not contain a date and USD rate");
  return {
    provider: source.provider,
    sourceUrl: source.url,
    base: source.base,
    date,
    rates,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
    sourceSha256: sha256(body),
  };
}

async function collectOfficialReference(reference) {
  const collectedAt = new Date().toISOString();
  try {
    const { response, body } = await fetchWithRetry(reference.url);
    const readableBody = body
      .replaceAll("\\u0024", "$")
      .replaceAll("\\u002F", "/")
      .replaceAll("&dollar;", "$");
    const supportedCurrencies = reference.kind === "openai_multi_currency"
      ? [...new Set([...readableBody.matchAll(/\b([A-Z]{3})\s*\(/g)].map((match) => match[1]))].sort()
      : [];
    const monthlyUsdPrices = reference.kind === "chatgpt_plus_plan" || reference.kind === "chatgpt_pro_plan"
      ? [...new Set([...readableBody.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:\/|per)\s*month/gi)]
        .map((match) => Number(match[1])))]
        .sort((a, b) => a - b)
      : [];
    const detectedUsdAmounts = reference.kind === "chatgpt_plus_plan" || reference.kind === "chatgpt_pro_plan"
      ? [...new Set([...readableBody.matchAll(/\$\s*([0-9]+(?:\.[0-9]+)?)/g)]
        .map((match) => Number(match[1]))
        .filter((amount) => amount >= 5 && amount <= 1_000))]
        .sort((a, b) => a - b)
      : [];
    return {
      ...reference,
      status: "reachable",
      collectedAt,
      finalUrl: response.url,
      sourceSha256: sha256(body),
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      evidence: {
        ...(supportedCurrencies.length ? { supportedCurrencies } : {}),
        ...(monthlyUsdPrices.length ? { monthlyUsdPrices } : {}),
        ...(detectedUsdAmounts.length ? { detectedUsdAmounts } : {}),
      },
    };
  } catch (error) {
    return { ...reference, status: "unreachable", collectedAt, error: String(error?.message ?? error) };
  }
}

async function collectStorefront(storefront, exchangeRates) {
  const sourceUrl = `https://apps.apple.com/${storefront.slug}/app/chatgpt/id${registry.product.appleAppId}?platform=vision`;
  const collectedAt = new Date().toISOString();
  try {
    const { response, body, attempt } = await fetchWithRetry(sourceUrl);
    const sellerPresent = body.includes(registry.product.seller) || body.includes("OpenAI OpCo");
    const appIdPresent = body.includes(registry.product.appleAppId);
    if (!sellerPresent || !appIdPresent) {
      throw new Error("Official seller or Apple app ID missing from response");
    }

    const extraction = extractApplePrices(body);
    const records = [];
    for (const plan of ["plus", "pro"]) {
      const selected = extraction.selected[plan];
      if (!selected) continue;
      records.push({
        id: `ios:${storefront.code.toLowerCase()}:${plan}`,
        product: registry.product.name,
        plan,
        channel: "ios",
        storefront: storefront.code,
        storefrontNameZh: storefront.nameZh,
        flag: countryFlag(storefront.code),
        currency: storefront.currency,
        localPrice: selected.amount,
        localPriceDisplay: selected.display,
        usdEquivalent: convertToUsd(selected.amount, storefront.currency, exchangeRates),
        usdRateDate: exchangeRates.date,
        sourceType: "official_apple_app_store_listing",
        sourceUrl: response.url,
        sourceSha256: sha256(body),
        sourceEtag: response.headers.get("etag"),
        sourceLastModified: response.headers.get("last-modified"),
        collectedAt,
        verificationStatus: "official_source_collected",
        parserVersion: "apple-annotation-text-pair-v1",
        evidence: {
          selectedLabel: selected.label,
          selectedDisplay: selected.display,
          candidates: extraction.candidates,
          selectionRule: extraction.selectionRule,
          fetchAttempt: attempt,
        },
      });
    }

    if (!records.length) throw new Error("No recognized ChatGPT subscription labels found");
    return {
      storefront: storefront.code,
      status: records.length === 2 ? "complete" : "partial",
      records,
      missingPlans: ["plus", "pro"].filter((plan) => !records.some((record) => record.plan === plan)),
    };
  } catch (error) {
    return {
      storefront: storefront.code,
      status: "failed",
      records: [],
      sourceUrl,
      collectedAt,
      error: String(error?.message ?? error),
    };
  }
}

async function collectGooglePlayRange(storefront) {
  const sourceUrl = `https://play.google.com/store/apps/details?id=${registry.product.googlePlayPackage}&hl=en_US&gl=${storefront.code}`;
  const collectedAt = new Date().toISOString();
  try {
    const { response, body, attempt } = await fetchWithRetry(sourceUrl);
    const packagePresent = body.includes(registry.product.googlePlayPackage);
    const developerPresent = body.includes("OpenAI") || body.includes("OPENAI");
    if (!packagePresent || !developerPresent) {
      throw new Error("Official Google Play package or developer name missing from response");
    }
    const priceRange = extractGooglePlayPriceRange(body);
    if (!priceRange) throw new Error("Official in-app purchase range not found");
    return {
      storefront: storefront.code,
      storefrontNameZh: storefront.nameZh,
      status: "range_collected",
      currency: storefront.currency,
      rangeDisplay: priceRange.display,
      minimumLocalPrice: priceRange.minimum,
      maximumLocalPrice: priceRange.maximum,
      sourceUrl: response.url,
      sourceSha256: sha256(body),
      collectedAt,
      fetchAttempt: attempt,
      verificationStatus: "official_google_play_range_collected",
      limitation: "Google Play public listing exposes an in-app purchase range, not a plan-to-price mapping.",
    };
  } catch (error) {
    return {
      storefront: storefront.code,
      storefrontNameZh: storefront.nameZh,
      status: "failed",
      sourceUrl,
      collectedAt,
      error: String(error?.message ?? error),
    };
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
  return results;
}

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

function runFileName(isoDate) {
  return `${isoDate.replaceAll(":", "-")}.json`;
}

async function collectCandidate(runStartedAt, previous) {
  const exchangeRates = await collectEcbRates(registry.exchangeRateSource);
  const officialReferences = await Promise.all(registry.officialReferences.map(collectOfficialReference));
  const webCurrencyReference = officialReferences.find(
    (reference) => reference.kind === "openai_multi_currency",
  );
  const collectedWebCurrencies = webCurrencyReference?.evidence?.supportedCurrencies ?? [];
  const previousWebCurrencies = previous?.webChannel?.supportedCurrencies ?? [];
  const supportedWebCurrencies = collectedWebCurrencies.length
    ? collectedWebCurrencies
    : previousWebCurrencies;
  const reusedWebCurrencyReference = !collectedWebCurrencies.length && previousWebCurrencies.length > 0;
  const storefrontResults = await mapWithConcurrency(
    registry.storefronts,
    3,
    (storefront) => collectStorefront(storefront, exchangeRates),
  );
  const androidRangeResults = await mapWithConcurrency(
    registry.storefronts,
    3,
    collectGooglePlayRange,
  );
  const records = storefrontResults.flatMap((result) => result.records);
  const failures = storefrontResults
    .filter((result) => result.status !== "complete")
    .map(({ records: ignored, ...result }) => result);

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    runStartedAt,
    product: registry.product,
    policy: {
      failClosed: true,
      acceptedPriceSources: ["Official Apple App Store public product listing"],
      conversionSource: "European Central Bank daily reference rates",
      notes: [
        "Web, iOS, and Android prices are separate channels and are never merged.",
        "Tax treatment is not inferred from price text and is intentionally omitted.",
        "A missing official price produces a failure record, never an estimated value.",
        "USD equivalents are omitted when the official exchange-rate feed lacks a currency.",
        "Candidates that fail coverage, baseline, integrity, or price-change checks are quarantined.",
        "When the auxiliary web-currency reference is temporarily unreachable, its last accepted scope may be carried forward while newly collected platform prices remain independently verified.",
      ],
    },
    exchangeRates,
    officialReferences,
    webChannel: {
      status: collectedWebCurrencies.length
        ? "currency_scope_verified"
        : reusedWebCurrencyReference
          ? "currency_scope_carried_forward"
          : "reference_unavailable",
      supportedCurrencies: supportedWebCurrencies,
      referenceUrl: collectedWebCurrencies.length
        ? webCurrencyReference?.finalUrl ?? webCurrencyReference?.url ?? null
        : previous?.webChannel?.referenceUrl ?? webCurrencyReference?.url ?? null,
      referenceCollectedAt: collectedWebCurrencies.length
        ? webCurrencyReference?.collectedAt ?? null
        : previous?.webChannel?.referenceCollectedAt ?? null,
      referenceFresh: collectedWebCurrencies.length > 0,
      publishedRegionalPrices: 0,
      note: reusedWebCurrencyReference
        ? "The official currency reference was temporarily unreachable, so the last accepted currency scope is retained; regional checkout prices remain separate."
        : "Official currency coverage is verified; regional checkout prices remain unpublished until location-specific official checkout evidence is collected.",
    },
    androidChannel: {
      status: androidRangeResults.some((result) => result.status === "range_collected")
        ? "official_ranges_collected"
        : "reference_unavailable",
      configuredStorefronts: registry.storefronts.length,
      collectedStorefronts: androidRangeResults.filter((result) => result.status === "range_collected").length,
      priceRanges: androidRangeResults.filter((result) => result.status === "range_collected"),
      failures: androidRangeResults.filter((result) => result.status === "failed"),
      note: "Official public listings expose broad in-app purchase ranges only; plan-specific Android prices remain unpublished.",
    },
    summary: {
      configuredStorefronts: registry.storefronts.length,
      completeStorefronts: storefrontResults.filter((result) => result.status === "complete").length,
      partialStorefronts: storefrontResults.filter((result) => result.status === "partial").length,
      failedStorefronts: storefrontResults.filter((result) => result.status === "failed").length,
      records: records.length,
    },
    records,
    failures,
  };
}

async function main() {
  const runStartedAt = new Date().toISOString();
  const runPath = resolve(runsDirectory, runFileName(runStartedAt));
  const previous = await readJsonIfPresent(outputPath);

  try {
    const candidate = await collectCandidate(runStartedAt, previous);
    const quality = assessCandidateDataset(candidate, previous, registry.reliability);
    const runArtifact = {
      ...candidate,
      quality,
      promotion: {
        status: quality.accepted ? "accepted" : "quarantined",
        previousAcceptedAt: previous?.generatedAt ?? null,
      },
    };
    await writeJsonAtomic(runPath, runArtifact);

    const status = {
      schemaVersion: 1,
      lastRunAt: candidate.generatedAt,
      lastRunStatus: quality.accepted ? "accepted" : "quarantined",
      lastRunArtifact: `data/runs/${runFileName(runStartedAt)}`,
      lastAcceptedAt: quality.accepted ? candidate.generatedAt : previous?.generatedAt ?? null,
      servingLastKnownGood: !quality.accepted && Boolean(previous),
      quality,
    };
    await writeJsonAtomic(statusPath, status);

    if (!quality.accepted) {
      console.error(JSON.stringify({ status: "quarantined", run: runPath, quality }, null, 2));
      process.exitCode = 1;
      return;
    }

    const promoted = {
      ...candidate,
      quality,
      provenance: {
        runArtifact: `data/runs/${runFileName(runStartedAt)}`,
        previousAcceptedAt: previous?.generatedAt ?? null,
      },
    };
    await writeJsonAtomic(outputPath, promoted);
    console.log(
      JSON.stringify(
        {
          status: "accepted",
          output: outputPath,
          run: runPath,
          ...candidate.summary,
          rateDate: candidate.exchangeRates.date,
          qualityChecks: quality.checks.length,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const failedAt = new Date().toISOString();
    const failure = {
      schemaVersion: 1,
      runStartedAt,
      failedAt,
      promotion: { status: "failed", previousAcceptedAt: previous?.generatedAt ?? null },
      error: String(error?.stack ?? error?.message ?? error),
    };
    await writeJsonAtomic(runPath, failure);
    await writeJsonAtomic(statusPath, {
      schemaVersion: 1,
      lastRunAt: failedAt,
      lastRunStatus: "failed",
      lastRunArtifact: `data/runs/${runFileName(runStartedAt)}`,
      lastAcceptedAt: previous?.generatedAt ?? null,
      servingLastKnownGood: Boolean(previous),
      error: String(error?.message ?? error),
    });
    console.error(JSON.stringify({ status: "failed", run: runPath, error: String(error?.message ?? error) }, null, 2));
    process.exitCode = 1;
  }
}

await main();
