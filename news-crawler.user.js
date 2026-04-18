// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      2.0.0
// @description  定时自动爬取新闻 RSS，每日8点生成总结报告并下载
// @author       You
// @background
// @crontab      */30 * * * *
// @crontab      0 20 * * *
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
  const REPORT_KEY = "news_crawler_report";
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
    "观察者网": 8, "极客公园": 6, "爱范儿": 6,
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

  function saveSettings(settings) {
    GM_setValue(SETTINGS_KEY, settings);
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
    registerMenuCommands();
    if (!GM_getValue(FEEDS_KEY)) {
      GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
    }
    const today = getTodayStr();
    if (isFirstOpenToday()) {
      GM_notification({ title: "📰 今日新闻推送", text: "正在获取最新新闻...", silent: true });
      fetchAllFeeds();
    }
    console.log("[新闻爬取器] 已启动");
  }

  function registerMenuCommands() {
    GM_registerMenuCommand("📰 查看新闻", showNewsViewer);
    GM_registerMenuCommand("🔄 立即刷新", fetchAllFeeds);
    GM_registerMenuCommand("📥 导出 Markdown", exportToMarkdown);
    GM_registerMenuCommand("📊 新闻统计", showStats);
    GM_registerMenuCommand("📑 生成日报", generateDailyReport);
    GM_registerMenuCommand("⚙️ 设置", openSettings);
    GM_registerMenuCommand("🗑️ 清空数据", clearData);
  }

  function openSettings() {
    const settings = getSettings();
    const folder = prompt("下载文件夹名称:", settings.downloadFolder || "新闻日报");
    if (folder !== null) {
      settings.downloadFolder = folder || "新闻日报";
      saveSettings(settings);
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
        if (itemDate) {
          return itemDate.toISOString().slice(0, 10) === today;
        }
      }
      if (item.crawledAt) {
        return new Date(item.crawledAt).toISOString().slice(0, 10) === today;
      }
      return false;
    });
  }

  function scoreNewsImportance(item) {
    let score = 0;
    score += SOURCE_PRIORITY[item.source] || 5;
    const title = item.title.toLowerCase();
    const importantKeywords = ["重大", "首发", "独家", "刚刚", "最新", "重磅", "突发", "紧急", "曝光", "刚刚发布"];
    importantKeywords.forEach(kw => { if (title.includes(kw)) score += 5; });
    if (item.link && item.link.startsWith("http")) score += 2;
    return score;
  }

  function selectTopNews(news, count = 3) {
    return [...news]
      .map(item => ({ ...item, importance: scoreNewsImportance(item) }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
  }

  async function fetchFullArticle(url) {
    if (!url || !url.startsWith("http")) return null;
    try {
      const { data } = await fetchFeed(url, "html");
      const parser = new DOMParser();
      const doc = parser.parseFromString(data, "text/html");
      const scripts = doc.querySelectorAll("script, style, nav, header, footer, aside, .ad, .advertisement, .comments, .related, .sidebar");
      scripts.forEach(el => el.remove());
      let content = doc.querySelector("article")?.textContent ||
                   doc.querySelector(".article-content")?.textContent ||
                   doc.querySelector(".article-body")?.textContent ||
                   doc.querySelector("main")?.textContent ||
                   doc.body.textContent;
      content = content.replace(/\s+/g, " ").trim().substring(0, 5000);
      return content || null;
    } catch (e) {
      console.log(`[新闻爬取器] 全文抓取失败: ${url}`);
      return null;
    }
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
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    GM_openInTab(url, { active: true });
    setTimeout(() => URL.revokeObjectURL(url), 5000);
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
      if (item.link) {
        const content = await fetchFullArticle(item.link);
        if (content) {
          topNewsContent.push({ ...item, fullContent: content });
        } else {
          topNewsContent.push({ ...item, fullContent: item.desc || "（无详细内容）" });
        }
      } else {
        topNewsContent.push({ ...item, fullContent: item.desc || "（无详细内容）" });
      }
    }

    const today = getTodayStr();
    const dateDisplay = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

    let md = `# 📰 今日新闻日报\n\n`;
    md += `> **日期**: ${dateDisplay}\n`;
    md += `> **统计**: 今日共 ${todayNews.length} 条新闻，涵盖 ${Object.keys(todayNews.reduce((acc, n) => { acc[n.source] = 1; return acc; })).length} 个来源\n\n`;
    md += `---\n\n`;

    md += `## 📌 今日要闻 TOP ${topNewsContent.length}\n\n`;
    topNewsContent.forEach((item, i) => {
      md += `### ${i + 1}. ${item.title}\n\n`;
      md += `- **来源**: ${item.source}\n`;
      md += `- **时间**: ${item.date || "未知"}\n`;
      md += `- **链接**: ${item.link || "无"}\n\n`;
      md += `**正文摘要**:\n\n${item.fullContent.substring(0, 2000)}\n\n`;
      if (item.fullContent.length > 2000) {
        md += `...\n\n`;
      }
      md += `---\n\n`;
    });

    md += `## 📋 今日全部新闻\n\n`;
    const grouped = {};
    todayNews.forEach(item => {
      const src = item.source || "未知";
      (grouped[src] = grouped[src] || []).push(item);
    });
    Object.entries(grouped).forEach(([src, items]) => {
      md += `### ${src} (${items.length})\n\n`;
      items.forEach(item => {
        const date = item.date ? ` *${item.date}*` : "";
        md += `- [${item.title}](${item.link || "#"})${date}\n`;
      });
      md += "\n";
    });

    md += `\n---\n\n`;
    md += `*本报告由新闻爬取器自动生成于 ${new Date().toLocaleString("zh-CN")}*\n`;

    const folderName = settings.downloadFolder || "新闻日报";
    const filename = `【${dateDisplay}】新闻日报.md`;

    GM_setValue(REPORT_KEY, { md, filename, folderName });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const finalFilename = `${folderName}/${filename}`;

    GM_download({
      url: url,
      name: finalFilename,
      saveAs: true,
      onload: () => {
        URL.revokeObjectURL(url);
        GM_notification({
          title: "📑 日报已生成",
          text: `已保存: ${filename}`,
          silent: true,
        });
      },
      onerror: (err) => {
        GM_notification({
          title: "下载失败",
          text: err.details || "请检查下载设置",
          silent: true,
        });
      },
    });

    GM_setValue(STORAGE_KEY, { items: todayNews, lastFetch: Date.now() });
    console.log("[新闻爬取器] 日报已生成并下载");
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
    const todayNews = getTodayNews(news);
    const data = GM_getValue(STORAGE_KEY);
    const lastFetch = data?.lastFetch ? new Date(data.lastFetch).toLocaleString("zh-CN") : "从未";
    const grouped = {};
    news.forEach(item => { grouped[item.source] = (grouped[item.source] || 0) + 1; });
    GM_notification({
      title: "📊 统计信息",
      text: `总${news.length}条 | 今日${todayNews.length}条 | ${Object.keys(grouped).length}个源`,
      silent: true,
    });
    console.log(`[新闻爬取器] 统计: 总${news.length}条, 今日${todayNews.length}条, ${Object.keys(grouped).length}个来源`);
  }

  function clearData() {
    if (confirm("确定清空所有新闻数据？")) {
      GM_deleteValue(STORAGE_KEY);
      GM_notification({ title: "已清空", text: "所有新闻数据已删除", silent: true });
    }
  }

  const now = new Date();
  if (now.getHours() === 20 && now.getMinutes() === 0) {
    console.log("[新闻爬取器] 触发每日8点日报生成");
    setTimeout(generateDailyReport, 5000);
  }

  init();
})();
