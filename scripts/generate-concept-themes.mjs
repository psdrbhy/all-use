import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "public/themes");

const defs = (extra = "") => `<defs>
  <filter id="blur"><feGaussianBlur stdDeviation="80"/></filter>
  <filter id="glow"><feGaussianBlur stdDeviation="22"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="7"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 .07 0"/></filter>
  ${extra}
</defs>`;

const svg = (body, extraDefs = "") => `<svg xmlns="http://www.w3.org/2000/svg" width="2560" height="1440" viewBox="0 0 2560 1440">
${defs(extraDefs)}${body}<rect width="2560" height="1440" filter="url(#grain)" opacity=".35"/></svg>`;

const themes = {
  "pastel-custom": svg(`
    <rect width="2560" height="1440" fill="#fff5ef"/>
    <ellipse cx="2080" cy="310" rx="570" ry="470" fill="#ffb6ce" opacity=".7" filter="url(#blur)"/>
    <ellipse cx="2210" cy="1120" rx="600" ry="430" fill="#e98bb0" opacity=".58" filter="url(#blur)"/>
    <ellipse cx="1680" cy="830" rx="420" ry="360" fill="#ffe1e8" opacity=".9" filter="url(#blur)"/>
    ${[0,1,2,3,4,5,6].map((i)=>`<g transform="translate(${1700+i*125} ${300+(i%3)*300}) rotate(${i*31})"><ellipse rx="130" ry="220" fill="${i%2?'#f7a2bc':'#fff0f3'}" opacity=".86"/><ellipse rx="55" ry="145" fill="#d96691" opacity=".5" transform="rotate(54)"/><circle r="34" fill="#fff7d7"/></g>`).join("")}
    <path d="M1280 1350 C1600 1120 1710 420 2460 120" fill="none" stroke="#fff" stroke-width="12" opacity=".45"/>
    <g fill="#fff" opacity=".7">${[0,1,2,3,4,5,6,7,8].map(i=>`<circle cx="${1460+i*120}" cy="${170+(i%4)*270}" r="${8+(i%3)*5}"/>`).join("")}</g>
  `),
  "fortune-work": svg(`
    <rect width="2560" height="1440" fill="#f8ead0"/>
    <circle cx="2050" cy="700" r="660" fill="#b91f24"/>
    <circle cx="2050" cy="700" r="530" fill="#cf2e2e" stroke="#e9bd57" stroke-width="18"/>
    <g fill="none" stroke="#d9ad49" stroke-width="24" stroke-linecap="round" opacity=".9">
      <path d="M1330 320 C1450 210 1590 220 1660 330 C1740 230 1900 250 1930 390 C1830 430 1530 430 1330 320Z"/>
      <path d="M1510 1120 C1690 960 1880 1010 1940 1130 C2050 990 2260 1020 2350 1180"/>
    </g>
    <g fill="#f4c85a" stroke="#8f171d" stroke-width="16">${[0,1,2,3,4,5].map(i=>`<g transform="translate(${1640+(i%3)*280} ${460+Math.floor(i/3)*350})"><path d="M-115 25 Q0-110 115 25 L75 105 Q0 150-75 105Z"/><ellipse cy="25" rx="68" ry="30" fill="#fff0a5"/></g>`).join("")}</g>
    <g fill="none" stroke="#cc9d39" stroke-width="4" opacity=".32">${[0,1,2,3,4].map(i=>`<path d="M0 ${220+i*230} C420 ${80+i*220} 780 ${410+i*170} 1260 ${230+i*220}"/>`).join("")}</g>
  `),
  "red-white-sci-fi": svg(`
    <rect width="2560" height="1440" fill="#f8f5f2"/>
    <radialGradient id="sphere" cx="42%" cy="36%"><stop stop-color="#ff948c"/><stop offset=".55" stop-color="#ed514d"/><stop offset="1" stop-color="#a81724"/></radialGradient>
    <circle cx="2040" cy="520" r="560" fill="url(#sphere)"/>
    <g fill="none" stroke="#ffd2cb" opacity=".45">${[0,1,2,3,4,5].map(i=>`<ellipse cx="2040" cy="520" rx="${520-i*40}" ry="${170+i*55}" transform="rotate(${i*17} 2040 520)"/>`).join("")}</g>
    <path d="M2040 40 L2040 1300" stroke="#fff" stroke-width="22" filter="url(#glow)"/><path d="M2040 40 L2040 1300" stroke="#fff" stroke-width="5"/>
    <path d="M980 1440 L1800 830 L2280 830 L2560 1440Z" fill="#fff"/>
    <g fill="#e5e6e7" stroke="#c6323d" stroke-width="5"><path d="M1600 1120 L1700 650 L1800 1120Z"/><path d="M1810 1120 L1910 520 L2020 1120Z"/><path d="M2130 1120 L2210 680 L2310 1120Z"/><path d="M2360 1120 L2410 760 L2490 1120Z"/></g>
    <g stroke="#d84b51" stroke-width="6" opacity=".6"><path d="M980 1440 L2040 870"/><path d="M1380 1440 L2040 870"/><path d="M2520 1440 L2040 870"/></g>
  `),
  "crystal-clear": svg(`
    <rect width="2560" height="1440" fill="#f4f0e6"/>
    <ellipse cx="2120" cy="650" rx="620" ry="570" fill="#b8c7a5" opacity=".55" filter="url(#blur)"/>
    <ellipse cx="1900" cy="1180" rx="500" ry="260" fill="#d8b98a" opacity=".28" filter="url(#blur)"/>
    <g fill="none" stroke="#71866a" stroke-width="18" stroke-linecap="round">
      <path d="M1680 1310 C1800 1020 1900 720 2260 180"/>
      ${[0,1,2,3,4,5].map(i=>`<ellipse cx="${1810+i*100}" cy="${1070-i*150}" rx="85" ry="155" transform="rotate(${i%2?48:-42} ${1810+i*100} ${1070-i*150})" fill="#9cad8f" opacity=".75"/>`).join("")}
    </g>
    <g fill="none" stroke="#b89f6c" opacity=".38"><path d="M0 1050 C430 900 700 1110 1120 880"/><path d="M250 250 C540 370 780 180 1140 340"/></g>
    <path d="M2200 350 l150 85 -150 85 -150-85z" fill="#fff" opacity=".75"/><path d="M2200 350v170m-150-85h300" stroke="#aeb5a6" opacity=".6"/>
  `),
  "inspiration-cosmos": svg(`
    <rect width="2560" height="1440" fill="#fff3d9"/>
    <ellipse cx="2050" cy="680" rx="650" ry="590" fill="#ffd34d" opacity=".42" filter="url(#blur)"/>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">${["#00a9a5","#ff675f","#f5b900","#5f62d8"].map((c,i)=>`<path d="M${1350+i*130} ${260+i*220} C${1620+i*90} ${40+i*220} ${1900+i*80} ${520+i*130} ${2440-i*60} ${180+i*240}" stroke="${c}" stroke-width="${42-i*5}" opacity=".8"/>`).join("")}</g>
    <g fill="#ff675f">${[0,1,2,3,4,5].map(i=>`<path d="M${1600+i*150} ${900+(i%2)*180} l26 62 68 5 -52 44 16 66 -58-36 -58 36 16-66 -52-44 68-5z" opacity="${.55+i*.06}"/>`).join("")}</g>
    <g fill="none" stroke="#00a9a5" stroke-width="16" opacity=".55"><circle cx="2050" cy="720" r="270"/><circle cx="2050" cy="720" r="390" stroke-dasharray="32 42"/></g>
    <g fill="#5f62d8" opacity=".5">${[0,1,2,3,4,5,6].map(i=>`<circle cx="${1250+i*180}" cy="${1180-(i%3)*170}" r="${12+i*3}"/>`).join("")}</g>
  `),
  "violet-night": svg(`
    <rect width="2560" height="1440" fill="#100a2b"/>
    <ellipse cx="2090" cy="560" rx="680" ry="540" fill="#6e32d8" opacity=".72" filter="url(#blur)"/>
    <ellipse cx="2260" cy="1080" rx="480" ry="330" fill="#e03ba8" opacity=".55" filter="url(#blur)"/>
    <ellipse cx="1740" cy="980" rx="420" ry="280" fill="#1f87e5" opacity=".52" filter="url(#blur)"/>
    <g fill="none" stroke="#c5a7ff" stroke-width="8" opacity=".75"><path d="M1700 760 C1780 540 2040 520 2110 740 C2180 520 2440 540 2490 760 C2460 980 2190 1120 2110 1210 C2020 1110 1740 980 1700 760Z"/></g>
    <g fill="#fff">${Array.from({length:28},(_,i)=>`<circle cx="${980+(i*149)%1460}" cy="${90+(i*233)%1180}" r="${2+(i%4)*2}" opacity="${.3+(i%5)*.13}"/>`).join("")}</g>
    <g fill="#7de5ff" opacity=".65">${[0,1,2,3,4].map(i=>`<path d="M${1700+i*180} ${260+(i%2)*250} q70-90 140 0 q-70 100-140 0z" transform="rotate(${i*24} ${1770+i*180} ${260+(i%2)*250})"/>`).join("")}</g>
  `),
  "aqua-virtual-singer": svg(`
    <rect width="2560" height="1440" fill="#ecfbff"/>
    <ellipse cx="2130" cy="650" rx="700" ry="570" fill="#66dfe4" opacity=".52" filter="url(#blur)"/>
    <ellipse cx="2260" cy="1100" rx="520" ry="320" fill="#bc79dc" opacity=".38" filter="url(#blur)"/>
    <g fill="none" stroke-linecap="round">${["#00bfc8","#6a8ee8","#f08fae","#9f6dcc"].map((c,i)=>`<path d="M1150 ${530+i*135} C1450 ${150+i*120} 1850 ${1040-i*80} 2520 ${300+i*210}" stroke="${c}" stroke-width="${34-i*4}" opacity=".72"/>`).join("")}</g>
    <g fill="none" stroke="#fff" stroke-width="12" opacity=".7"><path d="M1530 890 Q1690 650 1850 890 T2170 890 T2490 890"/><path d="M1580 980 Q1740 740 1900 980 T2220 980 T2540 980"/></g>
    <g fill="#fff" opacity=".82">${[0,1,2,3,4,5,6,7].map(i=>`<path d="M${1580+i*125} ${230+(i%3)*250} l18 42 46 4 -35 30 11 45 -40-24 -40 24 11-45 -35-30 46-4z"/>`).join("")}</g>
    <g fill="none" stroke="#2bbbc5" opacity=".35">${[0,1,2,3,4].map(i=>`<circle cx="${1900+i*130}" cy="${690+(i%2)*260}" r="${90+i*20}"/>`).join("")}</g>
  `),
  "black-gold-stage": svg(`
    <rect width="2560" height="1440" fill="#090807"/>
    <radialGradient id="spot"><stop stop-color="#e9bd6c" stop-opacity=".6"/><stop offset="1" stop-color="#090807" stop-opacity="0"/></radialGradient>
    <ellipse cx="2100" cy="470" rx="650" ry="520" fill="url(#spot)"/>
    <path d="M1960 0 L1650 1300 L2460 1300 L2240 0Z" fill="#d9a94f" opacity=".09"/>
    <g stroke="#d8aa57" fill="none"><path d="M2180 430 V1110" stroke-width="24"/><ellipse cx="2180" cy="390" rx="105" ry="155" stroke-width="18"/><path d="M2075 350h210M2080 400h200M2100 450h160" stroke-width="10" opacity=".7"/><path d="M2050 1110h260" stroke-width="25" stroke-linecap="round"/></g>
    <g fill="#f2e8cf">${[0,1,2,3,4].map(i=>`<g transform="translate(${1830+i*140} ${1090+(i%2)*110})"><ellipse rx="55" ry="22" transform="rotate(${i*33})"/><ellipse rx="55" ry="22" transform="rotate(${90+i*33})"/><circle r="14" fill="#d7ad58"/></g>`).join("")}</g>
    <g fill="#d9a94f">${Array.from({length:24},(_,i)=>`<circle cx="${1100+(i*137)%1300}" cy="${120+(i*239)%1040}" r="${2+(i%4)*2}" opacity="${.2+(i%5)*.12}"/>`).join("")}</g>
    <path d="M1020 760 C1320 710 1500 810 1780 760" fill="none" stroke="#d9a94f" stroke-width="5" stroke-dasharray="6 22" opacity=".4"/>
  `),
};

await mkdir(outDir, { recursive: true });
for (const [slug, artwork] of Object.entries(themes)) {
  await sharp(Buffer.from(artwork)).jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true }).toFile(path.join(outDir, `${slug}.jpg`));
  console.log(`generated ${slug}.jpg`);
}
