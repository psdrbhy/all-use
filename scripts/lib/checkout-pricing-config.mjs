import { sha256 } from "./price-utils.mjs";

export const WEB_PRICING_PLANS = ["plus", "pro"];

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function normalizeCountryCode(value) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new Error("invalid checkout pricing country code");
  return code;
}

function normalizeCurrency(value) {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("invalid checkout pricing currency");
  return currency;
}

function formatLocalPrice(amount, currency) {
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseCheckoutPricingConfig(payload, options) {
  const root = requireObject(payload, "checkout pricing response");
  const requestedStorefront = normalizeCountryCode(options?.storefront);
  const observedRegion = normalizeCountryCode(root.country_code);
  if (observedRegion !== requestedStorefront) {
    throw new Error(`checkout pricing country mismatch: requested ${requestedStorefront}, received ${observedRegion}`);
  }

  const currencyConfig = requireObject(root.currency_config, "currency_config");
  const currency = normalizeCurrency(currencyConfig.symbol_code);
  if (options?.expectedCurrency && currency !== normalizeCurrency(options.expectedCurrency)) {
    throw new Error(
      `checkout pricing currency mismatch: expected ${options.expectedCurrency}, received ${currency}`,
    );
  }

  const capturedAt = new Date(options?.capturedAt ?? Date.now());
  if (Number.isNaN(capturedAt.getTime())) throw new Error("invalid checkout pricing capture time");
  const sourceUrl = new URL(options?.sourceUrl);
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "chatgpt.com") {
    throw new Error("checkout pricing source must be an official ChatGPT HTTPS URL");
  }
  const sourceSha256 = sha256(JSON.stringify(root));

  const records = WEB_PRICING_PLANS.map((plan) => {
    const planConfig = requireObject(currencyConfig[plan], `currency_config.${plan}`);
    const monthly = requireObject(planConfig.month, `currency_config.${plan}.month`);
    const amount = Number(monthly.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error(`currency_config.${plan}.month.amount must be a positive number`);
    }
    const taxBehavior = typeof monthly.tax === "string" ? monthly.tax : null;
    const display = formatLocalPrice(amount, currency);

    return {
      channel: "web",
      storefront: requestedStorefront,
      plan,
      currency,
      localPrice: amount,
      localPriceDisplay: display,
      sourceUrl: sourceUrl.toString(),
      sourceSha256,
      capturedAt: capturedAt.toISOString(),
      observedRegion,
      captureType: "checkout_pricing_config",
      evidenceScope: "regional_checkout",
      evidence: {
        planText: plan === "plus" ? "ChatGPT Plus" : "ChatGPT Pro 20x",
        priceText: display,
        regionSignal: `official checkout config country_code=${observedRegion}`,
        endpointCountry: observedRegion,
        priceInterval: "month",
        taxBehavior,
        collectorVersion: "chatgpt-checkout-config-v1",
      },
    };
  });

  return {
    countryCode: observedRegion,
    currency,
    sourceSha256,
    records,
  };
}
