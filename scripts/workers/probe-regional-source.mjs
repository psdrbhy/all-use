import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extractChatGptCheckoutCandidates } from "../lib/regional-evidence.mjs";
import { extractGooglePlayPriceRange, sha256 } from "../lib/price-utils.mjs";

const projectRoot = resolve(import.meta.dirname, "../..");
const registry = JSON.parse(await readFile(resolve(projectRoot, "data/price-sources.json"), "utf8"));
const storefront = registry.storefronts.find((item) => item.code === process.env.PRICE_STOREFRONT);
const channel = process.env.PRICE_CHANNEL;
if (!storefront) throw new Error("Unknown PRICE_STOREFRONT");
if (!["web", "android"].includes(channel)) throw new Error("PRICE_CHANNEL must be web or android");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36 SubscriptionRadarRegional/1.0";

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
        signal: AbortSignal.timeout(30_000),
      });
      const body = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { response, body, attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 800));
    }
  }
  throw lastError;
}

const sourceUrl = channel === "web"
  ? "https://chatgpt.com/pricing/"
  : `https://play.google.com/store/apps/details?id=${registry.product.googlePlayPackage}&hl=en_US&gl=${storefront.code}`;
const capturedAt = new Date().toISOString();

try {
  const { response, body, attempt } = await fetchWithRetry(sourceUrl);
  const sourceSha256 = sha256(body);
  if (channel === "web") {
    const extraction = extractChatGptCheckoutCandidates(body, storefront.currency);
    const selected = Object.values(extraction.selected);
    const attested = process.env.REGION_ATTESTED === storefront.code;
    const records = attested
      ? selected.map((candidate) => ({
        channel,
        storefront: storefront.code,
        plan: candidate.plan,
        currency: candidate.currency,
        localPrice: candidate.localPrice,
        localPriceDisplay: candidate.priceText,
        sourceUrl: response.url,
        sourceSha256,
        capturedAt,
        observedRegion: storefront.code,
        captureType: "checkout_dom",
        evidenceScope: "regional_checkout",
        evidence: {
          planText: candidate.planLabel,
          priceText: candidate.priceText,
          regionSignal: `attested egress ${storefront.code} and matching checkout currency`,
          collectorVersion: "regional-http-probe-v1",
        },
      }))
      : [];
    console.log(JSON.stringify({
      storefront: storefront.code,
      channel,
      status: records.length ? "exact_prices_detected" : extraction.candidates.length ? "needs_attestation_or_review" : "no_exact_prices",
      capturedAt,
      finalUrl: response.url,
      sourceSha256,
      fetchAttempt: attempt,
      attestedRegion: attested ? storefront.code : null,
      candidates: extraction.candidates,
      records,
      limitation: attested
        ? extraction.selectionRule
        : "Direct or unattested egress is diagnostic only and cannot publish regional prices.",
    }));
  } else {
    const range = extractGooglePlayPriceRange(body);
    console.log(JSON.stringify({
      storefront: storefront.code,
      channel,
      status: range ? "official_range_only" : "no_price_range",
      capturedAt,
      finalUrl: response.url,
      sourceSha256,
      fetchAttempt: attempt,
      range,
      records: [],
      limitation: "The public Google Play listing does not map in-app prices to Plus or Pro product IDs.",
    }));
  }
} catch (error) {
  console.log(JSON.stringify({
    storefront: storefront.code,
    channel,
    status: "failed",
    capturedAt,
    sourceUrl,
    records: [],
    error: String(error?.message ?? error),
  }));
}
