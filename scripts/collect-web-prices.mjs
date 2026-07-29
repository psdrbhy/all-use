import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { parseCheckoutPricingConfig } from "./lib/checkout-pricing-config.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const registry = JSON.parse(await readFile(resolve(projectRoot, "data/price-sources.json"), "utf8"));
const probesDirectory = resolve(projectRoot, "data/regional-probes");
const inboxDirectory = resolve(projectRoot, "data/evidence/inbox");
const defaultProfileDirectory = resolve(projectRoot, ".cache/chatgpt-pricing-chrome");
const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const args = new Map(
  process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  }),
);
const headed = !args.has("headless") && process.env.CHATGPT_PRICING_HEADED !== "0";
const requestedCodes = String(args.get("storefront") ?? "all")
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const storefronts = requestedCodes.includes("ALL")
  ? registry.storefronts
  : requestedCodes.map((code) => {
      const storefront = registry.storefronts.find((item) => item.code === code);
      if (!storefront) throw new Error(`Unknown storefront: ${code}`);
      return storefront;
    });

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

async function waitForPricingPage(page) {
  const deadline = Date.now() + (headed ? 120_000 : 20_000);
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => ({
      title: document.title,
      text: document.body?.innerText?.slice(0, 500) ?? "",
    }));
    const blocked = /just a moment|security check|verify you are human/i.test(state.title) ||
      /enable javascript and cookies|verify you are human/i.test(state.text);
    if (!blocked) return;
    await page.waitForTimeout(1_000);
  }
  throw new Error(
    headed
      ? "ChatGPT browser verification was not completed in time"
      : "ChatGPT requires a normal browser session; rerun without --headless",
  );
}

async function fetchCountryConfig(page, storefront) {
  const endpoint = `https://chatgpt.com/backend-api/checkout_pricing_config/configs/${storefront.code}`;
  const response = await page.evaluate(async ({ url }) => {
    const result = await fetch(url, {
      credentials: "include",
      headers: { accept: "application/json" },
    });
    const body = await result.text();
    let json = null;
    try {
      json = JSON.parse(body);
    } catch {}
    return {
      ok: result.ok,
      status: result.status,
      url: result.url,
      json,
      bodyPreview: body.slice(0, 300),
    };
  }, { url: endpoint });
  if (!response.ok || !response.json) {
    throw new Error(
      `official pricing endpoint returned HTTP ${response.status}: ${response.bodyPreview || "empty response"}`,
    );
  }
  return { endpoint, payload: response.json };
}

const profileDirectory = resolve(
  projectRoot,
  process.env.CHATGPT_PRICING_PROFILE_DIR ?? defaultProfileDirectory,
);
const executablePath = process.env.CHATGPT_CHROME_PATH ?? defaultChromePath;
await mkdir(profileDirectory, { recursive: true });
const context = await chromium.launchPersistentContext(profileDirectory, {
  executablePath,
  headless: !headed,
  viewport: headed ? null : { width: 1280, height: 900 },
});
const page = context.pages()[0] ?? await context.newPage();
const results = [];

try {
  await page.goto("https://chatgpt.com/#pricing", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await waitForPricingPage(page);

  for (const storefront of storefronts) {
    const capturedAt = new Date().toISOString();
    try {
      const { endpoint, payload } = await fetchCountryConfig(page, storefront);
      const parsed = parseCheckoutPricingConfig(payload, {
        storefront: storefront.code,
        expectedCurrency: storefront.currency,
        capturedAt,
        sourceUrl: endpoint,
      });
      const timestamp = capturedAt.replaceAll(":", "-");
      const probe = {
        storefront: storefront.code,
        channel: "web",
        status: "exact_prices_detected",
        capturedAt,
        endpoint,
        currency: parsed.currency,
        sourceSha256: parsed.sourceSha256,
        records: parsed.records,
      };
      await writeJsonAtomic(
        resolve(probesDirectory, `${timestamp}-${storefront.code}-web-config.json`),
        probe,
      );
      for (const record of parsed.records) {
        await writeJsonAtomic(
          resolve(inboxDirectory, `${timestamp}-${storefront.code}-web-${record.plan}.json`),
          record,
        );
      }
      results.push({
        storefront: storefront.code,
        status: "exact_prices_detected",
        currency: parsed.currency,
        prices: Object.fromEntries(parsed.records.map((record) => [record.plan, record.localPriceDisplay])),
      });
    } catch (error) {
      const message = String(error?.message ?? error);
      const notLocalized = /checkout pricing (country|currency) mismatch/i.test(message);
      const failure = {
        storefront: storefront.code,
        channel: "web",
        status: notLocalized ? "not_localized" : "failed",
        capturedAt,
        records: [],
        error: message,
      };
      await writeJsonAtomic(
        resolve(probesDirectory, `${capturedAt.replaceAll(":", "-")}-${storefront.code}-web-config.json`),
        failure,
      );
      results.push({ storefront: storefront.code, status: failure.status, error: failure.error });
    }
    await page.waitForTimeout(350);
  }
} finally {
  await context.close();
}

const failures = results.filter((result) => result.status === "failed");
const skipped = results.filter((result) => result.status === "not_localized");
console.log(JSON.stringify({
  mode: headed ? "headed" : "headless",
  requestedStorefronts: storefronts.map((storefront) => storefront.code),
  collectedStorefronts: results.length - failures.length - skipped.length,
  skippedStorefronts: skipped.length,
  failures: failures.length,
  results,
}, null, 2));
if (failures.length) process.exitCode = 1;
