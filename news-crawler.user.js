// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      2.1.0
// @description  定时自动爬取新闻 RSS，每日8点生成总结报告，前台悬浮按钮操作
// @author       You
// @match        *://*/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_download
// @grant        GM_registerMenuCommand
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
  const LAST_DATE_KEY = "news_crawler_last_date";
  const SETTINGS_KEY = "news_crawler_settings";

  const DEFAULT_SETTINGS = {
    downloadFolder: "新闻日报",
    topNewsCount: 3,
    enableReport: true,
  };

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

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function getSettings() {
    return GM_getValue(SETTINGS_KEY) || DEFAULT_SETTINGS;
  }

  function isFirstOpenToday() {
    const lastDate = GM_getValue(LAST_DATE_KEY, "");
    const today = getTodayStr();
    if (lastDate !== today) {
      GM_setValue(LAST_DATE_KEY, today);
      return true;
    }
    return false;
  }

  function init() {
    if (!GM_getValue(FEEDS_KEY)) {
      GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
    }
    createFloatingButton();
    if (isFirstOpenToday()) {
      GM_notification({ title: "📰 今日新闻推送", text: "正在获取最新新闻...", silent: true });
      fetchAllFeeds();
    }
    checkDailyReport();
    console.log("[新闻爬取器] 已启动");
  }

  function createFloatingButton() {
    GM_addStyle(`
      .nc-fab{position:fixed;bottom:24px;left:24px;width:56px;height:56px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;box-shadow:0 4px 20px rgba(74,158,255,.4);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;transition:all .3s}
      .nc-fab:hover{transform:scale(1.1);box-shadow:0 6px 25px rgba(74,158,255,.5)}
      .nc-fab-icon{font-size:24px;color:#fff}
      .nc-fab-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:10px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
      .nc-panel{position:fixed;bottom:90px;left:24px;width:380px;max-height:70vh;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.18);z-index:2147483647;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .nc-panel.show{display:flex;animation:ncFadeIn .2s}
      @keyframes ncFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      .nc-panel-header{padding:16px 20px;background:linear-gradient(135deg,#4a9eff,#6b5bff);color:#fff;display:flex;justify-content:space-between;align-items:center}
      .nc-panel-title{font-size:16px;font-weight:600}
      .nc-panel-close{width:28px;height:28px;border:none;background:rgba(255,255,255,.2);border-radius:50%;cursor:pointer;color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center}
      .nc-panel-close:hover{background:rgba(255,255,255,.3)}
      .nc-panel-toolbar{padding:10px 16px;background:#fafafa;border-bottom:1px solid #eee;display:flex;gap:8px;flex-wrap:wrap}
      .nc-panel-btn{padding:6px 12px;font-size:12px;border:1px solid #ddd;background:#fff;border-radius:6px;cursor:pointer;color:#555}
      .nc-panel-btn:hover{background:#f5f5f5}
      .nc-panel-btn.primary{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-panel-btn.primary:hover{background:#3a8eef}
      .nc-panel-list{flex:1;overflow-y:auto;padding:8px 0}
      .nc-source-group{margin-bottom:12px}
      .nc-source-title{padding:8px 16px;font-size:12px;font-weight:600;color:#888;background:#f5f5f5}
      .nc-item{padding:12px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background .2s}
      .nc-item:hover{background:#f0f7ff}
      .nc-item:last-child{border-bottom:none}
      .nc-item-title{font-size:13px;color:#333;line-height:1.4;margin-bottom:4px}
      .nc-item-date{font-size:11px;color:#aaa}
      .nc-item.no-link{opacity:.6;cursor:default}
      .nc-item.no-link:hover{background:transparent}
      .nc-empty{padding:40px 16px;text-align:center;color:#999;font-size:13px}
      .nc-footer{padding:10px 16px;background:#fafafa;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center}
    `);

    const fab = GM_addElement("div", { className: "nc-fab", innerHTML: '<span class="nc-fab-icon">📰</span>' });
    const badge = GM_addElement("span", { className: "nc-fab-badge", textContent: "0" });
    fab.appendChild(badge);

    const panel = GM_addElement("div", { className: "nc-panel" });
    panel.innerHTML = `
      <div class="nc-panel-header">
        <span class="nc-panel-title">📰 新闻快报</span>
        <button class="nc-panel-close">×</button>
      </div>
      <div class="nc-panel-toolbar">
        <button class="nc-panel-btn primary" id="nc-refresh">🔄 刷新</button>
        <button class="nc-panel-btn" id="nc-export">📥 导出</button>
        <button class="nc-panel-btn" id="nc-report">📑 日报</button>
        <button class="nc-panel-btn" id="nc-settings">⚙️ 设置</button>
      </div>
      <div class="nc-panel-list"></div>
      <div class="nc-footer">点击新闻跳转原文</div>
    `;
    document.body.appendChild(panel);

    fab.addEventListener("click", () => {
      panel.classList.toggle("show");
      if (panel.classList.contains("show")) refreshPanelContent();
    });

    panel.querySelector(".nc-panel-close").addEventListener("click", () => {
      panel.classList.remove("show");
    });

    panel.querySelector("#nc-refresh").addEventListener("click", async () => {
      await fetchAllFeeds();
      refreshPanelContent();
    });

    panel.querySelector("#nc-export").addEventListener("click", exportToMarkdown);

    panel.querySelector("#nc-report").addEventListener("click", generateDailyReport);

    panel.querySelector("#nc-settings").addEventListener("click", openSettings);

    updateBadge();

    window.ncPanel = panel;
    window.ncBadge = badge;
  }

  function updateBadge() {
    const news = getNews();
    const todayNews = getTodayNews(news);
    if (window.ncBadge) {
      window.ncBadge.textContent = todayNews.length > 99 ? "99+" : todayNews.length;
    }
  }

  function refreshPanelContent() {
    const panel = window.ncPanel;
    if (!panel) return;
    const news = getNews();
    const todayNews = getTodayNews(news);
    const listEl = panel.querySelector(".nc-panel-list");

    if (todayNews.length === 0) {
      listEl.innerHTML = '<div class="nc-empty">今日暂无新闻<br><br><button class="nc-panel-btn primary" id="nc-fetch">点击抓取</button></div>';
      listEl.querySelector("#nc-fetch")?.addEventListener("click", async () => {
        await fetchAllFeeds();
        refreshPanelContent();
      });
      return;
    }

    const grouped = {};
    todayNews.forEach(item => {
      const src = item.source || "未知";
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(item);
    });

    let html = "";
    Object.entries(grouped).forEach(([source, items]) => {
      html += `<div class="nc-source-group">`;
      html += `<div class="nc-source-title">${source} (${items.length})</div>`;
      items.slice(0, 15).forEach(item => {
        const cls = item.link ? "nc-item" : "nc-item no-link";
        const click = item.link ? `onclick="window.open('${item.link}','_blank')"` : "";
        html += `<div class="${cls}" ${click}><div class="nc-item-title">${item.title}</div><div class="nc-item-date">${item.date || ""}</div></div>`;
      });
      if (items.length > 15) {
        html += `<div class="nc-item" style="text-align:center;color:#999;">还有 ${items.length - 15} 条...</div>`;
      }
      html += `</div>`;
    });

    listEl.innerHTML = html;
    updateBadge();
  }

  function registerMenuCommands() {
    GM_registerMenuCommand("📰 查看新闻", () => window.ncPanel?.classList.add("show"));
    GM_registerMenuCommand("🔄 立即刷新", () => { fetchAllFeeds(); refreshPanelContent(); });
    GM_registerMenuCommand("📥 导出 Markdown", exportToMarkdown);
    GM_registerMenuCommand("📑 生成日报", generateDailyReport);
    GM_registerMenuCommand("⚙️ 设置", openSettings);
    GM_registerMenuCommand("🗑️ 清空数据", clearData);
  }

  function openSettings() {
    const settings = getSettings();
    const folder = prompt("下载文件夹名称:", settings.downloadFolder || "新闻日报");
    if (folder !== null) {
      settings.downloadFolder = folder || "新闻日报";
      GM_setValue(SETTINGS_KEY, settings);
      GM_notification({ title: "设置已保存", text: `下载文件夹: ${settings.downloadFolder}`, silent: true });
    }
  }

  function fetchFeed(url, type) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        timeout: 15000,
        onload: (resp) => {
          if (resp.status >= 200 && resp.status < 300) {
            resolve({ data: resp.responseText, type: type });
          } else {
            reject(new Error(`HTTP ${resp.status}`));
          }
        },
        onerror: () => reject(new Error("请求失败")),
        ontimeout: () => reject(new Error("请求超时")),
      });
    });
  }

  function parseXML(xmlStr) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML解析错误");
    return doc;
  }

  function extractXML(doc, source) {
    const items = [];
    doc.querySelectorAll("item, entry").forEach(item => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "";
      const desc = item.querySelector("description, summary, content")?.textContent?.trim() || "";
      const date = item.querySelector("pubDate, published, updated")?.textContent?.trim() || "";
      if (title) items.push({ title, link, desc: desc.replace(/<[^>]+>/g, "").substring(0, 150), date: parseDate(date), source, crawledAt: Date.now() });
    });
    return items;
  }

  function extractJSON(obj, source) {
    const items = [];
    const list = obj.result?.data || obj.items || obj.articles || obj.list || [];
    list.forEach(item => {
      const title = item.title || item.titleTxt || "";
      const link = item.url || item.link || item.rawUrl || "";
      const desc = item.intro || item.description || item.digest || "";
      let date = item.ctime || item.pubDate || item.publish_time || "";
      if (typeof date === "number") date = date > 1e12 ? date : date * 1000;
      if (title) items.push({ title, link, desc: desc.substring(0, 150), date: parseDate(date), source, crawledAt: Date.now() });
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

  function parseDateForFilter(str) {
    if (!str) return null;
    try {
      const d = new Date(str);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch { return null; }
  }

  async function fetchSingleFeed(feed) {
    try {
      const { data, type } = await fetchFeed(feed.url, feed.type);
      const isJson = type === "json" || feed.type === "json";
      const items = isJson ? extractJSON(JSON.parse(data), feed.name) : extractXML(parseXML(data), feed.name);
      return { success: true, items, name: feed.name };
    } catch (e) {
      return { success: false, items: [], name: feed.name, error: e.message };
    }
  }

  async function fetchAllFeeds() {
    console.log("[新闻爬取器] 开始抓取...");
    const feeds = GM_getValue(FEEDS_KEY) || DEFAULT_FEEDS;
    if (feeds.length === 0) {
      GM_notification({ title: "请先添加新闻源", text: "", silent: true });
      return;
    }
    let total = 0, success = 0, fail = 0;
    const allNews = [];
    for (const feed of feeds) {
      const r = await fetchSingleFeed(feed);
      if (r.success) {
        allNews.push(...r.items);
        success++;
      } else {
        fail++;
      }
      total++;
    }
    allNews.sort((a, b) => b.crawledAt - a.crawledAt);
    GM_setValue(STORAGE_KEY, { items: allNews, lastFetch: Date.now() });
    const msg = `成功 ${success}/${total} 个源，共 ${allNews.length} 条`;
    GM_notification({ title: "抓取完成", text: msg, silent: true });
    updateBadge();
    console.log("[新闻爬取器] " + msg);
    return allNews;
  }

  function getNews() {
    const data = GM_getValue(STORAGE_KEY);
    return data?.items || [];
  }

  function getTodayNews(news) {
    const today = getTodayStr();
    return news.filter(item => {
      if (item.date) {
        const itemDate = parseDateForFilter(item.date);
        if (itemDate) return itemDate.toISOString().slice(0, 10) === today;
      }
      if (item.crawledAt) {
        return new Date(item.crawledAt).toISOString().slice(0, 10) === today;
      }
      return false;
    });
  }

  function scoreNewsImportance(item) {
    let score = SOURCE_PRIORITY[item.source] || 5;
    const title = item.title.toLowerCase();
    ["重大", "首发", "独家", "刚刚", "最新", "重磅", "突发", "紧急"].forEach(kw => { if (title.includes(kw)) score += 5; });
    if (item.link && item.link.startsWith("http")) score += 2;
    return score;
  }

  function selectTopNews(news, count = 3) {
    return [...news].map(item => ({ ...item, importance: scoreNewsImportance(item) })).sort((a, b) => b.importance - a.importance).slice(0, count);
  }

  async function fetchFullArticle(url) {
    if (!url || !url.startsWith("http")) return null;
    try {
      const { data } = await fetchFeed(url, "html");
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, "text/html");
      doc.querySelectorAll("script, style, nav, header, footer, aside, .ad, .comments, .related, .sidebar").forEach(el => el.remove());
      const content = doc.querySelector("article")?.textContent || doc.querySelector(".article-content")?.textContent || doc.querySelector(".article-body")?.textContent || doc.querySelector("main")?.textContent || doc.body.textContent;
      return content?.replace(/\s+/g, " ").trim().substring(0, 5000) || null;
    } catch { return null; }
  }

  async function generateDailyReport() {
    const settings = getSettings();
    const allNews = getNews();
    const todayNews = getTodayNews(allNews);
    if (todayNews.length === 0) {
      GM_notification({ title: "今日无新闻", text: "今日暂无抓取到新闻", silent: true });
      return;
    }
    GM_notification({ title: "📑 生成日报", text: "正在生成今日新闻摘要...", silent: true });
    const topNews = selectTopNews(todayNews, settings.topNewsCount || 3);
    const topNewsContent = [];
    for (const item of topNews) {
      const content = item.link ? await fetchFullArticle(item.link) : null;
      topNewsContent.push({ ...item, fullContent: content || item.desc || "（无详细内容）" });
    }
    const today = getTodayStr();
    const dateDisplay = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    let md = `# 📰 今日新闻日报\n\n> **日期**: ${dateDisplay}\n> **统计**: 今日共 ${todayNews.length} 条新闻\n\n---\n\n`;
    md += `## 📌 今日要闻 TOP ${topNewsContent.length}\n\n`;
    topNewsContent.forEach((item, i) => {
      md += `### ${i + 1}. ${item.title}\n\n- **来源**: ${item.source} | **时间**: ${item.date || "未知"}\n- **链接**: ${item.link || "无"}\n\n**正文**:\n\n${item.fullContent.substring(0, 2000)}\n\n---\n\n`;
    });
    md += `## 📋 今日全部新闻\n\n`;
    const grouped = {};
    todayNews.forEach(item => { const src = item.source || "未知"; (grouped[src] = grouped[src] || []).push(item); });
    Object.entries(grouped).forEach(([src, items]) => {
      md += `### ${src} (${items.length})\n\n`;
      items.forEach(item => { md += `- [${item.title}](${item.link || "#"}) ${item.date ? `*${item.date}*` : ""}\n`; });
      md += "\n";
    });
    md += `\n---\n*由新闻爬取器自动生成于 ${new Date().toLocaleString("zh-CN")}*\n`;
    const folderName = settings.downloadFolder || "新闻日报";
    const filename = `${folderName}/【${dateDisplay}】新闻日报.md`;
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    GM_download({ url, name: filename, saveAs: true, onload: () => { URL.revokeObjectURL(url); GM_notification({ title: "📑 日报已生成", text: `已保存: ${filename}`, silent: true }); }, onerror: () => GM_notification({ title: "下载失败", text: "请检查下载设置", silent: true }) });
  }

  function exportToMarkdown() {
    const news = getNews();
    const todayNews = getTodayNews(news);
    if (!todayNews.length) { GM_notification({ title: "无新闻", text: "今日暂无新闻可导出", silent: true }); return; }
    const grouped = {};
    todayNews.forEach(item => { const src = item.source || "未知"; (grouped[src] = grouped[src] || []).push(item); });
    let md = `# 📰 新闻快报\n\n> 生成时间: ${new Date().toLocaleString("zh-CN")} | 今日 ${todayNews.length} 条\n\n---\n\n`;
    Object.entries(grouped).forEach(([src, items]) => {
      md += `## ${src}\n\n`;
      items.forEach(item => { md += `- [${item.title}](${item.link || "#"}) ${item.date ? `- ${item.date}` : ""}\n`; if (item.desc) md += `  > ${item.desc}\n`; });
      md += "\n";
    });
    md += "\n---\n*由新闻爬取器自动生成*\n";
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `新闻快报_${getTodayStr()}.md`;
    GM_download({ url, name: filename, saveAs: true, onload: () => { URL.revokeObjectURL(url); GM_notification({ title: "导出成功", text: `已保存 ${filename}`, silent: true }); }, onerror: () => GM_notification({ title: "导出失败", text: "请重试", silent: true }) });
  }

  function clearData() {
    if (confirm("确定清空所有新闻数据？")) {
      GM_deleteValue(STORAGE_KEY);
      GM_notification({ title: "已清空", text: "所有新闻数据已删除", silent: true });
      updateBadge();
      refreshPanelContent();
    }
  }

  function checkDailyReport() {
    const lastReportDate = GM_getValue("news_crawler_last_report", "");
    const today = getTodayStr();
    const now = new Date();
    if (now.getHours() >= 20 && lastReportDate !== today) {
      GM_setValue("news_crawler_last_report", today);
      setTimeout(() => generateDailyReport(), 3000);
    }
  }

  init();
  registerMenuCommands();
})();
