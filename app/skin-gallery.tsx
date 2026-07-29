"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Theme = {
  id: string;
  name: string;
  englishName: string;
  description: string;
  image: string;
  download: string;
  size: string;
  tags: string[];
  colors: string[];
};

const themes: Theme[] = [
  {
    id: "midnight-aurora",
    name: "午夜极光",
    englishName: "Midnight Aurora",
    description: "深蓝夜幕与流动极光，适合长时间专注的沉浸工作台。",
    image: "/themes/midnight-aurora.jpg",
    download: "/downloads/midnight-aurora.dreamskin",
    size: "117 KB",
    tags: ["暗色", "自然"],
    colors: ["#0a0e1a", "#2de1c2", "#7b6cff"],
  },
  {
    id: "sakura-dawn",
    name: "樱粉晨曦",
    englishName: "Sakura Dawn",
    description: "轻柔粉白与清晨微光，让界面明亮、松弛又不失层次。",
    image: "/themes/sakura-dawn.jpg",
    download: "/downloads/sakura-dawn.dreamskin",
    size: "100 KB",
    tags: ["明亮", "柔和"],
    colors: ["#fff5f8", "#e981a8", "#f4b9cc"],
  },
  {
    id: "amber-dusk",
    name: "琥珀黄昏",
    englishName: "Amber Dusk",
    description: "温暖琥珀与暮色交叠，适合夜晚创作和低刺激阅读。",
    image: "/themes/amber-dusk.jpg",
    download: "/downloads/amber-dusk.dreamskin",
    size: "114 KB",
    tags: ["暗色", "温暖"],
    colors: ["#19100b", "#ee9b43", "#f3c677"],
  },
  {
    id: "forest-mist",
    name: "森野薄雾",
    englishName: "Forest Mist",
    description: "低饱和绿意与雾气，克制、安静，适合日常长期使用。",
    image: "/themes/forest-mist.jpg",
    download: "/downloads/forest-mist.dreamskin",
    size: "112 KB",
    tags: ["自然", "柔和"],
    colors: ["#101a17", "#77b9a1", "#d6e2ce"],
  },
  {
    id: "cyber-neon",
    name: "赛博霓虹",
    englishName: "Cyber Neon",
    description: "高对比青紫霓虹，给深夜开发和灵感冲刺一点速度感。",
    image: "/themes/cyber-neon.jpg",
    download: "/downloads/cyber-neon.dreamskin",
    size: "124 KB",
    tags: ["暗色", "赛博"],
    colors: ["#090917", "#00e5ff", "#c154ff"],
  },
  {
    id: "pastel-custom",
    name: "粉系定制",
    englishName: "Pastel Custom",
    description: "柔雾粉白与抽象花瓣，明亮、轻盈，又给内容留足呼吸感。",
    image: "/themes/pastel-custom.jpg",
    download: "/downloads/pastel-custom.dreamskin",
    size: "93 KB",
    tags: ["明亮", "柔和"],
    colors: ["#fff5ef", "#d96691", "#ef9fba"],
  },
  {
    id: "fortune-work",
    name: "财神打工",
    englishName: "Fortune at Work",
    description: "宣纸底、朱红与鎏金，把传统吉祥意象变成一张现代工作台。",
    image: "/themes/fortune-work.jpg",
    download: "/downloads/fortune-work.dreamskin",
    size: "181 KB",
    tags: ["明亮", "国潮"],
    colors: ["#f8ead0", "#b91f24", "#d9ad49"],
  },
  {
    id: "red-white-sci-fi",
    name: "红白科幻",
    englishName: "Red / White Future",
    description: "巨型能量球、白色未来城与极简透视线，干净但有强烈空间感。",
    image: "/themes/red-white-sci-fi.jpg",
    download: "/downloads/red-white-sci-fi.dreamskin",
    size: "166 KB",
    tags: ["明亮", "科幻"],
    colors: ["#f8f5f2", "#c6323d", "#ff9189"],
  },
  {
    id: "crystal-clear",
    name: "清透定制",
    englishName: "Crystal Clear",
    description: "奶油纸感、鼠尾草绿与植物线条，低刺激、清爽耐看。",
    image: "/themes/crystal-clear.jpg",
    download: "/downloads/crystal-clear.dreamskin",
    size: "77 KB",
    tags: ["自然", "柔和"],
    colors: ["#f4f0e6", "#71866a", "#b89f6c"],
  },
  {
    id: "inspiration-cosmos",
    name: "灵感小宇宙",
    englishName: "Inspiration Cosmos",
    description: "彩色笔触、轨道与星芒交错，适合头脑风暴和快速创作。",
    image: "/themes/inspiration-cosmos.jpg",
    download: "/downloads/inspiration-cosmos.dreamskin",
    size: "140 KB",
    tags: ["明亮", "活力"],
    colors: ["#fff3d9", "#00a9a5", "#ff675f"],
  },
  {
    id: "violet-night",
    name: "紫夜限定",
    englishName: "Violet Night",
    description: "蓝紫星空、蝶影与柔光心形，给深夜工作一点浪漫氛围。",
    image: "/themes/violet-night.jpg",
    download: "/downloads/violet-night.dreamskin",
    size: "114 KB",
    tags: ["暗色", "梦幻"],
    colors: ["#100a2b", "#8f55ee", "#e03ba8"],
  },
  {
    id: "aqua-virtual-singer",
    name: "青蓝虚拟歌姬",
    englishName: "Aqua Virtual Stage",
    description: "抽象声波、全息丝带与青蓝舞台光，轻盈又有节奏感。",
    image: "/themes/aqua-virtual-singer.jpg",
    download: "/downloads/aqua-virtual-singer.dreamskin",
    size: "142 KB",
    tags: ["明亮", "科幻"],
    colors: ["#ecfbff", "#00aeb7", "#846bc2"],
  },
  {
    id: "black-gold-stage",
    name: "舞台黑金",
    englishName: "Black Gold Stage",
    description: "近黑舞台、暖金追光与复古麦克风意象，成熟、克制、电影感。",
    image: "/themes/black-gold-stage.jpg",
    download: "/downloads/black-gold-stage.dreamskin",
    size: "64 KB",
    tags: ["暗色", "舞台"],
    colors: ["#090807", "#d8aa57", "#f2e8cf"],
  },
];

