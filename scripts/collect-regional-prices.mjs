import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const workerPath = resolve(scriptDir, "workers/probe-regional-source.mjs");
const probesDirectory = resolve(projectRoot, "data/regional-probes");
const inboxDirectory = resolve(projectRoot, "data/evidence/inbox");
const args = new Map(
  process.argv.slice(2).map((value) => {
    const [key, ...rest] = value.replace(/^--/, "").split("=");
    return [key, rest.join("=") || true];
  }),
);
const requestedStorefronts = String(args.get("storefront") ?? "US")
  .split(",")
  .map((value) => value.trim().toUpperCase())
  .filter(Boolean);
const channels = String(args.get("channel") ?? "web")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const allowDirect = args.has("direct");

let proxyMap = {};
if (process.env.REGIONAL_PROXY_MAP_JSON) {
  try {
    proxyMap = JSON.parse(process.env.REGIONAL_PROXY_MAP_JSON);
  } catch {
    throw new Error("REGIONAL_PROXY_MAP_JSON is not valid JSON");
  }
} else {
  const configPath = resolve(
    projectRoot,
    process.env.REGIONAL_PROXY_CONFIG_PATH ?? ".regional-proxies.json",
  );
  try {
    proxyMap = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw new Error("Regional proxy config file is not valid JSON");
    }
  }
}

async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
}

function runWorker(storefront, channel, proxyConfig) {
  return new Promise((resolveWorker, rejectWorker) => {
    const proxy = typeof proxyConfig === "string" ? proxyConfig : proxyConfig?.proxy;
    const attestedRegion = typeof proxyConfig === "object" ? proxyConfig?.attestedRegion : null;
    const environment = {
      ...process.env,
      PRICE_STOREFRONT: storefront,
      PRICE_CHANNEL: channel,
      REGION_ATTESTED: attestedRegion === storefront ? storefront : "",
    };
    if (proxy) {
      environment.HTTPS_PROXY = proxy;
      environment.HTTP_PROXY = proxy;
    }
    const child = spawn(process.execPath, ["--use-env-proxy", workerPath], {
      cwd: projectRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectWorker);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectWorker(new Error(stderr.trim() || `regional worker exited with ${code}`));
        return;
      }
      try {
        resolveWorker(JSON.parse(stdout.trim()));
      } catch {
        rejectWorker(new Error("regional worker returned invalid JSON"));
      }
    });
  });
}

const jobs = [];
for (const storefront of requestedStorefronts) {
  const proxyConfig = proxyMap[storefront];
  if (!proxyConfig && !allowDirect) {
    jobs.push({ storefront, status: "skipped", reason: "no configured regional proxy" });
    continue;
  }
  for (const channel of channels) {
    jobs.push(await runWorker(storefront, channel, proxyConfig));
  }
}

for (const result of jobs) {
  const timestamp = (result.capturedAt ?? new Date().toISOString()).replaceAll(":", "-");
  const stem = `${timestamp}-${result.storefront ?? "unknown"}-${result.channel ?? "none"}`;
  await writeJsonAtomic(resolve(probesDirectory, `${stem}.json`), result);
  for (const record of result.records ?? []) {
    await writeJsonAtomic(resolve(inboxDirectory, `${stem}-${record.plan}.json`), record);
  }
}

console.log(JSON.stringify({
  requestedStorefronts,
  channels,
  directMode: allowDirect,
  summary: jobs.map((job) => ({
    storefront: job.storefront,
    channel: job.channel ?? null,
    status: job.status,
    publishedEvidence: job.records?.length ?? 0,
  })),
}, null, 2));
