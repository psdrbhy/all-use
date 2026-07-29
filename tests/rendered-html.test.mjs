import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the unified multi-tool experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>数字服务雷达｜订阅、中转站、VPN 与网络工具<\/title>/i);
  assert.match(html, /og\.png/);
  assert.match(html, /ChatGPT 价格对比/);
  assert.match(html, /VPN 实测性能/);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /当前工具/);
  assert.match(html, /ChatGPT 全球订阅观察/);
  assert.match(html, /全球价格排行/);
  assert.match(html, /网页订阅/);
  assert.match(html, /Google Play/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton|codex-preview/);
});

test("keeps both products and their downloadable skin assets", async () => {
  const [page, skinGallery, ipChecker, ipIntelligence, envExample, layout, globals, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/skin-gallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ip-checker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ip-intelligence/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /verified-regional-prices\.json/);
  assert.match(page, /官方结账配置/);
  assert.match(page, /tool-switcher/);
  assert.match(page, /preferred-tool/);
  assert.match(page, /<RelayPurity \/>/);
  assert.match(page, /<RelayCompare \/>/);
  assert.match(page, /<VpnCompare \/>/);
  assert.match(page, /<TaxAddressGenerator \/>/);
  assert.match(page, /<IpChecker \/>/);
  assert.match(page, /experience === "purity"/);
  assert.match(page, /experience === "relayCompare"/);
  assert.match(page, /experience === "vpn"/);
  assert.match(page, /experience === "address"/);
  assert.match(page, /experience === "ip"/);
  assert.match(page, /中转站纯度检测/);
  assert.match(page, /中转站对比/);
  assert.match(page, /VPN 对比/);
  assert.match(page, /ONE SITE · SEVEN TOOLS/);
  assert.match(page, /INTERACTIVE PRICE ATLAS/);
  assert.match(page, /全球订阅价格地图/);
  assert.match(page, /mapCoordinates/);
  assert.match(page, /selectedMapRecord/);
  assert.match(page, /地图只为有当前渠道证据的地区着色/);
  assert.match(page, /AR:\{x:32,y:79\}/);
  assert.match(page, /NG:\{x:50,y:59\}/);
  assert.match(ipChecker, /MULTI-SOURCE INTELLIGENCE/);
  assert.match(ipChecker, /聚合 IP 风险扫描/);
  assert.match(ipChecker, /AbuseIPDB、CrowdSec、VirusTotal/);
  assert.match(ipIntelligence, /api\.ipapi\.is/);
  assert.match(ipIntelligence, /api\.techniknews\.net/);
  assert.match(ipIntelligence, /proxycheck\.io/);
  assert.match(ipIntelligence, /api\.abuseipdb\.com/);
  assert.match(ipIntelligence, /virustotal\.com/);
  assert.match(ipIntelligence, /cti\.api\.crowdsec\.net/);
  assert.match(ipIntelligence, /Spamhaus DROP/);
  assert.match(envExample, /ABUSEIPDB_API_KEY=/);
  assert.match(envExample, /VIRUSTOTAL_API_KEY=/);
  assert.match(envExample, /CROWDSEC_CTI_API_KEY=/);
  assert.match(skinGallery, /午夜极光/);
  assert.match(skinGallery, /粉系定制/);
  assert.match(skinGallery, /舞台黑金/);
  assert.match(skinGallery, /dream-skin-hero\.png/);
  assert.match(skinGallery, /你可以在这里/);
  assert.match(skinGallery, /下载并交给 Codex/);
  assert.match(skinGallery, /scrollIntoView/);
  assert.doesNotMatch(skinGallery, /document\.body\.style\.overflow = "hidden"/);
  assert.match(skinGallery, /onWheel=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(skinGallery, /focus\(\{ preventScroll: true \}\)/);
  assert.match(skinGallery, /\/downloads\/cyber-neon\.dreamskin/);
  assert.match(layout, /数字服务雷达/);
  assert.match(layout, /summary_large_image/);
  assert.match(globals, /@keyframes tool-enter \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  for (const slug of [
    "midnight-aurora",
    "sakura-dawn",
    "amber-dusk",
    "forest-mist",
    "cyber-neon",
    "pastel-custom",
    "fortune-work",
    "red-white-sci-fi",
    "crystal-clear",
    "inspiration-cosmos",
    "violet-night",
    "aqua-virtual-singer",
    "black-gold-stage",
  ]) {
    const themePackage = await readFile(new URL(`../public/downloads/${slug}.dreamskin`, import.meta.url));
    assert.deepEqual([...themePackage.subarray(0, 2)], [0x50, 0x4b]);
    await access(new URL(`../public/themes/${slug}.jpg`, import.meta.url));
  }
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/dream-skin-hero.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