const categories = ["全部", "暗色", "明亮", "自然", "柔和", "科幻", "国潮", "舞台"];

export default function SkinGallery() {
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Theme | null>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);

  const visibleThemes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return themes.filter((theme) => {
      const categoryMatch = category === "全部" || theme.tags.includes(category);
      const searchMatch = !normalized || [theme.name, theme.englishName, theme.description, ...theme.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
      return categoryMatch && searchMatch;
    });
  }, [category, query]);

  useEffect(() => {
    if (!preview) return;
    const focusFrame = window.requestAnimationFrame(() => previewCloseRef.current?.focus({ preventScroll: true }));
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [preview]);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="skin-view">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Dream Skin 首页">
          <span className="brand-mark">D</span>
          <span>Dream Skin</span>
        </a>
        <nav aria-label="主导航">
          <a href="#gallery">皮肤库</a>
          <a href="#how-it-works">如何使用</a>
          <a className="nav-button" href="https://github.com/Fei-Away/Codex-Dream-Skin" target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </nav>
      </header>

      <section className="hero hero-artwork-section" id="top">
        <h1 className="visually-hidden">Dream Skin，给 Codex 换个心情。</h1>
        <div className="hero-showcase">
          <div className="hero-artwork-frame">
            <img
              className="hero-artwork"
              src="/dream-skin-hero.png"
              width="1731"
              height="909"
              alt="Dream Skin，给 Codex 换个心情。Codex Theme Gallery"
            />
          </div>
          <aside className="hero-artwork-meta" aria-label="Dream Skin 功能">
            <div className="hero-artwork-copy">
              <span>你可以在这里</span>
              <strong>挑一张，给 Codex 换个心情。</strong>
              <p>预览喜欢的界面效果，再下载安全的 <code>.dreamskin</code> 皮肤包。</p>
            </div>
            <ul className="hero-capabilities">
              <li><b>{themes.length}</b><span>浏览精选皮肤</span></li>
              <li><b>↗</b><span>打开全屏预览</span></li>
              <li><b>↓</b><span>下载并交给 Codex</span></li>
            </ul>
            <div className="hero-artwork-actions">
              <button className="primary-button" type="button" onClick={() => scrollToSection("gallery")}>立即浏览 <span>↓</span></button>
              <button className="secondary-button" type="button" onClick={() => scrollToSection("how-it-works")}>查看使用方法</button>
            </div>
          </aside>
        </div>
      </section>

      <section className="gallery-section" id="gallery">
        <div className="section-heading">
          <div>
            <span className="section-kicker">CURATED COLLECTION</span>
            <h2>精选皮肤</h2>
          </div>
          <label className="search-box">
            <span className="search-icon" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索皮肤名称、风格或标签"
              aria-label="搜索皮肤"
            />
          </label>
        </div>

        <div className="category-row" aria-label="皮肤分类">
          {categories.map((item) => (
            <button
              className={category === item ? "category active" : "category"}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>

        {visibleThemes.length > 0 ? (
          <div className="theme-grid">
            {visibleThemes.map((theme, index) => (
              <article className="theme-card" key={theme.id}>
                <button
                  className="theme-image"
                  style={{ backgroundImage: `url(${theme.image})` }}
                  onClick={() => setPreview(theme)}
                  aria-label={`预览${theme.name}`}
                  type="button"
                >
                  <span className="card-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="preview-chip">全屏预览</span>
                </button>
                <div className="theme-content">
                  <div className="theme-title-row">
                    <div>
                      <h3>{theme.name}</h3>
                      <span>{theme.englishName}</span>
                    </div>
                    <div className="swatches" aria-label="主题色">
                      {theme.colors.map((color) => <i key={color} style={{ background: color }} />)}
                    </div>
                  </div>
                  <p>{theme.description}</p>
                  <div className="theme-meta">
                    <div>{theme.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
                    <span>{theme.size}</span>
                  </div>
                  <a className="download-button" href={theme.download} download>
                    下载皮肤包 <span>↓</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>没有找到匹配的皮肤</strong>
            <span>换一个关键词或分类试试。</span>
          </div>
        )}
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-copy">
          <span className="section-kicker">HOW IT WORKS</span>
          <h2>下载以后，<br />两种方式换上。</h2>
          <p>皮肤包只有主题配置和背景图。安装前会校验文件结构、大小和 SHA-256，不运行皮肤作者提供的任何脚本。</p>
        </div>
        <div className="steps">
          <article>
            <span>01</span>
            <div><strong>下载皮肤包</strong><p>在上方选择一套皮肤，下载单个 <code>.dreamskin</code> 文件。</p></div>
          </article>
          <article>
            <span>02</span>
            <div><strong>交给 Codex</strong><p>把文件拖进 Codex，然后说：“帮我安装并使用这个皮肤”。</p></div>
          </article>
          <article>
            <span>03</span>
            <div><strong>或者本地导入</strong><p>双击桌面的 Dream Skin Import，选择刚下载的文件即可。</p></div>
          </article>
        </div>
      </section>

      <footer>
        <div className="brand"><span className="brand-mark">D</span><span>Dream Skin</span></div>
        <p>非 OpenAI 官方产品 · 新增皮肤均为原创生成视觉，不含明星肖像或现成角色</p>
        <a href="#top">回到顶部 ↑</a>
      </footer>

      {preview && (
        <div
          className="preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${preview.name}全屏预览`}
          onClick={() => setPreview(null)}
          onWheel={(event) => event.preventDefault()}
          onTouchMove={(event) => event.preventDefault()}
        >
          <div className="preview-panel" onClick={(event) => event.stopPropagation()}>
            <button ref={previewCloseRef} className="preview-close" onClick={() => setPreview(null)} aria-label="关闭预览" type="button">×</button>
            <div className="preview-art" style={{ backgroundImage: `url(${preview.image})` }}>
              <div className="fake-sidebar">
                <span className="fake-logo">D</span>
                <i /><i /><i /><i />
              </div>
              <div className="fake-workspace">
                <span className="fake-label">DREAM SKIN PREVIEW</span>
                <strong>{preview.name}</strong>
                <p>{preview.description}</p>
                <div className="fake-composer">Ask Codex anything… <b>↗</b></div>
              </div>
            </div>
            <div className="preview-footer">
              <div><strong>{preview.name}</strong><span>{preview.englishName}</span></div>
              <a className="download-button" href={preview.download} download>下载这套皮肤 ↓</a>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
