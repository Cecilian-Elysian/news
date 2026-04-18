// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      0.1.0
// @description  爬取新闻网站的 RSS 订阅源，支持定时更新和导出为 Markdown
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
// @grant        GM_unregisterMenuCommand
// @grant        GM_addElement
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_notification
// @grant        GM_info
// @connect     *
// ==/UserScript==

(function () {
  "use strict";

  console.log("[新闻爬取器] 脚本已加载");

  const STORAGE_KEY = "news_crawler_data";
  const FEEDS_KEY = "news_crawler_feeds";

  // 默认新闻源
  const DEFAULT_FEEDS = [
    { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=20&page=1", type: "json" },
    { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
    { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
  ];

  // 初始化
  function init() {
    registerMenuCommands();
    console.log("[新闻爬取器] 初始化完成");
  }

  // 注册菜单命令
  function registerMenuCommands() {
    GM_registerMenuCommand("📰 查看新闻列表", showNewsPanel);
    GM_registerMenuCommand("🔄 刷新新闻", fetchAllFeeds);
    GM_registerMenuCommand("📥 导出为 Markdown", exportToMarkdown);
    GM_registerMenuCommand("⚙️ 配置新闻源", openFeedConfig);
    GM_registerMenuCommand("🗑️ 清空新闻数据", clearAllNews);
  }

  // ========== RSS 获取与解析 ==========

  function fetchFeed(url, type = "xml") {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        timeout: 15000,
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve({ data: response.responseText, type: type });
          } else {
            reject(new Error(`HTTP ${response.status}: ${response.statusText}`));
          }
        },
        onerror: (error) => {
          reject(new Error(`请求失败: ${error}`));
        },
        ontimeout: () => {
          reject(new Error("请求超时"));
        },
      });
    });
  }

  function parseXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw new Error("XML 解析错误");
    }
    return doc;
  }

  function extractNewsFromXML(doc, sourceName) {
    const items = [];
    const entries = doc.querySelectorAll("item");
    entries.forEach((item) => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() || "";
      const description = item.querySelector("description")?.textContent?.trim() || "";
      const pubDateStr = item.querySelector("pubDate")?.textContent?.trim() || "";
      let pubDate = "";
      try {
        pubDate = pubDateStr ? new Date(pubDateStr).toLocaleString("zh-CN") : "";
      } catch (e) {
        pubDate = pubDateStr;
      }
      if (title) {
        items.push({
          title,
          link,
          description: description.replace(/<[^>]+>/g, "").substring(0, 200),
          pubDate,
          source: sourceName,
          crawledAt: Date.now(),
        });
      }
    });
    return items;
  }

  function extractNewsFromJSON(jsonObj, sourceName) {
    const items = [];
    const list = jsonObj.result?.data || jsonObj.items || jsonObj.articles || [];
    list.forEach((item) => {
      const title = item.title || item.titleTxt || "";
      const link = item.url || item.link || item.rawUrl || "";
      const description = item.intro || item.description || item.digest || item.abstract || "";
      const pubDateStr = item.ctime || item.pubDate || item.publish_time || "";
      let pubDate = "";
      try {
        pubDate = pubDateStr ? new Date(pubDateStr * 1000).toLocaleString("zh-CN") : "";
      } catch (e) {
        pubDate = pubDateStr;
      }
      if (title) {
        items.push({
          title,
          link,
          description: description.substring(0, 200),
          pubDate,
          source: sourceName,
          crawledAt: Date.now(),
        });
      }
    });
    return items;
  }

  async function fetchSingleFeed(feed) {
    try {
      const { data, type } = await fetchFeed(feed.url, feed.type || type);
      if (type === "json" || feed.type === "json") {
        const jsonObj = JSON.parse(data);
        return extractNewsFromJSON(jsonObj, feed.name);
      } else {
        const doc = parseXML(data);
        return extractNewsFromXML(doc, feed.name);
      }
    } catch (error) {
      console.error(`[新闻爬取器] 获取 ${feed.name} 失败:`, error.message);
      return [];
    }
  }

  async function fetchAllFeeds() {
    console.log("[新闻爬取器] 开始抓取所有新闻源...");
    const feeds = getFeeds();
    const allNews = [];
    for (const feed of feeds) {
      const news = await fetchSingleFeed(feed);
      allNews.push(...news);
      console.log(`[新闻爬取器] ${feed.name}: 获取到 ${news.length} 条新闻`);
    }
    allNews.sort((a, b) => b.crawledAt - a.crawledAt);
    saveNews(allNews);
    GM_notification({
      title: "新闻爬取完成",
      text: `共获取 ${allNews.length} 条新闻`,
      silent: true,
    });
    return allNews;
  }

  // ========== 数据存储 ==========

  function getFeeds() {
    const stored = GM_getValue(FEEDS_KEY);
    if (stored && Array.isArray(stored) && stored.length > 0) {
      return stored;
    }
    GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
    return DEFAULT_FEEDS;
  }

  function saveNews(newsList) {
    const data = {
      items: newsList,
      lastCrawl: Date.now(),
    };
    GM_setValue(STORAGE_KEY, data);
  }

  function getNews() {
    const data = GM_getValue(STORAGE_KEY);
    return data?.items || [];
  }

  // ========== Markdown 导出 ==========

  function generateMarkdown(newsList) {
    if (!newsList || newsList.length === 0) {
      return "# 📰 新闻快报\n\n> 暂无新闻数据，请先点击「刷新新闻」抓取。\n";
    }
    const now = new Date().toLocaleString("zh-CN");
    let md = `# 📰 新闻快报\n\n> 生成时间: ${now}  |  共 ${newsList.length} 条\n\n---\n\n`;
    const grouped = {};
    newsList.forEach((item) => {
      const source = item.source || "未知来源";
      if (!grouped[source]) {
        grouped[source] = [];
      }
      grouped[source].push(item);
    });
    Object.entries(grouped).forEach(([source, items]) => {
      md += `## 🔗 ${source}\n\n`;
      items.forEach((item) => {
        const date = item.pubDate ? ` - ${item.pubDate}` : "";
        md += `- [${item.title}](${item.link})${date}\n`;
        if (item.description) {
          md += `  > ${item.description}\n`;
        }
      });
      md += "\n";
    });
    md += "---\n\n*由新闻爬取器自动生成*\n";
    return md;
  }

  function exportToMarkdown() {
    const news = getNews();
    const md = generateMarkdown(news);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `新闻快报_${new Date().toISOString().slice(0, 10)}.md`;
    GM_download({
      url: url,
      name: filename,
      saveAs: true,
      onload: () => {
        URL.revokeObjectURL(url);
        GM_notification({
          title: "导出成功",
          text: `已导出 ${news.length} 条新闻到 ${filename}`,
          silent: true,
        });
      },
      onerror: (err) => {
        console.error("[新闻爬取器] 导出失败:", err);
        GM_notification({
          title: "导出失败",
          text: err.details || "请重试",
          silent: true,
        });
      },
    });
  }

  function clearAllNews() {
    if (confirm("确定要清空所有新闻数据吗？")) {
      GM_deleteValue(STORAGE_KEY);
      GM_notification({
        title: "已清空",
        text: "所有新闻数据已清除",
        silent: true,
      });
      console.log("[新闻爬取器] 新闻数据已清空");
    }
  }

  // ========== 浮窗 UI ==========

  let panelElement = null;
  let isPanelVisible = false;

  function showNewsPanel() {
    if (isPanelVisible && panelElement) {
      closePanel();
      return;
    }
    createNewsPanel();
  }

  function closePanel() {
    if (panelElement) {
      panelElement.remove();
      panelElement = null;
      isPanelVisible = false;
    }
  }

  function createNewsPanel() {
    closePanel();
    const news = getNews();
    const styles = `
      .nc-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 380px;
        max-height: 520px;
        background: #fafafa;
        border: 1px solid #e0e0e0;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.12);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .nc-header {
        padding: 14px 16px;
        background: #fff;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }
      .nc-title {
        font-size: 15px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }
      .nc-close {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 18px;
        color: #999;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nc-close:hover {
        background: #f0f0f0;
        color: #666;
      }
      .nc-toolbar {
        padding: 8px 12px;
        background: #fafafa;
        border-bottom: 1px solid #eee;
        display: flex;
        gap: 8px;
      }
      .nc-btn {
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 6px;
        cursor: pointer;
        color: #555;
      }
      .nc-btn:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }
      .nc-list {
        flex: 1;
        overflow-y: auto;
        padding: 8px 0;
      }
      .nc-source-group {
        margin-bottom: 12px;
      }
      .nc-source-name {
        padding: 6px 16px;
        font-size: 12px;
        font-weight: 600;
        color: #888;
        background: #f5f5f5;
      }
      .nc-item {
        padding: 10px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
      }
      .nc-item:hover {
        background: #f0f7ff;
      }
      .nc-item:last-child {
        border-bottom: none;
      }
      .nc-item-title {
        font-size: 13px;
        color: #333;
        margin-bottom: 4px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .nc-item-date {
        font-size: 11px;
        color: #aaa;
      }
      .nc-empty {
        padding: 40px 16px;
        text-align: center;
        color: #999;
        font-size: 13px;
      }
      .nc-footer {
        padding: 8px 16px;
        background: #fff;
        border-top: 1px solid #eee;
        font-size: 11px;
        color: #bbb;
        text-align: center;
      }
    `;
    GM_addStyle(styles);
    panelElement = document.createElement("div");
    panelElement.className = "nc-panel";
    panelElement.innerHTML = `
      <div class="nc-header">
        <span class="nc-title">📰 新闻快报</span>
        <button class="nc-close" title="关闭">×</button>
      </div>
      <div class="nc-toolbar">
        <button class="nc-btn" id="nc-refresh">🔄 刷新</button>
        <button class="nc-btn" id="nc-export">📥 导出</button>
      </div>
      <div class="nc-list"></div>
      <div class="nc-footer">点击新闻用新标签打开</div>
    `;
    document.body.appendChild(panelElement);
    isPanelVisible = true;
    panelElement.querySelector(".nc-close").addEventListener("click", closePanel);
    panelElement.querySelector("#nc-refresh").addEventListener("click", async () => {
      await fetchAllFeeds();
      refreshPanelContent();
    });
    panelElement.querySelector("#nc-export").addEventListener("click", exportToMarkdown);
    refreshPanelContent();
  }

  function refreshPanelContent() {
    if (!panelElement) return;
    const news = getNews();
    const listEl = panelElement.querySelector(".nc-list");
    if (!news || news.length === 0) {
      listEl.innerHTML = '<div class="nc-empty">暂无新闻<br><br><button class="nc-btn" id="nc-fetch">点击抓取</button></div>';
      listEl.querySelector("#nc-fetch")?.addEventListener("click", async () => {
        await fetchAllFeeds();
        refreshPanelContent();
      });
      return;
    }
    const grouped = {};
    news.forEach((item) => {
      const source = item.source || "未知来源";
      if (!grouped[source]) grouped[source] = [];
      grouped[source].push(item);
    });
    let html = "";
    Object.entries(grouped).forEach(([source, items]) => {
      html += `<div class="nc-source-group">`;
      html += `<div class="nc-source-name">${source} (${items.length})</div>`;
      items.slice(0, 10).forEach((item) => {
        const date = item.pubDate ? `<span class="nc-item-date">${item.pubDate}</span>` : "";
        html += `
          <div class="nc-item" data-link="${encodeURIComponent(item.link)}">
            <div class="nc-item-title">${item.title}</div>
            ${date}
          </div>
        `;
      });
      if (items.length > 10) {
        html += `<div class="nc-item" style="color:#888;text-align:center;">...还有 ${items.length - 10} 条</div>`;
      }
      html += `</div>`;
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll(".nc-item[data-link]").forEach((el) => {
      el.addEventListener("click", () => {
        const link = decodeURIComponent(el.dataset.link);
        GM_openInTab(link, { active: true });
      });
    });
  }

  // ========== 用户配置（待实现） ==========
  function openFeedConfig() {
    console.log("[新闻爬取器] 打开配置面板");
  }

  // 启动
  init();
})();
