// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      3.0.0
// @description  一键手动抓取新闻，支持导出Markdown和生成日报
// @author       You
// @match        *://*/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_openInTab
// @grant        GM_addElement
// @grant        GM_addStyle
// @connect     *
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "news_crawler_data";
  const FEEDS_KEY = "news_crawler_feeds";
  const SETTINGS_KEY = "news_crawler_settings";

  const DEFAULT_SETTINGS = { downloadFolder: "新闻日报", topNewsCount: 3 };

  const SOURCE_PRIORITY = {
    "人民日报": 10, "新华网": 10, "央视新闻": 10, "中国新闻网": 9,
    "澎湃新闻": 8, "观察者网": 8, "环球时报": 7, "参考消息": 7,
    "腾讯新闻": 6, "新浪新闻": 6, "网易新闻": 6, "搜狐新闻": 5,
    "知乎热榜": 7, "36氪": 7, "虎嗅": 7, "IT之家": 6,
  };

  const DEFAULT_FEEDS = [
    { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
    { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
    { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
    { name: "搜狐新闻", url: "https://www.sohu.com/rss/rss.xml", type: "xml" },
    { name: "知乎热榜", url: "https://www.zhihu.com/rss", type: "xml" },
    { name: "36氪", url: "https://36kr.com/feed", type: "xml" },
    { name: "虎嗅", url: "https://www.huxiu.com/rss/", type: "xml" },
    { name: "IT之家", url: "https://www.ithome.com/rss/", type: "xml" },
    { name: "观察者网", url: "https://www.guancha.cn/rss/", type: "xml" },
    { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
  ];

  function getSettings() { return GM_getValue(SETTINGS_KEY) || DEFAULT_SETTINGS; }
  function getTodayStr() { return new Date().toISOString().slice(0, 10); }

  function init() {
    if (!GM_getValue(FEEDS_KEY)) GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
    createUI();
    console.log("[新闻爬取器] 已启动");
  }

  function createUI() {
    GM_addStyle(`
      .nc-fab{position:fixed;bottom:24px;left:24px;width:56px;height:56px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;box-shadow:0 4px 20px rgba(74,158,255,.4);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:all .3s}
      .nc-fab:hover{transform:scale(1.1)}
      .nc-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:10px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
      .nc-panel{position:fixed;bottom:90px;left:24px;width:380px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .nc-panel.show{display:flex;animation:ncFadeIn .2s}
      @keyframes ncFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      .nc-header{padding:16px 20px;background:linear-gradient(135deg,#4a9eff,#6b5bff);color:#fff;display:flex;justify-content:space-between;align-items:center}
      .nc-title{font-size:16px;font-weight:600}
      .nc-close{width:28px;height:28px;border:none;background:rgba(255,255,255,.2);border-radius:50%;cursor:pointer;color:#fff;font-size:18px}
      .nc-toolbar{padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;display:flex;gap:8px;flex-wrap:wrap}
      .nc-btn{padding:6px 12px;font-size:12px;border:1px solid #ddd;background:#fff;border-radius:6px;cursor:pointer;color:#555}
      .nc-btn:hover{background:#f5f5f5}
      .nc-btn.primary{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-btn.primary:hover{background:#3a8eef}
      .nc-list{flex:1;overflow-y:auto;padding:8px 0}
      .nc-source{margin-bottom:12px}
      .nc-source-title{padding:8px 16px;font-size:12px;font-weight:600;color:#888;background:#f5f5f5}
      .nc-item{padding:12px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer}
      .nc-item:hover{background:#f0f7ff}
      .nc-item:last-child{border-bottom:none}
      .nc-item-title{font-size:13px;color:#333;line-height:1.4;margin-bottom:4px}
      .nc-item-date{font-size:11px;color:#aaa}
      .nc-empty{padding:40px 16px;text-align:center;color:#999;font-size:13px}
      .nc-footer{padding:10px 16px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
      .nc-loading{text-align:center;padding:20px;color:#666}
    `);

    const fab = GM_addElement("div", { className: "nc-fab", innerHTML: '<span style="font-size:24px">📰</span>' });
    fab.appendChild(GM_addElement("span", { className: "nc-badge", textContent: "0" }));

    const panel = GM_addElement("div", { className: "nc-panel" });
    panel.innerHTML = `
      <div class="nc-header">
        <span class="nc-title">📰 新闻快报</span>
        <button class="nc-close">×</button>
      </div>
      <div class="nc-toolbar">
        <button class="nc-btn primary" id="nc-fetch">🔄 一键抓取</button>
        <button class="nc-btn" id="nc-export">📥 导出</button>
        <button class="nc-btn" id="nc-report">📑 日报</button>
      </div>
      <div class="nc-list"><div class="nc-loading">点击「🔄 一键抓取」开始获取新闻</div></div>
      <div class="nc-footer">点击新闻跳转原文</div>
    `;
    document.body.appendChild(panel);

    fab.addEventListener("click", () => {
      panel.classList.toggle("show");
      if (panel.classList.contains("show") && !getNews().length) {
        refreshList();
      }
    });
    panel.querySelector(".nc-close").addEventListener("click", () => panel.classList.remove("show"));
    panel.querySelector("#nc-fetch").addEventListener("click", () => fetchAndUpdate());
    panel.querySelector("#nc-export").addEventListener("click", () => exportMD());
    panel.querySelector("#nc-report").addEventListener("click", () => generateReport());

    window.ncPanel = panel;
    window.ncBadge = fab.querySelector(".nc-badge");
  }

  function refreshList() {
    const panel = window.ncPanel;
    if (!panel) return;
    const news = getNews();
    const listEl = panel.querySelector(".nc-list");

    if (!news.length) {
      listEl.innerHTML = '<div class="nc-empty">暂无新闻<br>点击「🔄 一键抓取」开始</div>';
      window.ncBadge.textContent = "0";
      return;
    }

    const grouped = {};
    news.forEach(item => {
      const src = item.source || "未知";
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(item);
    });

    let html = "";
    Object.entries(grouped).forEach(([src, items]) => {
      html += `<div class="nc-source"><div class="nc-source-title">${src} (${items.length})</div>`;
      items.slice(0, 20).forEach(item => {
        const click = item.link ? `onclick="window.open('${item.link}','_blank')"` : "";
        html += `<div class="nc-item" ${click}><div class="nc-item-title">${item.title}</div><div class="nc-item-date">${item.date || ""}</div></div>`;
      });
      if (items.length > 20) html += `<div class="nc-item" style="text-align:center;color:#999;">还有 ${items.length - 20} 条...</div>`;
      html += `</div>`;
    });

    listEl.innerHTML = html;
    window.ncBadge.textContent = news.length > 99 ? "99+" : news.length;
  }

  function fetchFeed(url, type) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET", url, timeout: 15000,
        onload: (r) => r.status >= 200 && r.status < 300 ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
        onerror: () => reject(new Error("请求失败")), ontimeout: () => reject(new Error("超时"))
      });
    });
  }

  function parseXML(str) {
    const p = new DOMParser();
    const d = p.parseFromString(str, "text/xml");
    if (d.querySelector("parsererror")) throw new Error("XML解析错误");
    return d;
  }

  function extractXML(doc, src) {
    const items = [];
    doc.querySelectorAll("item, entry").forEach(item => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "";
      const desc = item.querySelector("description, summary, content")?.textContent?.trim() || "";
      const date = item.querySelector("pubDate, published, updated")?.textContent?.trim() || "";
      if (title) items.push({ title, link, desc: desc.replace(/<[^>]+>/g, "").substring(0, 150), date: parseDate(date), source: src });
    });
    return items;
  }

  function extractJSON(obj, src) {
    const items = [];
    const list = obj.result?.data || obj.items || obj.articles || obj.list || [];
    list.forEach(item => {
      const title = item.title || item.titleTxt || "";
      const link = item.url || item.link || item.rawUrl || "";
      const desc = item.intro || item.description || item.digest || "";
      let date = item.ctime || item.pubDate || item.publish_time || "";
      if (typeof date === "number") date = date > 1e12 ? date : date * 1000;
      if (title) items.push({ title, link, desc: desc.substring(0, 150), date: parseDate(date), source: src });
    });
    return items;
  }

  function parseDate(str) {
    if (!str) return "";
    try {
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toLocaleString("zh-CN");
    } catch { return str; }
  }

  async function fetchAndUpdate() {
    const panel = window.ncPanel;
    if (!panel) return;
    const listEl = panel.querySelector(".nc-list");
    listEl.innerHTML = '<div class="nc-loading">🔄 抓取中，请稍候...</div>';

    const feeds = GM_getValue(FEEDS_KEY) || DEFAULT_FEEDS;
    let allNews = [], success = 0;

    for (const feed of feeds) {
      try {
        const data = await fetchFeed(feed.url, feed.type);
        const isJson = feed.type === "json";
        const items = isJson ? extractJSON(JSON.parse(data), feed.name) : extractXML(parseXML(data), feed.name);
        allNews.push(...items);
        success++;
      } catch (e) { console.warn(`[${feed.name}] 失败: ${e.message}`); }
    }

    allNews.sort((a, b) => new Date(b.date) - new Date(a.date));
    GM_setValue(STORAGE_KEY, { items: allNews, fetchedAt: Date.now() });
    GM_notification({ title: "抓取完成", text: `成功 ${success}/${feeds.length} 个源，共 ${allNews.length} 条`, silent: true });
    refreshList();
  }

  function getNews() {
    const data = GM_getValue(STORAGE_KEY);
    return data?.items || [];
  }

  function exportMD() {
    const news = getNews();
    if (!news.length) { GM_notification({ title: "无新闻", text: "请先抓取新闻", silent: true }); return; }
    const grouped = {};
    news.forEach(item => { const src = item.source || "未知"; (grouped[src] = grouped[src] || []).push(item); });
    let md = `# 📰 新闻快报\n\n> ${new Date().toLocaleString("zh-CN")} | 共 ${news.length} 条\n\n---\n\n`;
    Object.entries(grouped).forEach(([src, items]) => {
      md += `## ${src}\n\n`;
      items.forEach(item => { md += `- [${item.title}](${item.link || "#"})${item.date ? ` - ${item.date}` : ""}\n`; if (item.desc) md += `  > ${item.desc}\n`; });
      md += "\n";
    });
    md += "\n---\n*由新闻爬取器生成*\n";
    downloadFile(md, `新闻快报_${getTodayStr()}.md`);
  }

  async function generateReport() {
    const news = getNews();
    if (!news.length) { GM_notification({ title: "无新闻", text: "请先抓取新闻", silent: true }); return; }
    GM_notification({ title: "生成日报", text: "正在抓取全文，请稍候...", silent: true });

    const top = [...news].sort((a, b) => (SOURCE_PRIORITY[b.source] || 5) - (SOURCE_PRIORITY[a.source] || 5)).slice(0, 3);
    const topWithContent = [];

    for (const item of top) {
      if (item.link) {
        try {
          const data = await fetchFeed(item.link, "html");
          const doc = parseXML(data);
          doc.querySelectorAll("script, style, nav, footer, aside, .ad, .comments").forEach(el => el.remove());
          const content = doc.querySelector("article, main, .article-content")?.textContent || doc.body.textContent;
          topWithContent.push({ ...item, content: content?.replace(/\s+/g, " ").trim().substring(0, 3000) || item.desc });
        } catch { topWithContent.push({ ...item, content: item.desc || "（无内容）" }); }
      } else { topWithContent.push({ ...item, content: item.desc || "（无内容）" }); }
    }

    const dateDisplay = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    let md = `# 📰 今日新闻日报\n\n> ${dateDisplay} | 共 ${news.length} 条\n\n---\n\n## 📌 今日要闻 TOP ${topWithContent.length}\n\n`;
    topWithContent.forEach((item, i) => {
      md += `### ${i + 1}. ${item.title}\n\n- 来源: ${item.source} | ${item.date || ""}\n- 链接: ${item.link || "无"}\n\n**正文**:\n${item.content}\n\n---\n\n`;
    });

    md += `## 📋 全部新闻\n\n`;
    const grouped = {};
    news.forEach(item => { const src = item.source || "未知"; (grouped[src] = grouped[src] || []).push(item); });
    Object.entries(grouped).forEach(([src, items]) => {
      md += `### ${src} (${items.length})\n\n`;
      items.forEach(item => { md += `- [${item.title}](${item.link || "#"})${item.date ? ` *${item.date}*` : ""}\n`; });
      md += "\n";
    });
    md += `\n---\n*由新闻爬取器 ${new Date().toLocaleString()}*\n`;

    const folder = getSettings().downloadFolder || "新闻日报";
    downloadFile(md, `${folder}/【${dateDisplay}】新闻日报.md`);
  }

  function downloadFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    GM_download({ url, name: filename, saveAs: true, onload: () => { URL.revokeObjectURL(url); GM_notification({ title: "下载成功", text: filename, silent: true }); }, onerror: () => GM_notification({ title: "下载失败", text: "请检查设置", silent: true }) });
  }

  init();
})();
