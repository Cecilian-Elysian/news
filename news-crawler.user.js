// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/Cecilian-Elysian/news
// @version      2.2.4
// @description  一键抓取新闻、自动生成日报并导出
// @author       Cecilian-Elysian
// @match        *://*/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_addElement
// @grant        GM_addStyle
// @connect     *
// ==/UserScript==

(function () {
  "use strict";

  const Config = {
    DEFAULT_FEEDS: [
      { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", type: "json" },
      { name: "腾讯新闻", url: "https://rss.qq.com/news.xml", type: "rss" },
      { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml", type: "rss" },
      { name: "搜狐新闻", url: "https://www.sohu.com/rss/rss.xml", type: "rss" },
      { name: "知乎热榜", url: "https://www.zhihu.com/rss", type: "rss" },
      { name: "36氪", url: "https://36kr.com/feed", type: "rss" },
      { name: "虎嗅", url: "https://www.huxiu.com/rss/", type: "rss" },
      { name: "IT之家", url: "https://www.ithome.com/rss/", type: "rss" },
      { name: "观察者网", url: "https://www.guancha.cn/rss/", type: "rss" },
      { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", type: "json" },
      { name: "少数派", url: "https://sspai.com/rss", type: "rss" },
      { name: "掘金", url: "https://juejin.cn/rss", type: "rss" },
      { name: "腾讯科技", url: "https://new.qq.com/rss/index.xml", type: "rss" },
      { name: "凤凰网", url: "http://www.ifeng.com/rss/news.xml", type: "rss" },
      { name: "财经网", url: "http://feed.CNaiQ.com/finance", type: "rss" },
      { name: "第一财经", url: "https://feed.yicai.com/rss", type: "rss" },
      { name: "参考消息", url: "http://www.cankaoxiaoxi.com/rss/", type: "rss" },
      { name: "环球时报", url: "http://www.huanqiu.com/rss/", type: "rss" },
      { name: "RadarAI", url: "https://radarai.top/feed.xml", type: "rss" },
      { name: "微博热搜", url: "https://rsshub.app/weibo/hot", type: "rss" },
      { name: "知乎热榜", url: "https://rsshub.app/zhihu/hot", type: "rss" },
      { name: "百度热搜", url: "https://rsshub.app/baidu/hot", type: "rss" },
      { name: "Bilibili热搜", url: "https://rsshub.app/bilibili/hot", type: "rss" },
      { name: "抖音热搜", url: "https://rsshub.app/douyin/hot", type: "rss" },
      { name: "即刻热榜", url: "https://rsshub.app/jike/topic/default", type: "rss" },
      { name: "GitHub趋势", url: "https://rsshub.app/github/trending", type: "rss" },
      { name: "ProductHunt", url: "https://rsshub.app/producthunt/today", type: "rss" },
      { name: "HackerNews", url: "https://rsshub.app/hacker-news/best", type: "rss" },
      { name: "Reddit编程", url: "https://www.reddit.com/r/programming/.rss", type: "rss" },
      { name: "Stack Overflow", url: "https://stackprinter/questions?service=stackoverflow&language=zh-CN&width=640", type: "webpage" },
    ],
    API_ENDPOINTS: {
      "Bilibili": {
        url: "https://api.bilibili.com/x/web-interface/ranking/v2?type=all",
        type: "json"
      },
      "36氪": {
        url: "https://36kr.com/pp/api/newsflash?per_page=20&page=1",
        type: "json"
      }
    },
    PRIORITY: {
      "人民日报": 10, "新华网": 10, "央视新闻": 10, "澎湃新闻": 8, "观察者网": 8,
      "腾讯新闻": 6, "腾讯科技": 6, "新浪新闻": 6, "网易新闻": 6, "知乎热榜": 7, "36氪": 7, "虎嗅": 7,
      "IT之家": 6, "搜狐新闻": 5, "少数派": 7, "掘金": 7, "凤凰网": 5, "财经网": 5, "第一财经": 5,
      "参考消息": 6, "环球时报": 6, "RadarAI": 8,
      "微博热搜": 6, "百度热搜": 6, "Bilibili热搜": 5, "抖音热搜": 5, "即刻热榜": 6,
      "GitHub趋势": 7, "ProductHunt": 6, "HackerNews": 7, "Reddit编程": 7, "Stack Overflow": 6,
      "Bilibili": 6
    }
  };

  const State = {
    news: [],
    customFeeds: [],
    opacity: 90,
    folder: "新闻日报",
    lastFetch: null,
    darkMode: false
  };

  const Storage = {
    get: (key, defaultVal) => GM_getValue(key, defaultVal),
    set: (key, val) => GM_setValue(key, val),
    getNews: () => State.news,
    setNews: (arr) => { State.news = arr; Storage.set("news", arr); },
    getCustomFeeds: () => State.customFeeds.length ? State.customFeeds : Config.DEFAULT_FEEDS,
    setCustomFeeds: (arr) => { State.customFeeds = arr; Storage.set("custom_feeds", arr); },
    getFolder: () => State.folder,
    setFolder: (f) => { State.folder = f; Storage.set("folder", f); },
    getOpacity: () => State.opacity,
    setOpacity: (o) => { State.opacity = o; Storage.set("opacity", o); },
    getLastFetch: () => State.lastFetch,
    setLastFetch: (t) => { State.lastFetch = t; Storage.set("news_time", t); },
    getDarkMode: () => State.darkMode,
    setDarkMode: (d) => { State.darkMode = d; Storage.set("darkMode", d); }
  };

  const Utils = {
    formatDate: (s) => {
      if (!s) return "";
      try {
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
      } catch { return s; }
    },
    formatDateStr: () => {
      return new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    },
    httpReq: (url) => {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "GET",
          url: url,
          timeout: 15000,
          onload: (r) => {
            if (r.status >= 200 && r.status < 300) resolve(r.responseText);
            else reject(new Error("HTTP " + r.status + ": " + (r.responseText?.substring(0, 100) || "")));
          },
          onerror: (e) => reject(new Error("请求失败: " + (e?.message || "unknown"))),
          ontimeout: () => reject(new Error("请求超时"))
        });
      });
    },
    notify: (title, text) => GM_notification({ title, text, silent: true })
  };

  const Parser = {
    parseRSS: (data, sourceName) => {
      const news = [];
      try {
        const p = new DOMParser().parseFromString(data, "text/xml");
        if (p.querySelector("parsererror")) {
          console.warn(sourceName + ": XML解析错误");
          return news;
        }
        p.querySelectorAll("item, entry").forEach(item => {
          const title = item.querySelector("title")?.textContent?.trim();
          const link = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "";
          const date = item.querySelector("pubDate, published")?.textContent?.trim() || "";
          if (title) news.push({ title, link, date: Utils.formatDate(date), source: sourceName });
        });
      } catch (e) { console.warn("RSS解析失败:", sourceName, e); }
      return news;
    },
    parseJSON: (data, sourceName) => {
      const news = [];
      try {
        const json = JSON.parse(data);
        (json.result?.data || json.data || []).forEach(item => {
          const title = item.title || item.titleTxt;
          if (title) {
            let ct = item.ctime || item.pubTime;
            if (ct) ct = ct > 1e12 ? ct : ct * 1000;
            news.push({
              title,
              link: item.url || "",
              date: Utils.formatDate(ct) || Utils.formatDate(item.pubDate),
              source: sourceName
            });
          }
        });
      } catch (e) { console.warn("JSON解析失败:", sourceName, e); }
      return news;
    },
    parseWebpage: (data, sourceName) => {
      const news = [];
      try {
        const p = new DOMParser().parseFromString(data, "text/html");
        p.querySelectorAll("a[href]").forEach(a => {
          const title = a.textContent?.trim() || "";
          const link = a.getAttribute("href") || "";
          if (title && title.length > 5 && link.startsWith("http")) {
            news.push({ title: title.substring(0, 100), link, date: Utils.formatDate(Date.now()), source: sourceName });
          }
        });
      } catch (e) { console.warn("网页解析失败:", sourceName, e); }
      return news;
    },
    parseBilibili: (data, sourceName) => {
      const news = [];
      try {
        const json = JSON.parse(data);
        (json.data?.list || []).forEach(item => {
          if (item.title) {
            news.push({
              title: item.title,
              link: item.short_link_v2 || "https://www.bilibili.com/video/" + item.bvid,
              date: Utils.formatDate(item.pubdate * 1000),
              source: sourceName
            });
          }
        });
      } catch (e) { console.warn("Bilibili解析失败:", sourceName, e); }
      return news;
    },
    parse36kr: (data, sourceName) => {
      const news = [];
      try {
        const json = JSON.parse(data);
        (json.data?.items || []).forEach(item => {
          if (item.title) {
            news.push({
              title: item.title,
              link: item.news_url || "https://36kr.com/p/" + item.id,
              date: Utils.formatDate(item.published_at),
              source: sourceName
            });
          }
        });
      } catch (e) { console.warn("36kr解析失败:", sourceName, e); }
      return news;
    },
    parse: (data, sourceName, type) => {
      switch (type) {
        case "json": return Parser.parseJSON(data, sourceName);
        case "webpage": return Parser.parseWebpage(data, sourceName);
        default: return Parser.parseRSS(data, sourceName);
      }
    }
  };

  const Fetcher = {
    fetchAll: async () => {
      const allFeeds = Storage.getCustomFeeds();
      const statusEl = UI.getStatusEl();
      statusEl.textContent = "🔄 并行抓取中...";

      const fallback = (primaryType) => {
        const all = ["rss", "json", "webpage"];
        return all.filter(t => t !== primaryType);
      };

      const tryApiEndpoint = async (feedName) => {
        for (const [apiName, apiConfig] of Object.entries(Config.API_ENDPOINTS)) {
          if (feedName.includes(apiName) || apiName.includes(feedName)) {
            try {
              const data = await Utils.httpReq(apiConfig.url);
              if (!data || data.length < 10) continue;
              let parsed = [];
              if (apiName === "Bilibili") parsed = Parser.parseBilibili(data, feedName);
              else if (apiName === "36氪") parsed = Parser.parse36kr(data, feedName);
              else parsed = Parser.parse(data, feedName, apiConfig.type);
              if (parsed.length > 0) {
                console.log(feedName + ": API(" + apiName + ")成功");
                return parsed;
              }
            } catch (e) { continue; }
          }
        }
        return [];
      };

      const fetchOne = async (feed) => {
        const primaryType = feed.type || "rss";
        let parsed = [];

        try {
          const data = await Utils.httpReq(feed.url);
          if (data && data.length >= 10) {
            parsed = Parser.parse(data, feed.name, primaryType);
            if (parsed.length > 0) {
              console.log(feed.name + ": " + primaryType + "成功");
              return parsed;
            }
          }
        } catch (e) { console.warn(feed.name + ": " + primaryType + "失败") }

        if (parsed.length === 0) {
          for (const type of fallback(primaryType)) {
            try {
              const data = await Utils.httpReq(feed.url);
              if (!data || data.length < 10) continue;
              parsed = Parser.parse(data, feed.name, type);
              if (parsed.length > 0) {
                console.log(feed.name + ": " + primaryType + "失败→" + type + "成功");
                return parsed;
              }
            } catch (e) { continue; }
          }
        }

        if (parsed.length === 0) {
          parsed = await tryApiEndpoint(feed.name);
        }

        if (parsed.length === 0) {
          console.error(feed.name + ": 所有方式均失败");
        }
        return parsed;
      };

      const results = await Promise.all(allFeeds.map(fetchOne));
      const news = results.flat();
      const successCount = news.length > 0 ? new Set(news.map(n => n.source)).size : 0;

      news.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      Storage.setNews(news);
      Storage.setLastFetch(Date.now());
      UI.updateStats();
      UI.updateNewsList();
      statusEl.textContent = "✅ 抓取完成: " + successCount + "个源, " + news.length + "条";
      Utils.notify("抓取完成", "获取 " + news.length + " 条新闻");
    }
  };

  const Reporter = {
    generate: async () => {
      const news = Storage.getNews();
      if (!news.length) {
        UI.getStatusEl().textContent = "⚠️ 请先抓取新闻";
        Utils.notify("无新闻", "请先抓取");
        return;
      }

      const top = [...news].sort((a, b) => (Config.PRIORITY[b.source] || 5) - (Config.PRIORITY[a.source] || 5)).slice(0, 3);
      const dateStr = Utils.formatDateStr();
      const folder = Storage.getFolder();

      let md = "# 📰 今日新闻日报\n\n> " + dateStr + " | 共" + news.length + "条\n\n---\n\n## 📌 重点关注\n\n";
      top.forEach((n, i) => {
        md += (i + 1) + ". **" + n.title + "**\n   - " + n.source + " | " + (n.date || "无日期") + "\n\n";
      });
      md += "---\n\n## 📋 全部新闻\n\n";

      const grouped = {};
      news.forEach(item => {
        if (!grouped[item.source]) grouped[item.source] = [];
        grouped[item.source].push(item);
      });

      Object.keys(grouped).sort().forEach(src => {
        md += "### " + src + " (" + grouped[src].length + ")\n\n";
        grouped[src].forEach(n => {
          md += "- [" + n.title + "](" + (n.link || "#") + ")\n";
        });
        md += "\n";
      });

      md += "\n---\n*由新闻爬取器自动生成*\n";

      const fileName = folder + "/【" + dateStr + "】日报.md";
      Downloader.downloadText(md, fileName);
      UI.getStatusEl().textContent = "✅ 日报已导出";
    }
  };

  const Downloader = {
    dirHandle: null,
    downloadText: async (content, fileName) => {
      const blob = new Blob(["\uFEFF" + content], { type: "text/plain;charset=utf-8" });

      if (window.showDirectoryPicker && Downloader.dirHandle) {
        try {
          const fileHandle = await Downloader.dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          Utils.notify("下载成功", fileName);
          return;
        } catch (e) {
          console.warn("File System Access API 失败:", e);
        }
      }

      const url = URL.createObjectURL(blob);
      GM_download({
        url: url,
        name: fileName,
        saveAs: true,
        onload: () => {
          URL.revokeObjectURL(url);
          Utils.notify("下载成功", fileName);
        },
        onerror: () => Utils.notify("下载失败", "请重试")
      });
    },
    selectFolder: async () => {
      if (window.showDirectoryPicker) {
        try {
          Downloader.dirHandle = await window.showDirectoryPicker();
          Utils.notify("已选择文件夹", "下载将保存到: " + Downloader.dirHandle.name);
          Storage.set("downloadFolder", Downloader.dirHandle.name);
          return true;
        } catch (e) {
          console.warn("选择文件夹取消:", e);
          return false;
        }
      } else {
        Utils.notify("不支持", "您的浏览器不支持文件夹选择功能");
        return false;
      }
    }
  };

  const UI = {
    sidebar: null,
    elements: {},

    init: () => {
      Storage.setNews(Storage.get("news", []));
      State.customFeeds = Storage.get("custom_feeds", []);
      State.folder = Storage.get("folder", "新闻日报");
      State.opacity = Storage.get("opacity", 90);
      State.lastFetch = Storage.get("news_time", null);
      State.darkMode = Storage.get("darkMode", false);

      UI.createStyles();
      UI.createSidebar();
      UI.createFloatingButton();
      UI.applyDarkMode();
      UI.updateStats();
      UI.updateNewsList();
      Utils.notify("📰 新闻日报已就绪", "点击按钮开始抓取");
    },

    createStyles: () => {
      GM_addStyle(`
        .nc-sidebar{position:fixed;top:0;right:0;width:300px;height:100vh;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,.12);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Microsoft YaHei",sans-serif;display:flex;flex-direction:column;transition:background .3s,color .3s}
        .nc-header{height:64px;padding:0 16px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
        .nc-header h1{margin:0;font-size:18px;color:#fff;font-weight:600;display:flex;align-items:center;gap:8px}
        .nc-header-actions{display:flex;gap:8px;align-items:center}
        .nc-action-btn{width:28px;height:28px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .nc-action-btn:hover{background:rgba(255,255,255,.35);transform:scale(1.1)}
        .nc-body{flex:1;overflow-y:auto;padding:16px}
        .nc-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
        .nc-stat-card{padding:12px;background:linear-gradient(135deg,#f5f7fa,#e4e8ec);border-radius:10px;text-align:center;transition:background .3s}
        .nc-stat-num{font-size:22px;font-weight:700;color:#667eea;transition:color .3s}
        .nc-stat-label{font-size:11px;color:#888;margin-top:2px;transition:color .3s}
        .nc-status{padding:10px 12px;background:#f0f7ff;border-radius:8px;font-size:12px;color:#667eea;margin-bottom:14px;text-align:center;border:1px solid #e0e9ff;transition:all .3s}
        .nc-btn-group{display:flex;flex-direction:column;gap:8px;margin-bottom:16px}
        .nc-btn{display:block;width:100%;padding:12px 14px;background:#fff;border:1px solid #e0e0e0;border-radius:10px;cursor:pointer;font-size:13px;color:#333;text-align:left;transition:all .2s;font-family:inherit}
        .nc-btn:hover{background:#f8f9ff;border-color:#667eea;color:#667eea}
        .nc-btn:active{transform:scale(.98)}
        .nc-btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;font-weight:600}
        .nc-btn-primary:hover{filter:brightness(1.08);color:#fff}
        .nc-btn-danger{color:#e74c3c;border-color:#e74c3c}
        .nc-btn-danger:hover{background:#fef5f5}
        .nc-section{border-top:1px solid #eee;padding-top:14px;margin-top:4px;transition:border-color .3s}
        .nc-section-title{font-size:12px;color:#888;margin:0 0 10px;font-weight:600;display:flex;align-items:center;gap:6px;transition:color .3s}
        .nc-group{margin-bottom:12px}
        .nc-group-header{padding:8px 10px;background:#f5f5f5;font-size:11px;font-weight:600;color:#555;border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;transition:all .3s}
        .nc-item{padding:10px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;cursor:pointer;color:#333;transition:background .15s,color .3s;border-radius:0}
        .nc-item:hover{background:#f8f9ff}
        .nc-item:last-child{border:none}
        .nc-item-title{line-height:1.45;margin-bottom:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .nc-item-meta{font-size:10px;color:#aaa;display:flex;gap:8px;transition:color .3s}
        .nc-item-source{color:#667eea}
        .nc-empty{text-align:center;color:#bbb;font-size:13px;padding:40px 0;transition:color .3s}
        .nc-float-btn{position:fixed;bottom:24px;right:24px;width:56px;height:56px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:50%;box-shadow:0 6px 20px rgba(102,126,234,.4);cursor:pointer;z-index:2147483645;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;transition:all .3s}
        .nc-float-btn:hover{transform:scale(1.1);box-shadow:0 8px 28px rgba(102,126,234,.5)}
        .nc-modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:2147483647;display:none;align-items:center;justify-content:center}
        .nc-modal-overlay.active{display:flex}
        .nc-dark.nc-modal-overlay{background:rgba(0,0,0,.7)}
        .nc-modal{background:#fff;border-radius:14px;padding:24px;width:90%;max-width:380px;font-family:inherit;transition:background .3s,color .3s}
        .nc-modal h3{margin:0 0 16px;font-size:16px;color:#333;transition:color .3s}
        .nc-modal input,.nc-modal select{width:100%;padding:10px 12px;margin-bottom:10px;border:1px solid #ddd;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;background:#fff;color:#333;transition:all .3s}
        .nc-modal input:focus,.nc-modal select:focus{outline:none;border-color:#667eea}
        .nc-modal-btns{display:flex;gap:10px;margin-top:14px}
        .nc-modal-btns button{flex:1;padding:10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;transition:all .2s;font-family:inherit}
        .nc-modal-cancel{background:#f0f0f0;color:#666}
        .nc-modal-cancel:hover{background:#e0e0e0}
        .nc-modal-confirm{background:#667eea;color:#fff}
        .nc-modal-confirm:hover{background:#5a70dd}
        .nc-toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:2147483647;opacity:0;transition:opacity .3s}
        .nc-toast.show{opacity:1}
        .nc-dark{background:#1a1a2e!important;color:#e0e0e0!important}
        .nc-dark .nc-header{background:linear-gradient(135deg,#1a1a2e,#16213e)}
        .nc-dark .nc-stat-card{background:linear-gradient(135deg,#2d2d44,#1f1f35)}
        .nc-dark .nc-stat-num{color:#a0a0ff}
        .nc-dark .nc-stat-label{color:#888}
        .nc-dark .nc-status{background:#252540;border-color:#3a3a5c;color:#a0a0ff}
        .nc-dark .nc-btn{background:#252540;border-color:#3a3a5c;color:#e0e0e0}
        .nc-dark .nc-btn:hover{background:#2d2d50;border-color:#667eea;color:#a0a0ff}
        .nc-dark .nc-section{border-color:#333}
        .nc-dark .nc-section-title{color:#888}
        .nc-dark .nc-group-header{background:#252540;color:#a0a0ff}
        .nc-dark .nc-item{color:#e0e0e0;border-color:#333}
        .nc-dark .nc-item:hover{background:#252540}
        .nc-dark .nc-item-meta{color:#888}
        .nc-dark .nc-item-source{color:#a0a0ff}
        .nc-dark .nc-empty{color:#666}
        .nc-dark .nc-modal{background:#1f1f35}
        .nc-dark .nc-modal h3{color:#e0e0e0}
        .nc-dark .nc-modal input,.nc-dark .nc-modal select{background:#252540;border-color:#3a3a5c;color:#e0e0e0}
        .nc-dark .nc-modal-cancel{background:#2d2d44;color:#a0a0ff}
        .nc-dark .nc-float-btn{background:linear-gradient(135deg,#1a1a2e,#16213e)}
      `);
    },

    createSidebar: () => {
      UI.sidebar = GM_addElement("div", { class: "nc-sidebar" });
      UI.sidebar.innerHTML = `
        <div class="nc-header">
          <h1>📰 新闻日报</h1>
          <div class="nc-header-actions">
            <button class="nc-action-btn" id="nc-settings" title="设置">⚙️</button>
            <span id="nc-opacity-text" style="color:#fff;font-size:12px;min-width:36px;text-align:center">${State.opacity}%</span>
            <button class="nc-action-btn" id="nc-op-minus" title="透明度减少">−</button>
            <button class="nc-action-btn" id="nc-op-plus" title="透明度增加">+</button>
            <button class="nc-action-btn" id="nc-close" title="关闭">×</button>
          </div>
        </div>
        <div class="nc-body">
          <div class="nc-stats">
            <div class="nc-stat-card"><div class="nc-stat-num" id="nc-count">0</div><div class="nc-stat-label">新闻条数</div></div>
            <div class="nc-stat-card"><div class="nc-stat-num" id="nc-sources">0</div><div class="nc-stat-label">来源数量</div></div>
            <div class="nc-stat-card"><div class="nc-stat-num" id="nc-time">-</div><div class="nc-stat-label">最后更新</div></div>
            <div class="nc-stat-card"><div class="nc-stat-num" id="nc-folder" style="font-size:14px">📁</div><div class="nc-stat-label">导出位置</div></div>
          </div>
          <div class="nc-status" id="nc-status"></div>
          <div class="nc-btn-group">
            <button class="nc-btn nc-btn-primary" id="nc-start">🚀 一键抓取并生成日报</button>
            <button class="nc-btn" id="nc-fetch">🔄 仅抓取新闻</button>
            <button class="nc-btn" id="nc-report">📑 仅生成日报</button>
          </div>
          <div class="nc-section">
            <h3 class="nc-section-title">📋 最新新闻 <span id="nc-list-count"></span></h3>
            <div id="nc-news-list"><div class="nc-empty">暂无新闻，点击抓取</div></div>
          </div>
        </div>
      `;
      document.body.appendChild(UI.sidebar);
      UI.cacheElements();
      UI.bindEvents();
      UI.sidebar.style.background = "rgba(255,255,255," + State.opacity / 100 + ")";
      UI.sidebar.style.display = "none";
    },

    cacheElements: () => {
      UI.elements = {
        count: UI.sidebar.querySelector("#nc-count"),
        sources: UI.sidebar.querySelector("#nc-sources"),
        time: UI.sidebar.querySelector("#nc-time"),
        folder: UI.sidebar.querySelector("#nc-folder"),
        status: UI.sidebar.querySelector("#nc-status"),
        newsList: UI.sidebar.querySelector("#nc-news-list"),
        listCount: UI.sidebar.querySelector("#nc-list-count"),
        opacityText: UI.sidebar.querySelector("#nc-opacity-text"),
        start: UI.sidebar.querySelector("#nc-start"),
        fetch: UI.sidebar.querySelector("#nc-fetch"),
        report: UI.sidebar.querySelector("#nc-report"),
        settings: UI.sidebar.querySelector("#nc-settings"),
        close: UI.sidebar.querySelector("#nc-close"),
        opMinus: UI.sidebar.querySelector("#nc-op-minus"),
        opPlus: UI.sidebar.querySelector("#nc-op-plus")
      };
    },

    bindEvents: () => {
      const e = UI.elements;
      e.start.addEventListener("click", async () => {
        e.status.textContent = "🚀 开始一键抓取...";
        await Fetcher.fetchAll();
        await Reporter.generate();
        e.status.textContent = "✅ 全部完成!";
      });
      e.fetch.addEventListener("click", async () => { await Fetcher.fetchAll(); });
      e.report.addEventListener("click", async () => { await Reporter.generate(); });
      e.settings.addEventListener("click", () => UI.showSettingsModal());
      e.close.addEventListener("click", () => UI.sidebar.style.display = "none");
      e.opMinus.addEventListener("click", () => UI.changeOpacity(-10));
      e.opPlus.addEventListener("click", () => UI.changeOpacity(10));
    },

    createFloatingButton: () => {
      const btn = document.createElement("div");
      btn.className = "nc-float-btn";
      btn.innerHTML = "📰";
      btn.addEventListener("click", () => {
        UI.sidebar.style.display = UI.sidebar.style.display === "none" ? "flex" : "none";
      });
      document.body.appendChild(btn);
    },

    changeOpacity: (delta) => {
      State.opacity = Math.max(30, Math.min(100, State.opacity + delta));
      UI.sidebar.style.background = "rgba(255,255,255," + State.opacity / 100 + ")";
      UI.elements.opacityText.textContent = State.opacity + "%";
      Storage.setOpacity(State.opacity);
    },

    updateStats: () => {
      const news = Storage.getNews();
      const sources = new Set(news.map(n => n.source));
      UI.elements.count.textContent = news.length;
      UI.elements.sources.textContent = sources.size;
      UI.elements.time.textContent = State.lastFetch ? Utils.formatDate(State.lastFetch) : "-";
      UI.elements.folder.textContent = State.folder;
    },

    updateNewsList: () => {
      const news = Storage.getNews();
      const el = UI.elements.newsList;
      UI.elements.listCount.textContent = news.length ? "(" + news.length + ")" : "";

      if (!news.length) {
        el.innerHTML = '<div class="nc-empty">暂无新闻，点击抓取</div>';
        return;
      }

      const grouped = {};
      news.forEach(item => {
        if (!grouped[item.source]) grouped[item.source] = [];
        grouped[item.source].push(item);
      });

      let html = "";
      Object.keys(grouped).sort().forEach(src => {
        html += '<div class="nc-group" data-source="' + src + '">';
        html += '<div class="nc-group-header"><span>' + src + '</span><span>' + grouped[src].length + '条</span></div>';
        grouped[src].slice(0, 5).forEach((n, idx) => {
          html += '<div class="nc-item" data-link="' + (n.link || "") + '"><div class="nc-item-title">' + n.title + '</div>';
          html += '<div class="nc-item-meta"><span class="nc-item-source">' + n.source + '</span><span>' + (n.date || "") + '</span></div></div>';
        });
        if (grouped[src].length > 5) {
          html += '<div class="nc-item nc-show-more" style="color:#667eea;text-align:center;font-size:11px;cursor:pointer">查看更多 ' + grouped[src].length + ' 条...</div>';
        }
        html += '</div>';
      });
      el.innerHTML = html;

      el.querySelectorAll(".nc-item[data-link]").forEach(item => {
        item.addEventListener("click", () => {
          const link = item.dataset.link;
          if (link) window.open(link, "_blank");
        });
      });

      el.querySelectorAll(".nc-show-more").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const group = btn.closest(".nc-group");
          const src = group.dataset.source;
          const items = grouped[src];
          let itemsHtml = "";
          items.slice(5).forEach(n => {
            itemsHtml += '<div class="nc-item" data-link="' + (n.link || "") + '"><div class="nc-item-title">' + n.title + '</div>';
            itemsHtml += '<div class="nc-item-meta"><span class="nc-item-source">' + n.source + '</span><span>' + (n.date || "") + '</span></div></div>';
          });
          btn.insertAdjacentHTML("beforebegin", itemsHtml);
          btn.remove();
          el.querySelectorAll(".nc-item[data-link]").forEach(item => {
            item.addEventListener("click", () => {
              const link = item.dataset.link;
              if (link) window.open(link, "_blank");
            });
          });
        });
      });
    },

    getStatusEl: () => UI.elements.status,

    showAddModal: () => {
      const overlay = GM_addElement("div", { class: "nc-modal-overlay" });
      if (State.darkMode) overlay.classList.add("nc-dark");
      overlay.innerHTML = `
        <div class="nc-modal">
          <h3>➕ 添加新闻源</h3>
          <input type="text" id="nc-add-name" placeholder="新闻源名称，如：澎湃新闻">
          <input type="text" id="nc-add-url" placeholder="订阅地址（RSS/JSON/网页URL）">
          <select id="nc-add-type">
            <option value="rss">RSS/XML</option>
            <option value="json">JSON API</option>
            <option value="webpage">网页URL</option>
          </select>
          <div class="nc-modal-btns">
            <button class="nc-modal-cancel" id="nc-add-cancel">取消</button>
            <button class="nc-modal-confirm" id="nc-add-confirm">添加</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector("#nc-add-cancel").addEventListener("click", () => overlay.remove());
      overlay.querySelector("#nc-add-confirm").addEventListener("click", () => {
        const name = overlay.querySelector("#nc-add-name").value.trim();
        const url = overlay.querySelector("#nc-add-url").value.trim();
        const type = overlay.querySelector("#nc-add-type").value;
        if (name && url) {
          const feeds = Storage.getCustomFeeds();
          feeds.push({ name, url, type });
          Storage.setCustomFeeds(feeds);
          Utils.notify("已添加", name + " 已添加");
          overlay.remove();
        }
      });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.classList.add("active");
    },

    showManageModal: () => {
      const feeds = Storage.getCustomFeeds();
      const overlay = GM_addElement("div", { class: "nc-modal-overlay" });
      if (State.darkMode) overlay.classList.add("nc-dark");
      let html = '<div class="nc-modal"><h3>⚙️ 管理新闻源</h3><div style="max-height:300px;overflow-y:auto;margin-bottom:12px">';
      feeds.forEach((f, i) => {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;font-size:12px">';
        html += '<div><div style="font-weight:600">' + f.name + '</div><div style="color:#888;font-size:10px">' + f.type + '</div></div>';
        html += '<button class="nc-btn nc-btn-danger" style="width:auto;padding:4px 10px;font-size:11px" data-idx="' + i + '">删除</button></div>';
      });
      html += '</div><div class="nc-modal-btns"><button class="nc-modal-confirm" id="nc-manage-close" style="flex:1">关闭</button></div></div>';
      overlay.innerHTML = html;
      document.body.appendChild(overlay);

      overlay.querySelectorAll(".nc-btn-danger").forEach(btn => {
        btn.addEventListener("click", () => {
          const idx = parseInt(btn.dataset.idx);
          const newFeeds = feeds.filter((_, i) => i !== idx);
          Storage.setCustomFeeds(newFeeds);
          overlay.remove();
          UI.showManageModal();
        });
      });
      overlay.querySelector("#nc-manage-close").addEventListener("click", () => overlay.remove());
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.classList.add("active");
    },

    showFolderModal: () => {
      const overlay = GM_addElement("div", { class: "nc-modal-overlay" });
      if (State.darkMode) overlay.classList.add("nc-dark");
      const folderName = Storage.get("downloadFolder") || "";
      overlay.innerHTML = `
        <div class="nc-modal">
          <h3>📂 修改导出位置</h3>
          <p style="color:#888;font-size:12px;margin-bottom:10px">设置导出文件的文件夹名称</p>
          <input type="text" id="nc-folder-input" value="${State.folder}" placeholder="如：新闻日报">
          <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
            <button class="nc-btn" id="nc-folder-doc" style="padding:6px 10px;font-size:11px">📄 Documents</button>
            <button class="nc-btn" id="nc-folder-desk" style="padding:6px 10px;font-size:11px">🖥️ Desktop</button>
            <button class="nc-btn" id="nc-folder-down" style="padding:6px 10px;font-size:11px">📥 Downloads</button>
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:12px 0">
          <p style="color:#888;font-size:12px;margin-bottom:8px">🎯 指定下载文件夹（推荐）</p>
          <p style="color:#aaa;font-size:11px;margin-bottom:8px">选择后，每次下载会直接保存到指定文件夹，无需选择位置</p>
          <button class="nc-btn nc-btn-primary" id="nc-select-folder" style="margin-bottom:8px">
            ${folderName ? "📁 已选择: " + folderName : "📂 选择下载文件夹"}
          </button>
          <p style="color:#aaa;font-size:10px">⚠️ 仅 Chrome/Edge 等 Chromium 浏览器支持</p>
          <div class="nc-modal-btns" style="margin-top:14px">
            <button class="nc-modal-cancel" id="nc-folder-cancel">取消</button>
            <button class="nc-modal-confirm" id="nc-folder-confirm">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector("#nc-folder-input");
      overlay.querySelector("#nc-folder-doc").addEventListener("click", () => { input.value = "Documents/新闻日报"; });
      overlay.querySelector("#nc-folder-desk").addEventListener("click", () => { input.value = "Desktop/新闻日报"; });
      overlay.querySelector("#nc-folder-down").addEventListener("click", () => { input.value = "Downloads/新闻日报"; });
      overlay.querySelector("#nc-select-folder").addEventListener("click", async () => {
        const success = await Downloader.selectFolder();
        if (success) {
          const folder = Storage.get("downloadFolder") || "";
          overlay.querySelector("#nc-select-folder").textContent = folder ? "📁 已选择: " + folder : "📂 选择下载文件夹";
        }
      });
      overlay.querySelector("#nc-folder-cancel").addEventListener("click", () => overlay.remove());
      overlay.querySelector("#nc-folder-confirm").addEventListener("click", () => {
        const folder = input.value.trim() || "新闻日报";
        Storage.setFolder(folder);
        UI.updateStats();
        Utils.notify("已保存", "文件名: " + folder);
        overlay.remove();
      });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.classList.add("active");
    },

    showClearModal: () => {
      const overlay = GM_addElement("div", { class: "nc-modal-overlay" });
      if (State.darkMode) overlay.classList.add("nc-dark");
      overlay.innerHTML = `
        <div class="nc-modal">
          <h3>🗑️ 清空数据</h3>
          <p style="color:#666;font-size:13px;margin-bottom:14px">确定要清空所有新闻数据吗？此操作不可恢复。</p>
          <div class="nc-modal-btns">
            <button class="nc-modal-cancel" id="nc-clear-cancel">取消</button>
            <button class="nc-modal-confirm" id="nc-clear-confirm" style="background:#e74c3c">确认清空</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector("#nc-clear-cancel").addEventListener("click", () => overlay.remove());
      overlay.querySelector("#nc-clear-confirm").addEventListener("click", () => {
        Storage.setNews([]);
        Storage.setLastFetch(null);
        UI.updateStats();
        UI.updateNewsList();
        Utils.notify("已清空", "所有新闻数据已清除");
        overlay.remove();
      });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.classList.add("active");
    },

    showSettingsModal: () => {
      const overlay = GM_addElement("div", { class: "nc-modal-overlay" });
      if (State.darkMode) overlay.classList.add("nc-dark");
      overlay.innerHTML = `
        <div class="nc-modal" style="max-width:420px">
          <h3>⚙️ 设置</h3>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button class="nc-btn" id="nc-s-add">➕ 添加新闻源</button>
            <button class="nc-btn" id="nc-s-manage">⚙️ 管理新闻源</button>
            <button class="nc-btn" id="nc-s-folder">📂 修改导出位置</button>
            <button class="nc-btn" id="nc-s-dark">${State.darkMode ? "☀️ 日间模式" : "🌙 夜间模式"}</button>
            <button class="nc-btn nc-btn-danger" id="nc-s-clear">🗑️ 清空数据</button>
          </div>
          <div class="nc-modal-btns" style="margin-top:16px">
            <button class="nc-modal-confirm" id="nc-s-close" style="flex:1">关闭</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector("#nc-s-add").addEventListener("click", () => { overlay.remove(); UI.showAddModal(); });
      overlay.querySelector("#nc-s-manage").addEventListener("click", () => { overlay.remove(); UI.showManageModal(); });
      overlay.querySelector("#nc-s-folder").addEventListener("click", () => { overlay.remove(); UI.showFolderModal(); });
      overlay.querySelector("#nc-s-dark").addEventListener("click", () => {
        State.darkMode = !State.darkMode;
        Storage.setDarkMode(State.darkMode);
        UI.applyDarkMode();
        overlay.remove();
        Utils.notify(State.darkMode ? "🌙 夜间模式" : "☀️ 日间模式", "已切换");
      });
      overlay.querySelector("#nc-s-clear").addEventListener("click", () => { overlay.remove(); UI.showClearModal(); });
      overlay.querySelector("#nc-s-close").addEventListener("click", () => overlay.remove());
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      overlay.classList.add("active");
    },

    applyDarkMode: () => {
      if (State.darkMode) {
        UI.sidebar.classList.add("nc-dark");
      } else {
        UI.sidebar.classList.remove("nc-dark");
      }
    }
  };

  UI.init();
})();
