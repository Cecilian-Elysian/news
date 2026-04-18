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

  // ========== 核心功能函数（待实现） ==========
  function showNewsPanel() {
    console.log("[新闻爬取器] 显示新闻面板");
  }

  function exportToMarkdown() {
    console.log("[新闻爬取器] 导出为 Markdown");
  }

  function openFeedConfig() {
    console.log("[新闻爬取器] 打开配置面板");
  }

  function clearAllNews() {
    console.log("[新闻爬取器] 清空新闻数据");
  }

  // 启动
  init();
})();
