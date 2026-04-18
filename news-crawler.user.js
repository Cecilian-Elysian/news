// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      0.7.0
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
    { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
    { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
    { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
    { name: "知乎热榜", url: "https://www.zhihu.com/rss", type: "xml" },
    { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
    { name: "36氪", url: "https://36kr.com/feed", type: "xml" },
    { name: "少数派", url: "https://sspai.com/feed", type: "xml" },
    { name: "RadarAI", url: "https://rsshub.app/radarai.top", type: "xml" },
    { name: "今日热榜", url: "https://rsshub.app/tophub.today", type: "xml" },
  ];

  // 新闻源预设
  const FEED_PRESETS = {
    "🏛️ 中央重点": [
      { name: "人民日报", url: "https://www.people.com.cn/rss/rss.xml", type: "xml" },
      { name: "新华网", url: "https://www.news.cn/rss/", type: "xml" },
      { name: "央视网", url: "https://www.cctv.com/rss/rss.xml", type: "xml" },
      { name: "中国新闻网", url: "https://www.chinanews.com.cn/rss/", type: "xml" },
      { name: "光明网", url: "https://www.guangming.cn/rss/", type: "xml" },
      { name: "环球网", url: "https://www.huanqiu.com/rss/", type: "xml" },
      { name: "参考消息", url: "https://www.cankaoxiaoxie.com/rss", type: "xml" },
    ],
    "📰 央媒新闻": [
      { name: "人民网", url: "https://www.people.com.cn/rss/rss.xml", type: "xml" },
      { name: "新华网", url: "https://www.news.cn/rss/", type: "xml" },
      { name: "中国日报", url: "https://www.chinadaily.com.cn/rss/", type: "xml" },
      { name: "央广网", url: "https://www.cnr.cn/rss/", type: "xml" },
      { name: "国际在线", url: "https://www.cri.cn/rss/", type: "xml" },
      { name: "中国网", url: "https://www.china.com.cn/rss/", type: "xml" },
    ],
    "💼 商业门户": [
      { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
      { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
      { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
      { name: "搜狐新闻", url: "https://www.sohu.com/rss/rss.xml", type: "xml" },
    ],
    "🔬 科技资讯": [
      { name: "知乎热榜", url: "https://www.zhihu.com/rss", type: "xml" },
      { name: "36氪", url: "https://36kr.com/feed", type: "xml" },
      { name: "少数派", url: "https://sspai.com/feed", type: "xml" },
      { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
    ],
    "🌐 热榜聚合": [
      { name: "RadarAI", url: "https://rsshub.app/radarai.top", type: "xml" },
      { name: "今日热榜", url: "https://rsshub.app/tophub.today", type: "xml" },
    ],
    "📚 学习强国": [
      { name: "学习强国", url: "https://rsshub.app/xuexi.xuexi.cn", type: "xml" },
    ],
    "国内综合": [
      { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
      { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
      { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
      { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
    ],
    "全部新闻源": [
      { name: "人民日报", url: "https://www.people.com.cn/rss/rss.xml", type: "xml" },
      { name: "新华网", url: "https://www.news.cn/rss/", type: "xml" },
      { name: "央视网", url: "https://www.cctv.com/rss/rss.xml", type: "xml" },
      { name: "中国新闻网", url: "https://www.chinanews.com.cn/rss/", type: "xml" },
      { name: "光明网", url: "https://www.guangming.cn/rss/", type: "xml" },
      { name: "环球网", url: "https://www.huanqiu.com/rss/", type: "xml" },
      { name: "参考消息", url: "https://www.cankaoxiaoxie.com/rss", type: "xml" },
      { name: "中国日报", url: "https://www.chinadaily.com.cn/rss/", type: "xml" },
      { name: "央广网", url: "https://www.cnr.cn/rss/", type: "xml" },
      { name: "国际在线", url: "https://www.cri.cn/rss/", type: "xml" },
      { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
      { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "xml" },
      { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "xml" },
      { name: "搜狐新闻", url: "https://www.sohu.com/rss/rss.xml", type: "xml" },
      { name: "知乎热榜", url: "https://www.zhihu.com/rss", type: "xml" },
      { name: "36氪", url: "https://36kr.com/feed", type: "xml" },
      { name: "少数派", url: "https://sspai.com/feed", type: "xml" },
      { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
      { name: "RadarAI", url: "https://rsshub.app/radarai.top", type: "xml" },
      { name: "今日热榜", url: "https://rsshub.app/tophub.today", type: "xml" },
      { name: "学习强国", url: "https://rsshub.app/xuexi.xuexi.cn", type: "xml" },
    ],
  };

  // 初始化
  const SETUP_KEY = "news_crawler_setup_done";

  function init() {
    registerMenuCommands();
    const isSetupDone = GM_getValue(SETUP_KEY, false);
    if (!isSetupDone) {
      showSetupWizard();
    }
    console.log("[新闻爬取器] 初始化完成");
  }

  // 首次设置向导
  function showSetupWizard() {
    const styles = `
      .nc-setup-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .nc-setup-panel {
        width: 500px;
        max-height: 80vh;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        overflow: hidden;
      }
      .nc-setup-header {
        padding: 20px 24px;
        background: linear-gradient(135deg, #4a9eff, #6b5bff);
        color: #fff;
      }
      .nc-setup-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 4px 0;
      }
      .nc-setup-subtitle {
        font-size: 12px;
        opacity: 0.9;
        margin: 0;
      }
      .nc-setup-body {
        padding: 20px 24px;
        max-height: 50vh;
        overflow-y: auto;
      }
      .nc-setup-section {
        margin-bottom: 16px;
      }
      .nc-setup-section-title {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 10px;
      }
      .nc-setup-presets {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .nc-setup-preset {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        background: #f5f7fa;
        border: 2px solid transparent;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .nc-setup-preset:hover {
        background: #e8f0fe;
      }
      .nc-setup-preset.selected {
        background: #e8f0fe;
        border-color: #4a9eff;
      }
      .nc-setup-preset input {
        margin-right: 8px;
        width: 16px;
        height: 16px;
      }
      .nc-setup-preset-info {
        flex: 1;
      }
      .nc-setup-preset-name {
        font-size: 13px;
        font-weight: 500;
        color: #333;
      }
      .nc-setup-preset-count {
        font-size: 11px;
        color: #888;
      }
      .nc-setup-footer {
        padding: 16px 24px;
        background: #f5f7fa;
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }
      .nc-setup-btn {
        padding: 10px 24px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .nc-setup-btn-skip {
        background: #fff;
        color: #666;
        border: 1px solid #ddd;
      }
      .nc-setup-btn-skip:hover {
        background: #f0f0f0;
      }
      .nc-setup-btn-add {
        background: linear-gradient(135deg, #4a9eff, #6b5bff);
        color: #fff;
      }
      .nc-setup-btn-add:hover {
        opacity: 0.9;
      }
    `;
    GM_addStyle(styles);

    const presets = [
      { key: "中央重点", name: "🏛️ 中央重点", desc: "人民日报、新华网、央视网等", count: 7 },
      { key: "央媒新闻", name: "📰 央媒新闻", desc: "人民网、中国日报、国际在线等", count: 6 },
      { key: "商业门户", name: "💼 商业门户", desc: "新浪、腾讯、网易、搜狐", count: 4 },
      { key: "科技资讯", name: "🔬 科技资讯", desc: "知乎、36氪、少数派、澎湃", count: 4 },
      { key: "热榜聚合", name: "🌐 热榜聚合", desc: "RadarAI、今日热榜", count: 2 },
      { key: "学习强国", name: "📚 学习强国", desc: "学习强国平台", count: 1 },
    ];

    const overlay = document.createElement("div");
    overlay.className = "nc-setup-overlay";
    overlay.innerHTML = `
      <div class="nc-setup-panel">
        <div class="nc-setup-header">
          <h2 class="nc-setup-title">📰 欢迎使用新闻爬取器</h2>
          <p class="nc-setup-subtitle">选择要添加的新闻源预设（可多选）</p>
        </div>
        <div class="nc-setup-body">
          <div class="nc-setup-presets">
            ${presets.map(p => `
              <label class="nc-setup-preset">
                <input type="checkbox" value="${p.key}" checked>
                <div class="nc-setup-preset-info">
                  <div class="nc-setup-preset-name">${p.name}</div>
                  <div class="nc-setup-preset-count">${p.desc}</div>
                </div>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="nc-setup-footer">
          <button class="nc-setup-btn nc-setup-btn-skip" id="nc-skip-setup">稍后添加</button>
          <button class="nc-setup-btn nc-setup-btn-add" id="nc-add-presets">添加选定源</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelectorAll(".nc-setup-preset").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.tagName !== "INPUT") {
          const cb = el.querySelector("input");
          cb.checked = !cb.checked;
          el.classList.toggle("selected", cb.checked);
        }
      });
    });

    overlay.querySelector("#nc-skip-setup").addEventListener("click", () => {
      GM_setValue(SETUP_KEY, true);
      GM_setValue(FEEDS_KEY, []);
      overlay.remove();
    });

    overlay.querySelector("#nc-add-presets").addEventListener("click", () => {
      const selected = Array.from(overlay.querySelectorAll("input:checked")).map(cb => cb.value);
      let allFeeds = [];
      selected.forEach(key => {
        const preset = FEED_PRESETS[key];
        if (preset) {
          allFeeds = allFeeds.concat(preset);
        }
      });
      const existingUrls = new Set(allFeeds.map(f => f.url));
      const uniqueFeeds = allFeeds.filter((feed, index, self) =>
        index === self.findIndex(f => f.url === feed.url)
      );
      GM_setValue(FEEDS_KEY, uniqueFeeds);
      GM_setValue(SETUP_KEY, true);
      GM_notification({
        title: "设置完成",
        text: `已添加 ${uniqueFeeds.length} 个新闻源`,
        silent: true,
      });
      overlay.remove();
      fetchAllFeeds();
    });
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

  function getTextContent(parent, tagNames) {
    for (const tag of tagNames) {
      const el = parent.querySelector(tag);
      if (el) {
        return el.textContent?.trim() || "";
      }
    }
    return "";
  }

  function getLink(item) {
    const linkEl = item.querySelector("link");
    if (linkEl) {
      const href = linkEl.getAttribute("href");
      if (href) return href;
      return linkEl.textContent?.trim() || "";
    }
    const enclosure = item.querySelector("enclosure");
    if (enclosure) {
      const url = enclosure.getAttribute("url");
      if (url) return url;
    }
    return "";
  }

  function parseDate(dateStr) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleString("zh-CN");
    } catch (e) {
      return dateStr;
    }
  }

  function extractNewsFromXML(doc, sourceName) {
    const items = [];
    const entries = doc.querySelectorAll("item, entry");
    if (entries.length === 0) {
      console.log(`[新闻爬取器] ${sourceName}: 未找到 item/entry 节点`);
      return items;
    }
    entries.forEach((item) => {
      const title = getTextContent(item, ["title"]);
      const link = getLink(item);
      const description = getTextContent(item, ["description", "summary", "content", "summary"]);
      const pubDateStr = getTextContent(item, ["pubDate", "published", "updated", "created", "dc:date"]);
      if (title) {
        items.push({
          title,
          link,
          description: description.replace(/<[^>]+>/g, "").substring(0, 200),
          pubDate: parseDate(pubDateStr),
          source: sourceName,
          crawledAt: Date.now(),
        });
      }
    });
    return items;
  }

  function extractNewsFromJSON(jsonObj, sourceName) {
    const items = [];
    const list = jsonObj.result?.data || jsonObj.items || jsonObj.articles || jsonObj.list || jsonObj.data || [];
    if (!Array.isArray(list) || list.length === 0) {
      console.log(`[新闻爬取器] ${sourceName}: JSON 中未找到数据数组`);
      return items;
    }
    list.forEach((item) => {
      const title = item.title || item.titleTxt || item.wap_title || "";
      const link = item.url || item.link || item.rawUrl || item.article_url || "";
      const description = item.intro || item.description || item.digest || item.abstract || item.summary || "";
      let pubDateStr = item.ctime || item.pubDate || item.publish_time || item.publishDate || item.date || "";
      if (typeof pubDateStr === "number") {
        pubDateStr = pubDateStr > 1e12 ? pubDateStr : pubDateStr * 1000;
      }
      if (title) {
        items.push({
          title,
          link,
          description: description.substring(0, 200),
          pubDate: parseDate(pubDateStr),
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
      console.log(`[新闻爬取器] ${feed.name}: 获取到 ${data.length} 字节`);
      if (type === "json" || feed.type === "json") {
        const jsonObj = JSON.parse(data);
        const items = extractNewsFromJSON(jsonObj, feed.name);
        console.log(`[新闻爬取器] ${feed.name}: 解析出 ${items.length} 条`);
        return items;
      } else {
        const doc = parseXML(data);
        const items = extractNewsFromXML(doc, feed.name);
        console.log(`[新闻爬取器] ${feed.name}: 解析出 ${items.length} 条`);
        return items;
      }
    } catch (error) {
      console.error(`[新闻爬取器] ${feed.name} 失败:`, error.message);
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
      .nc-item-clickable:hover {
        background: #e6f0ff;
        cursor: pointer;
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
      items.slice(0, 20).forEach((item) => {
        const date = item.pubDate ? `<span class="nc-item-date">${item.pubDate}</span>` : "";
        const hasLink = item.link && item.link.startsWith("http");
        if (hasLink) {
          html += `
          <div class="nc-item nc-item-clickable" data-link="${encodeURIComponent(item.link)}">
            <div class="nc-item-title">${item.title}</div>
            ${date}
          </div>
        `;
        } else {
          html += `
          <div class="nc-item" style="opacity:0.6;">
            <div class="nc-item-title">${item.title} <span style="color:#ccc;font-size:10px;">[无链接]</span></div>
            ${date}
          </div>
        `;
        }
      });
      if (items.length > 20) {
        html += `<div class="nc-item" style="color:#888;text-align:center;">...还有 ${items.length - 20} 条</div>`;
      }
      html += `</div>`;
    });
    listEl.innerHTML = html;
    listEl.querySelectorAll(".nc-item-clickable").forEach((el) => {
      el.addEventListener("click", () => {
        const link = decodeURIComponent(el.dataset.link);
        if (link && link.startsWith("http")) {
          GM_openInTab(link, { active: true });
        }
      });
    });
  }

  // ========== 用户配置 ==========

  let configPanel = null;

  function openFeedConfig() {
    if (configPanel) {
      configPanel.remove();
      configPanel = null;
    }
    createConfigPanel();
  }

  function createConfigPanel() {
    const styles = `
      .nc-config-panel {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 460px;
        max-height: 85vh;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 12px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.18);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .nc-config-header {
        padding: 16px;
        background: #fafafa;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .nc-config-title {
        font-size: 15px;
        font-weight: 600;
        color: #333;
        margin: 0;
      }
      .nc-config-close {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 20px;
        color: #999;
        border-radius: 4px;
      }
      .nc-config-close:hover {
        background: #eee;
        color: #666;
      }
      .nc-config-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
      }
      .nc-preset-section {
        margin-bottom: 16px;
        padding: 12px;
        background: #fff8e6;
        border: 1px solid #ffe58a;
        border-radius: 8px;
      }
      .nc-preset-title {
        font-size: 12px;
        font-weight: 600;
        color: #996600;
        margin-bottom: 10px;
      }
      .nc-preset-btns {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .nc-preset-btn {
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid #ffcc00;
        background: #fff;
        border-radius: 6px;
        cursor: pointer;
        color: #996600;
      }
      .nc-preset-btn:hover {
        background: #fff8e6;
        border-color: #ffaa00;
      }
      .nc-preset-btn.active {
        background: #ffaa00;
        color: #fff;
        border-color: #ffaa00;
      }
      .nc-feed-item {
        padding: 12px;
        background: #f9f9f9;
        border: 1px solid #eee;
        border-radius: 8px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
      }
      .nc-feed-info {
        flex: 1;
        min-width: 0;
      }
      .nc-feed-name {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 4px;
      }
      .nc-feed-url {
        font-size: 11px;
        color: #888;
        word-break: break-all;
      }
      .nc-feed-type {
        font-size: 10px;
        color: #fff;
        background: #4a9eff;
        padding: 2px 6px;
        border-radius: 3px;
        margin-left: 6px;
      }
      .nc-feed-delete {
        padding: 4px 8px;
        border: none;
        background: #ff4d4d;
        color: #fff;
        font-size: 11px;
        border-radius: 4px;
        cursor: pointer;
        margin-left: 8px;
      }
      .nc-feed-delete:hover {
        background: #ff3333;
      }
      .nc-add-feed {
        padding: 12px;
        background: #f0f7ff;
        border: 1px dashed #4a9eff;
        border-radius: 8px;
      }
      .nc-add-title {
        font-size: 12px;
        font-weight: 600;
        color: #4a9eff;
        margin-bottom: 10px;
      }
      .nc-form-row {
        margin-bottom: 8px;
      }
      .nc-form-label {
        font-size: 11px;
        color: #666;
        margin-bottom: 3px;
        display: block;
      }
      .nc-form-input {
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        box-sizing: border-box;
      }
      .nc-form-input:focus {
        outline: none;
        border-color: #4a9eff;
      }
      .nc-form-select {
        width: 100%;
        padding: 8px 10px;
        font-size: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #fff;
      }
      .nc-add-btn {
        width: 100%;
        padding: 10px;
        margin-top: 10px;
        border: none;
        background: #4a9eff;
        color: #fff;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
      }
      .nc-add-btn:hover {
        background: #3a8eef;
      }
      .nc-reset-btn {
        width: 100%;
        padding: 8px;
        margin-top: 8px;
        border: 1px solid #ddd;
        background: #fff;
        color: #666;
        font-size: 12px;
        border-radius: 6px;
        cursor: pointer;
      }
      .nc-reset-btn:hover {
        background: #f5f5f5;
      }
      .nc-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.3);
        z-index: 2147483646;
      }
    `;
    GM_addStyle(styles);

    const feeds = getFeeds();
    let html = `
      <div class="nc-overlay"></div>
      <div class="nc-config-panel">
        <div class="nc-config-header">
          <span class="nc-config-title">⚙️ 新闻源配置</span>
          <button class="nc-config-close">×</button>
        </div>
        <div class="nc-config-body">
          <div class="nc-preset-section">
            <div class="nc-preset-title">⚡ 一键切换预设</div>
            <div class="nc-preset-btns">
    `;
    Object.keys(FEED_PRESETS).forEach((presetName) => {
      html += `<button class="nc-preset-btn" data-preset="${presetName}">${presetName}</button>`;
    });
    html += `
            </div>
          </div>
          <div class="nc-feed-list">
    `;
    feeds.forEach((feed, index) => {
      html += `
        <div class="nc-feed-item" data-index="${index}">
          <div class="nc-feed-info">
            <div class="nc-feed-name">${feed.name}<span class="nc-feed-type">${feed.type || "xml"}</span></div>
            <div class="nc-feed-url">${feed.url}</div>
          </div>
          <button class="nc-feed-delete" data-index="${index}">删除</button>
        </div>
      `;
    });
    html += `
          </div>
          <div class="nc-add-feed">
            <div class="nc-add-title">+ 添加新闻源</div>
            <div class="nc-form-row">
              <label class="nc-form-label">名称</label>
              <input type="text" class="nc-form-input" id="nc-feed-name" placeholder="例如：澎湃新闻">
            </div>
            <div class="nc-form-row">
              <label class="nc-form-label">RSS URL</label>
              <input type="text" class="nc-form-input" id="nc-feed-url" placeholder="https://...">
            </div>
            <div class="nc-form-row">
              <label class="nc-form-label">类型</label>
              <select class="nc-form-select" id="nc-feed-type">
                <option value="xml">XML (RSS/Atom)</option>
                <option value="json">JSON</option>
              </select>
            </div>
            <button class="nc-add-btn" id="nc-add-feed-btn">添加</button>
          </div>
        </div>
      </div>
    `;
    configPanel = document.createElement("div");
    configPanel.innerHTML = html;
    document.body.appendChild(configPanel);
    configPanel.querySelector(".nc-overlay").addEventListener("click", closeConfigPanel);
    configPanel.querySelector(".nc-config-close").addEventListener("click", closeConfigPanel);
    configPanel.querySelector("#nc-add-feed-btn").addEventListener("click", addNewFeed);
    configPanel.querySelectorAll(".nc-feed-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const index = parseInt(e.target.dataset.index);
        deleteFeed(index);
      });
    });
    configPanel.querySelectorAll(".nc-preset-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const presetName = e.target.dataset.preset;
        switchToPreset(presetName);
      });
    });
  }

  function switchToPreset(presetName) {
    const preset = FEED_PRESETS[presetName];
    if (!preset) return;
    if (confirm(`确定切换到「${presetName}」预设吗？`)) {
      GM_setValue(FEEDS_KEY, preset);
      GM_notification({
        title: "已切换",
        text: `已切换到「${presetName}」，共 ${preset.length} 个新闻源`,
        silent: true,
      });
      closeConfigPanel();
      openFeedConfig();
    }
  }

  function closeConfigPanel() {
    if (configPanel) {
      configPanel.remove();
      configPanel = null;
    }
  }

  function addNewFeed() {
    const nameInput = configPanel.querySelector("#nc-feed-name");
    const urlInput = configPanel.querySelector("#nc-feed-url");
    const typeSelect = configPanel.querySelector("#nc-feed-type");
    const name = nameInput.value.trim();
    const url = urlInput.value.trim();
    const type = typeSelect.value;
    if (!name || !url) {
      alert("请填写名称和 URL");
      return;
    }
    const feeds = getFeeds();
    feeds.push({ name, url, type });
    GM_setValue(FEEDS_KEY, feeds);
    GM_notification({ title: "添加成功", text: `已添加「${name}」`, silent: true });
    closeConfigPanel();
    openFeedConfig();
  }

  function deleteFeed(index) {
    const feeds = getFeeds();
    const deleted = feeds.splice(index, 1)[0];
    GM_setValue(FEEDS_KEY, feeds);
    GM_notification({ title: "已删除", text: `已删除「${deleted.name}」`, silent: true });
    closeConfigPanel();
    openFeedConfig();
  }

  function resetFeeds() {
    if (confirm("确定恢复默认新闻源吗？")) {
      GM_setValue(FEEDS_KEY, DEFAULT_FEEDS);
      GM_notification({ title: "已重置", text: "已恢复默认新闻源", silent: true });
      closeConfigPanel();
    }
  }

  // 启动
  init();
})();
