// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      1.0.0
// @description  一键抓取新闻、自动生成日报并导出
// @author       You
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

  const DEFAULT_FEEDS = [
    { n: "新浪新闻", u: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", t: "j" },
    { n: "腾讯新闻", u: "https://rss.qq.com/news.xml" },
    { n: "网易新闻", u: "https://news.163.com/special/rss/newsrdf.xml" },
    { n: "搜狐新闻", u: "https://www.sohu.com/rss/rss.xml" },
    { n: "知乎热榜", u: "https://www.zhihu.com/rss" },
    { n: "36氪", u: "https://36kr.com/feed" },
    { n: "虎嗅", u: "https://www.huxiu.com/rss/" },
    { n: "IT之家", u: "https://www.ithome.com/rss/" },
    { n: "观察者网", u: "https://www.guancha.cn/rss/" },
    { n: "澎湃新闻", u: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", t: "j" },
  ];

  const PRIORITY = {
    "人民日报": 10, "新华网": 10, "央视新闻": 10, "澎湃新闻": 8, "观察者网": 8,
    "腾讯新闻": 6, "新浪新闻": 6, "网易新闻": 6, "知乎热榜": 7, "36氪": 7, "虎嗅": 7
  };

  let sidebar, opacity = GM_getValue("opacity", 90);

  function init() {
    GM_addStyle(`
      .nc-sidebar{position:fixed;top:0;right:0;width:280px;height:100vh;background:#fff;box-shadow:-2px 0 16px rgba(0,0,0,.1);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
      .nc-head{height:60px;padding:0 16px;background:linear-gradient(135deg,#4a9eff,#6b5bff);display:flex;align-items:center;justify-content:space-between}
      .nc-head h1{margin:0;font-size:16px;color:#fff;font-weight:600}
      .nc-head-actions{display:flex;gap:6px}
      .nc-head-actions button{width:24px;height:24px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:12px}
      .nc-head-actions button:hover{background:rgba(255,255,255,.3)}
      .nc-body{flex:1;overflow-y:auto;padding:12px}
      .nc-stat{padding:12px;background:#f5f7fa;border-radius:8px;margin-bottom:12px;font-size:12px;color:#666}
      .nc-stat-row{display:flex;justify-content:space-between;margin:4px 0}
      .nc-stat-label{color:#888}
      .nc-stat-value{font-weight:600;color:#333}
      .nc-btn{display:block;width:100%;padding:12px;margin-bottom:10px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:13px;color:#333;text-align:left;transition:all .2s}
      .nc-btn:hover{background:#f5f7ff;border-color:#4a9eff}
      .nc-btn.primary{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-btn.primary:hover{background:#3a8eef}
      .nc-btn:active{transform:scale(.98)}
      .nc-status{padding:10px;background:#f0f7ff;border-radius:6px;font-size:11px;color:#666;margin-bottom:12px;text-align:center}
      .nc-list-section{border-top:1px solid #eee;padding-top:12px;flex:1;overflow-y:auto}
      .nc-list-title{font-size:12px;color:#888;margin:0 0 8px;font-weight:500}
      .nc-group{margin-bottom:12px}
      .nc-group-title{padding:6px 8px;background:#f5f5f5;font-size:11px;font-weight:600;color:#666;border-radius:4px;margin-bottom:4px}
      .nc-item{padding:8px;border-bottom:1px solid #f5f5f5;font-size:12px;cursor:pointer;color:#333}
      .nc-item:hover{background:#f5f7ff}
      .nc-item:last-child{border:none}
      .nc-item-title{line-height:1.4;margin-bottom:2px}
      .nc-item-date{font-size:10px;color:#aaa}
      .nc-empty{text-align:center;color:#999;font-size:12px;padding:30px 0}
    `);

    sidebar = GM_addElement("div", { class: "nc-sidebar" });
    sidebar.innerHTML = `
      <div class="nc-head">
        <h1>📰 新闻日报</h1>
        <div class="nc-head-actions">
          <button id="op-minus" title="透明度减少">-</button>
          <span id="op-text" style="color:#fff;font-size:11px;min-width:32px;text-align:center">${opacity}%</span>
          <button id="op-plus" title="透明度增加">+</button>
          <button id="close" title="关闭">×</button>
        </div>
      </div>
      <div class="nc-body">
        <div class="nc-stat">
          <div class="nc-stat-row"><span class="nc-stat-label">新闻条数</span><span class="nc-stat-value" id="count">0</span></div>
          <div class="nc-stat-row"><span class="nc-stat-label">来源数量</span><span class="nc-stat-value" id="sources">0</span></div>
          <div class="nc-stat-row"><span class="nc-stat-label">最后更新</span><span class="nc-stat-value" id="time">-</span></div>
          <div class="nc-stat-row"><span class="nc-stat-label">导出位置</span><span class="nc-stat-value" id="folderDisplay">新闻日报</span></div>
        </div>
        <button class="nc-btn primary" id="start">🚀 一键抓取并生成日报</button>
        <button class="nc-btn" id="fetchOnly">🔄 仅抓取新闻</button>
        <button class="nc-btn" id="reportOnly">📑 仅生成日报</button>
        <button class="nc-btn" id="addFeed">➕ 添加新闻源</button>
        <button class="nc-btn" id="editFolder">📁 修改导出位置</button>
        <div class="nc-list-section">
          <h3 class="nc-list-title">📋 最新新闻</h3>
          <div id="newsList"><div class="nc-empty">暂无新闻</div></div>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    sidebar.querySelector("#close").onclick = () => sidebar.style.display = "none";
    sidebar.querySelector("#start").onclick = startAll;
    sidebar.querySelector("#fetchOnly").onclick = fetchNews;
    sidebar.querySelector("#reportOnly").onclick = makeReport;
    sidebar.querySelector("#addFeed").onclick = addFeed;
    sidebar.querySelector("#editFolder").onclick = editFolder;
    sidebar.querySelector("#op-minus").onclick = () => changeOpacity(-10);
    sidebar.querySelector("#op-plus").onclick = () => changeOpacity(10);

    const floatBtn = GM_addElement("div", {
      style: "position:fixed;bottom:20px;right:20px;width:48px;height:48px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;box-shadow:0 4px 16px rgba(74,158,255,.4);cursor:pointer;z-index:2147483645;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff",
      innerHTML: "📰"
    });
    floatBtn.onclick = () => sidebar.style.display = sidebar.style.display === "none" ? "flex" : "none";
    document.body.appendChild(floatBtn);

    updateStat();
    updateFolderDisplay();
    sidebar.style.background = `rgba(255,255,255,${opacity / 100})`;
    GM_notification({ title: "📰 新闻日报已就绪", text: "点击按钮开始抓取", silent: true });
  }

  function getNews() { return GM_getValue("news") || []; }
  function setNews(arr) { GM_setValue("news", arr); }
  function getFolder() { return GM_getValue("folder") || "新闻日报"; }
  function getCustomFeeds() { return GM_getValue("custom_feeds") || []; }
  function saveCustomFeeds(arr) { GM_setValue("custom_feeds", arr); }

  function formatDate(s) {
    if (!s) return "";
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN");
    } catch { return s; }
  }

  function changeOpacity(delta) {
    opacity = Math.max(30, Math.min(100, opacity + delta));
    sidebar.style.background = `rgba(255,255,255,${opacity / 100})`;
    sidebar.querySelector("#op-text").textContent = opacity + "%";
    GM_setValue("opacity", opacity);
  }

  function updateFolderDisplay() {
    sidebar.querySelector("#folderDisplay").textContent = getFolder();
  }

  function updateStat() {
    const news = getNews();
    sidebar.querySelector("#count").textContent = news.length;
    const sources = {};
    news.forEach(i => sources[i.s] = 1);
    sidebar.querySelector("#sources").textContent = Object.keys(sources).length;
    const lastTime = GM_getValue("news_time");
    sidebar.querySelector("#time").textContent = lastTime ? formatDate(lastTime) : "-";
  }

  function updateList() {
    const news = getNews();
    const el = sidebar.querySelector("#newsList");
    if (!news.length) {
      el.innerHTML = '<div class="nc-empty">暂无新闻</div>';
      return;
    }
    const grouped = {};
    news.forEach(i => { (grouped[i.s] = grouped[i.s] || []).push(i); });
    let html = "";
    Object.keys(grouped).sort().forEach(src => {
      html += `<div class="nc-group"><div class="nc-group-title">${src} (${grouped[src].length})</div>`;
      grouped[src].forEach(i => {
        const click = i.l ? `onclick="window.open('${i.l}','_blank')"` : "";
        html += `<div class="nc-item" ${click}><div class="nc-item-title">${i.t}</div><div class="nc-item-date">${i.d || ""}</div></div>`;
      });
      html += "</div>";
    });
    el.innerHTML = html;
  }

  function setStatus(s) { sidebar.querySelector(".nc-status").textContent = s; }

  function httpReq(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "GET",
        url: url,
        timeout: 12000,
        onload: (r) => {
          if (r.status >= 200 && r.status < 300) resolve(r.responseText);
          else reject(new Error("HTTP " + r.status));
        },
        onerror: () => reject(new Error("请求失败")),
        ontimeout: () => reject(new Error("请求超时"))
      });
    });
  }

  async function fetchNews() {
    setStatus("🔄 抓取中...");
    const news = [];
    let okCount = 0;
    const allFeeds = [...DEFAULT_FEEDS, ...getCustomFeeds()];

    for (const feed of allFeeds) {
      try {
        const data = await httpReq(feed.u);
        if (feed.t === "j") {
          const json = JSON.parse(data);
          (json.result?.data || []).forEach(item => {
            if (item.title || item.titleTxt) {
              let ct = item.ctime;
              if (ct) ct = ct > 1e12 ? ct : ct * 1000;
              news.push({ t: item.title || item.titleTxt, l: item.url || "", d: formatDate(ct) || formatDate(item.pubDate), s: feed.n });
            }
          });
        } else if (feed.t === "w") {
          const p = new DOMParser().parseFromString(data, "text/html");
          p.querySelectorAll("a[href]").forEach(a => {
            const t = a.textContent?.trim() || "";
            const l = a.getAttribute("href") || "";
            if (t && t.length > 5 && l.startsWith("http")) {
              news.push({ t: t.substring(0, 100), l, d: formatDate(Date.now()), s: feed.n });
            }
          });
        } else {
          const p = new DOMParser().parseFromString(data, "text/xml");
          if (!p.querySelector("parsererror")) {
            p.querySelectorAll("item, entry").forEach(item => {
              const t = item.querySelector("title")?.textContent?.trim();
              const l = item.querySelector("link")?.getAttribute("href") || item.querySelector("link")?.textContent?.trim() || "";
              const dd = item.querySelector("pubDate, published")?.textContent?.trim() || "";
              if (t) news.push({ t, l, d: formatDate(dd), s: feed.n });
            });
          }
        }
        okCount++;
      } catch (e) { console.warn(feed.n, e); }
    }

    news.sort((a, b) => new Date(b.d) - new Date(a.d));
    setNews(news);
    GM_setValue("news_time", Date.now());
    updateStat();
    updateList();
    setStatus(`✅ 抓取完成: ${okCount}/${allFeeds.length}个源, ${news.length}条`);
    GM_notification({ title: "抓取完成", text: `获取 ${news.length} 条新闻`, silent: true });
  }

  async function makeReport() {
    const news = getNews();
    if (!news.length) {
      setStatus("⚠️ 请先抓取新闻");
      GM_notification({ title: "无新闻", text: "请先抓取", silent: true });
      return;
    }
    setStatus("📑 生成日报...");

    const top = [...news].sort((a, b) => (PRIORITY[b.s] || 5) - (PRIORITY[a.s] || 5)).slice(0, 3);
    const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

    let md = `# 📰 今日新闻日报\n\n> ${dateStr} | 共${news.length}条\n\n---\n\n## 📌 重点\n\n`;
    top.forEach((n, i) => { md += `${i + 1}. **${n.t}**\n- ${n.s} | ${n.d || ""}\n\n`; });
    md += "---\n\n## 📋 全部\n\n";

    const grouped = {};
    news.forEach(i => { (grouped[i.s] = grouped[i.s] || []).push(i); });
    Object.keys(grouped).forEach(k => {
      md += `### ${k} (${grouped[k].length})\n\n`;
      grouped[k].forEach(n => { md += `- [${n.t}](${n.l || "#"})\n`; });
      md += "\n";
    });
    md += "\n---\n*由新闻爬取器生成*\n";

    const fileName = `${getFolder()}/【${dateStr}】日报.md`;
    download(md, fileName);
    setStatus(`✅ 日报已导出`);
  }

  async function startAll() {
    setStatus("🚀 开始一键抓取...");
    await fetchNews();
    await makeReport();
    setStatus("✅ 全部完成!");
  }

  function addFeed() {
    const name = prompt("请输入新闻源名称:");
    if (!name?.trim()) return;
    const url = prompt("请输入订阅地址:\n- RSS: https://example.com/rss.xml\n- 网页: https://example.com/news.html");
    if (!url?.trim()) return;
    const type = prompt("类型:\n1 - RSS/XML (默认)\n2 - JSON\n3 - 网页URL") || "1";
    let t = "";
    if (type === "2") t = "j";
    else if (type === "3") t = "w";
    const feeds = getCustomFeeds();
    feeds.push({ n: name.trim(), u: url.trim(), t });
    saveCustomFeeds(feeds);
    GM_notification({ title: "已添加", text: `${name.trim()} 已添加到自定义源`, silent: true });
  }

  function editFolder() {
    const newFolder = prompt("请输入导出文件夹路径:", getFolder());
    if (newFolder?.trim()) {
      GM_setValue("folder", newFolder.trim());
      updateFolderDisplay();
      GM_notification({ title: "已保存", text: `导出路径: ${newFolder.trim()}`, silent: true });
    }
  }

  function download(content, fileName) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    GM_download({
      url: url,
      name: fileName,
      saveAs: true,
      onload: () => {
        URL.revokeObjectURL(url);
        GM_notification({ title: "下载成功", text: fileName, silent: true });
      },
      onerror: () => GM_notification({ title: "下载失败", text: "请重试", silent: true })
    });
  }

  init();
})();
