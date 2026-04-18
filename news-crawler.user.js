// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      1.1.0
// @description  定时自动爬取新闻 RSS，后台每30分钟抓取，开机首日自动抓取
// @author       You
// @background
// @crontab      */30 * * * *
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_info
// @grant        GM_openInTab
// @connect     *
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "news_crawler_data";
  const FEEDS_KEY = "news_crawler_feeds";
  const VIEWER_KEY = "news_crawler_viewer";
  const LAST_DATE_KEY = "news_crawler_last_date";

  function getTodayStr() {
    return new Date().toISOString().slice(0, 10);
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

  function init() {
    registerMenuCommands();
    if (!GM_getValue(FEEDS_KEY)) {
      GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
    }
    const today = getTodayStr();
    if (isFirstOpenToday()) {
      console.log("[新闻爬取器] 今日首次启动，开始抓取...");
      GM_notification({
        title: "📰 今日新闻推送",
        text: "正在获取最新新闻...",
        silent: true,
      });
      fetchAllFeeds();
    } else {
      console.log("[新闻爬取器] 已启动，后台每30分钟自动抓取");
    }
  }

  function registerMenuCommands() {
    GM_registerMenuCommand("📰 查看新闻", showNewsViewer);
    GM_registerMenuCommand("🔄 立即刷新", fetchAllFeeds);
    GM_registerMenuCommand("📥 导出 Markdown", exportToMarkdown);
    GM_registerMenuCommand("📊 新闻统计", showStats);
    GM_registerMenuCommand("🗑️ 清空数据", clearData);
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
      if (title) items.push({ title, link, desc: desc.replace(/<[^>]+>/g, "").substring(0, 150), date: parseDate(date), source });
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
      if (title) items.push({ title, link, desc: desc.substring(0, 150), date: parseDate(date), source });
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
    allNews.sort((a, b) => b.date.localeCompare(a.date));
    GM_setValue(STORAGE_KEY, { items: allNews, lastFetch: Date.now() });
    const msg = `成功 ${success}/${total} 个源，共 ${allNews.length} 条`;
    GM_notification({ title: "抓取完成", text: msg, silent: true });
    console.log("[新闻爬取器] " + msg);
    return allNews;
  }

  function getNews() {
    const data = GM_getValue(STORAGE_KEY);
    return data?.items || [];
  }

  function generateViewerHTML(news) {
    const grouped = {};
    news.forEach(item => {
      const src = item.source || "未知";
      if (!grouped[src]) grouped[src] = [];
      grouped[src].push(item);
    });
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>📰 新闻快报</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f5;padding:20px}
      .header{padding:20px;background:linear-gradient(135deg,#4a9eff,#6b5bff);color:#fff;border-radius:12px;margin-bottom:20px}
      .header h1{font-size:20px;margin-bottom:8px}
      .header .stats{font-size:13px;opacity:0.9}
      .source{margin-bottom:16px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
      .source-title{padding:12px 16px;background:#fafafa;font-weight:600;font-size:13px;color:#666;border-bottom:1px solid #eee}
      .item{padding:14px 16px;border-bottom:1px solid #f0f0f0;cursor:pointer;transition:background 0.2s}
      .item:last-child{border-bottom:none}
      .item:hover{background:#f8f9fa}
      .item-title{font-size:14px;color:#333;margin-bottom:6px;line-height:1.4}
      .item-date{font-size:11px;color:#999}
      .item.no-link{cursor:default;opacity:0.6}
      .footer{padding:20px;text-align:center;color:#999;font-size:12px}
    </style></head><body>
    <div class="header">
      <h1>📰 新闻快报</h1>
      <div class="stats">共 ${news.length} 条 | ${Object.keys(grouped).length} 个来源 | ${new Date().toLocaleString("zh-CN")}</div>
    </div>`;
    Object.entries(grouped).forEach(([source, items]) => {
      html += `<div class="source"><div class="source-title">${source} (${items.length})</div>`;
      items.slice(0, 20).forEach(item => {
        const linkClass = item.link ? "item" : "item no-link";
        const onclick = item.link ? `onclick="window.open('${item.link}','_blank')"` : "";
        html += `<div class="${linkClass}" ${onclick}><div class="item-title">${item.title}</div><div class="item-date">${item.date}</div></div>`;
      });
      if (items.length > 20) html += `<div class="item" style="text-align:center;color:#999;">还有 ${items.length - 20} 条...</div>`;
      html += `</div>`;
    });
    html += `<div class="footer">由新闻爬取器自动生成</div></body></html>`;
    return html;
  }

  function showNewsViewer() {
    const news = getNews();
    if (news.length === 0) {
      GM_notification({ title: "暂无新闻", text: "请点击「立即刷新」抓取", silent: true });
      return;
    }
    const html = generateViewerHTML(news);
    GM_setValue(VIEWER_KEY, html);
    GM_openInTab("https://localhost/news-viewer", { active: true });
    setTimeout(() => {
      const saved = GM_getValue(VIEWER_KEY);
      if (saved) {
        const blob = new Blob([saved], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        GM_openInTab(url, { active: true });
        URL.revokeObjectURL(url);
        GM_deleteValue(VIEWER_KEY);
      }
    }, 100);
  }

  function generateMarkdown(news) {
    if (!news.length) return "# 📰 新闻快报\n\n> 暂无新闻\n";
    const grouped = {};
    news.forEach(item => {
      const src = item.source || "未知";
      (grouped[src] = grouped[src] || []).push(item);
    });
    let md = `# 📰 新闻快报\n\n> 生成时间: ${new Date().toLocaleString("zh-CN")} | 共 ${news.length} 条\n\n---\n\n`;
    Object.entries(grouped).forEach(([src, items]) => {
      md += `## ${src}\n\n`;
      items.forEach(item => {
        const date = item.date ? ` - ${item.date}` : "";
        md += `- [${item.title}](${item.link || "#"})${date}\n`;
        if (item.desc) md += `  > ${item.desc}\n`;
      });
      md += "\n";
    });
    md += "\n---\n*由新闻爬取器自动生成*\n";
    return md;
  }

  function exportToMarkdown() {
    const news = getNews();
    const md = generateMarkdown(news);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `新闻快报_${new Date().toISOString().slice(0,10)}.md`;
    GM_download({ url, name: filename, saveAs: true, onload: () => {
      URL.revokeObjectURL(url);
      GM_notification({ title: "导出成功", text: `已保存 ${filename}`, silent: true });
    }, onerror: () => GM_notification({ title: "导出失败", text: "请重试", silent: true }) });
  }

  function showStats() {
    const news = getNews();
    const data = GM_getValue(STORAGE_KEY);
    const lastFetch = data?.lastFetch ? new Date(data.lastFetch).toLocaleString("zh-CN") : "从未";
    const grouped = {};
    news.forEach(item => { grouped[item.source] = (grouped[item.source] || 0) + 1; });
    let stats = `📊 新闻统计\n\n共 ${news.length} 条新闻\n最后抓取: ${lastFetch}\n\n来源统计:\n`;
    Object.entries(grouped).sort((a, b) => b[1] - a[1]).forEach(([src, cnt]) => {
      stats += `${src}: ${cnt}条\n`;
    });
    GM_notification({ title: "📊 统计信息", text: `共${news.length}条/${Object.keys(grouped).length}个源`, silent: true });
    console.log("[新闻爬取器] " + stats);
  }

  function clearData() {
    if (confirm("确定清空所有新闻数据？")) {
      GM_deleteValue(STORAGE_KEY);
      GM_notification({ title: "已清空", text: "所有新闻数据已删除", silent: true });
    }
  }

  init();
})();
