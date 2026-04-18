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

  const FEEDS = [
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

  const P = { "人民日报": 10, "新华网": 10, "央视新闻": 10, "澎湃新闻": 8, "观察者网": 8, "腾讯新闻": 6, "新浪新闻": 6, "网易新闻": 6, "知乎热榜": 7, "36氪": 7, "虎嗅": 7 };

  let sidebar, opacity = GM_getValue("opacity", 90);

  function init() {
    GM_addStyle(`
      .nc-sidebar{position:fixed;top:0;right:0;width:280px;height:100vh;background:#fff;box-shadow:-2px 0 16px rgba(0,0,0,.1);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column}
      .nc-head{height:60px;padding:0 16px;background:linear-gradient(135deg,#4a9eff,#6b5bff);display:flex;align-items:center;justify-content:space-between}
      .nc-head h1{margin:0;font-size:16px;color:#fff;font-weight:600}
      .nc-head button{width:28px;height:28px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:14px}
      .nc-head button:hover{background:rgba(255,255,255,.3)}
      .nc-body{flex:1;overflow-y:auto;padding:12px}
      .nc-stat{padding:12px;background:#f5f7fa;border-radius:8px;margin-bottom:12px;font-size:12px;color:#666}
      .nc-stat div{margin:4px 0}
      .nc-stat span{font-weight:600;color:#333}
      .nc-btn{display:block;width:100%;padding:12px;margin-bottom:10px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:13px;color:#333;text-align:left;transition:all .2s}
      .nc-btn:hover{background:#f5f7ff;border-color:#4a9eff}
      .nc-btn.primary{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-btn.primary:hover{background:#3a8eef}
      .nc-btn:active{transform:scale(.98)}
      .nc-status{padding:10px;background:#f0f7ff;border-radius:6px;font-size:11px;color:#666;margin-bottom:12px}
      .nc-list{border-top:1px solid #eee;padding-top:12px;flex:1;overflow-y:auto}
      .nc-list h3{font-size:12px;color:#888;margin:0 0 8px;font-weight:500}
      .nc-item{padding:8px;border-bottom:1px solid #f5f5f5;font-size:12px;cursor:pointer}
      .nc-item:hover{background:#f5f7ff}
      .nc-item:last-child{border:none}
      .nc-item-title{color:#333;line-height:1.4;margin-bottom:2px}
      .nc-item-src{font-size:10px;color:#aaa}
      .nc-group{margin-bottom:12px}
      .nc-group-title{padding:6px 8px;background:#f5f5f5;font-size:11px;font-weight:600;color:#666;border-radius:4px;margin-bottom:4px}
    `);

    sidebar = GM_addElement("div", { class: "nc-sidebar" });
    sidebar.innerHTML = `
      <div class="nc-head">
        <h1>📰 新闻日报</h1>
        <div style="display:flex;gap:6px">
          <button id="op-minus" style="width:22px;height:22px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:12px">-</button>
          <span id="op-text" style="color:#fff;font-size:11px;min-width:36px;text-align:center">90%</span>
          <button id="op-plus" style="width:22px;height:22px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:12px">+</button>
          <button id="close" style="width:22px;height:22px;border:none;background:rgba(255,255,255,.2);border-radius:50%;color:#fff;cursor:pointer;font-size:12px">×</button>
        </div>
      </div>
      <div class="nc-body">
        <div class="nc-status" id="status">点击按钮开始</div>
        <div class="nc-stat" id="stat">
          <div>新闻条数: <span id="count">0</span></div>
          <div>来源数量: <span id="sources">0</span></div>
          <div>最后更新: <span id="time">-</span></div>
          <div>导出文件夹: <span id="folderDisplay">新闻日报</span> <button id="editFolderBtn" style="font-size:10px;padding:2px 6px;background:#4a9eff;color:#fff;border:none;border-radius:4px;cursor:pointer">修改</button></div>
        </div>
        <button class="nc-btn primary" id="start">🚀 一键抓取并生成日报</button>
        <button class="nc-btn" id="fetchOnly">🔄 仅抓取新闻</button>
        <button class="nc-btn" id="reportOnly">📑 仅生成日报</button>
        <button class="nc-btn" id="addFeed">➕ 添加新闻源</button>
        <div class="nc-list">
          <h3>📋 最新新闻</h3>
          <div id="newsList">
            <div style="color:#999;font-size:12px;text-align:center;padding:20px">暂无新闻</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);

    sidebar.querySelector("#close").onclick = () => sidebar.style.display = "none";
    sidebar.querySelector("#start").onclick = startAll;
    sidebar.querySelector("#fetchOnly").onclick = fetchNews;
    sidebar.querySelector("#reportOnly").onclick = makeReport;
    sidebar.querySelector("#op-minus").onclick = () => changeOpacity(-10);
    sidebar.querySelector("#op-plus").onclick = () => changeOpacity(10);
    sidebar.querySelector("#editFolderBtn").onclick = editFolder;
    sidebar.querySelector("#addFeed").onclick = addFeed;

    const floatBtn = GM_addElement("div", {
      style: "position:fixed;bottom:20px;right:20px;width:48px;height:48px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;box-shadow:0 4px 16px rgba(74,158,255,.4);cursor:pointer;z-index:2147483645;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff",
      innerHTML: "📰"
    });
    floatBtn.onclick = () => sidebar.style.display = sidebar.style.display === "none" ? "flex" : "none";
    document.body.appendChild(floatBtn);

    updateStat();
    updateFolderDisplay();
    sidebar.style.background = `rgba(255,255,255,${opacity/100})`;
    sidebar.querySelector("#op-text").textContent = opacity + "%";
    GM_notification({ title: "📰 新闻日报已就绪", text: "点击按钮开始抓取", silent: true });
  }

  function get() { return GM_getValue("news") || []; }
  function set(arr) { GM_setValue("news", arr); }
  function folder() { return GM_getValue("folder") || "新闻日报"; }
  function fmt(s) { if (!s) return ""; try { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN"); } catch { return s; } }

  function changeOpacity(delta) {
    opacity = Math.max(30, Math.min(100, opacity + delta));
    sidebar.style.background = `rgba(255,255,255,${opacity/100})`;
    sidebar.querySelector("#op-text").textContent = opacity + "%";
    GM_setValue("opacity", opacity);
  }

  function updateFolderDisplay() {
    sidebar.querySelector("#folderDisplay").textContent = folder();
  }

  function editFolder() {
    const newFolder = prompt("请输入导出文件夹路径:\n(例如: D:\\新闻日报 或 /Users/新闻日报)", folder());
    if (newFolder && newFolder.trim()) {
      GM_setValue("folder", newFolder.trim());
      updateFolderDisplay();
      GM_notification({ title: "已保存", text: `导出路径: ${newFolder.trim()}`, silent: true });
    }
  }

  function getCustomFeeds() { return GM_getValue("custom_feeds") || []; }
  function saveCustomFeeds(arr) { GM_setValue("custom_feeds", arr); }

  function addFeed() {
    const name = prompt("请输入新闻源名称:");
    if (!name || !name.trim()) return;
    const url = prompt("请输入订阅地址:\n- RSS: https://example.com/rss.xml\n- 网页: https://example.com/news.html");
    if (!url || !url.trim()) return;
    const type = prompt("类型:\n1 - RSS/XML (默认)\n2 - JSON\n3 - 网页URL") || "1";
    let t = "";
    if (type === "2") t = "j";
    else if (type === "3") t = "w";
    const feeds = getCustomFeeds();
    feeds.push({ n: name.trim(), u: url.trim(), t });
    saveCustomFeeds(feeds);
    GM_notification({ title: "已添加", text: `${name.trim()} 已添加到自定义源`, silent: true });
  }

  function getAllFeeds() {
    const custom = getCustomFeeds();
    return [...FEEDS, ...custom];
  }

  function setStatus(s) { sidebar.querySelector("#status").textContent = s; }
  function setCount(n) { sidebar.querySelector("#count").textContent = n; }
  function setSources(n) { sidebar.querySelector("#sources").textContent = n; }
  function setTime(s) { sidebar.querySelector("#time").textContent = s || "-"; }

  function updateStat() {
    const d = get();
    setCount(d.length);
    const g = {};
    d.forEach(i => g[i.s] = 1);
    setSources(Object.keys(g).length);
    const st = GM_getValue("news_time");
    setTime(st ? fmt(st) : "-");
  }

  function updateList() {
    const d = get();
    const el = sidebar.querySelector("#newsList");
    if (!d.length) {
      el.innerHTML = '<div style="color:#999;font-size:12px;text-align:center;padding:20px">暂无新闻</div>';
      return;
    }
    const g = {};
    d.forEach(i => { (g[i.s] = g[i.s] || []).push(i); });
    let h = "";
    Object.keys(g).sort().forEach(src => {
      h += `<div class="nc-group"><div class="nc-group-title">${src} (${g[src].length})</div>`;
      g[src].forEach(i => {
        h += `<div class="nc-item" onclick="window.open('${i.l || "#"}','_blank')"><div class="nc-item-title">${i.t}</div><div class="nc-item-src">${i.d || ""}</div></div>`;
      });
      h += "</div>";
    });
    el.innerHTML = h;
  }

  async function fetchNews() {
    setStatus("🔄 抓取中...");
    const news = [];
    let ok = 0;
    const allFeeds = getAllFeeds();
    for (const f of allFeeds) {
      try {
        const r = await req(f.u);
        if (f.t === "j") {
          const d = JSON.parse(r);
          (d.result?.data || []).forEach(it => {
            if (it.title || it.titleTxt) {
              let ct = it.ctime;
              if (ct) ct = ct > 1e12 ? ct : ct * 1000;
              news.push({ t: it.title || it.titleTxt, l: it.url || "", d: fmt(ct) || fmt(it.pubDate), s: f.n });
            }
          });
        } else if (f.t === "w") {
          const p = new DOMParser().parseFromString(r, "text/html");
          const items = p.querySelectorAll("a[href]");
          items.forEach(it => {
            const t = it.textContent?.trim() || "";
            const l = it.getAttribute("href") || "";
            if (t && l && t.length > 5 && l.startsWith("http")) {
              news.push({ t: t.substring(0, 100), l, d: fmt(Date.now()), s: f.n });
            }
          });
        } else {
          const p = new DOMParser().parseFromString(r, "text/xml");
          if (!p.querySelector("parsererror")) {
            p.querySelectorAll("item, entry").forEach(it => {
              const t = it.querySelector("title")?.textContent?.trim();
              const l = it.querySelector("link")?.getAttribute("href") || it.querySelector("link")?.textContent?.trim() || "";
              const dd = it.querySelector("pubDate")?.textContent?.trim() || it.querySelector("published")?.textContent?.trim() || "";
              if (t) news.push({ t, l, d: fmt(dd), s: f.n });
            });
          }
        }
        ok++;
      } catch (e) { console.warn(f.n, e); }
    }
    news.sort((a, b) => new Date(b.d) - new Date(a.d));
    set(news);
    GM_setValue("news_time", Date.now());
    updateStat();
    updateList();
    setStatus(`✅ 抓取完成: ${ok}/${allFeeds.length}个源, ${news.length}条`);
    GM_notification({ title: "抓取完成", text: `获取 ${news.length} 条新闻`, silent: true });
  }

  async function makeReport() {
    const d = get();
    if (!d.length) { setStatus("⚠️ 请先抓取新闻"); GM_notification({ title: "无新闻", text: "请先抓取", silent: true }); return; }
    setStatus("📑 生成日报...");
    const top = [...d].sort((a, b) => (P[b.s] || 5) - (P[a.s] || 5)).slice(0, 3);
    const date = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    let m = `# 📰 今日新闻日报\n\n> ${date} | 共${d.length}条\n\n---\n\n## 📌 重点\n\n`;
    top.forEach((n, i) => { m += `${i+1}. **${n.t}**\n- ${n.s} | ${n.d || ""}\n\n`; });
    m += "---\n\n## 📋 全部\n\n";
    const g = {}; d.forEach(i => { (g[i.s] = g[i.s] || []).push(i); });
    Object.keys(g).forEach(k => {
      m += `### ${k} (${g[k].length})\n\n`;
      g[k].forEach(n => { m += `- [${n.t}](${n.l || "#"})\n`; });
      m += "\n";
    });
    m += "\n---\n*新闻爬取器*\n";
    const name = `${folder()}/【${date}】日报.md`;
    download(m, name);
    setStatus(`✅ 日报已导出: ${name}`);
  }

  async function startAll() {
    setStatus("🚀 开始一键抓取...");
    await fetchNews();
    await makeReport();
    setStatus("✅ 全部完成!");
  }

  function req(url) {
    return new Promise((ok, fail) => {
      GM_xmlhttpRequest({ method: "GET", url, timeout: 12000, onload: r => r.status >= 200 && r.status < 300 ? ok(r.responseText) : fail(new Error(r.status)), onerror: fail, ontimeout: fail });
    });
  }

  function download(c, n) {
    const b = new Blob([c], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    GM_download({ url: u, name: n, saveAs: true, onload: () => { URL.revokeObjectURL(u); GM_notification({ title: "导出成功", text: n, silent: true }); }, onerror: () => GM_notification({ title: "导出失败", text: "请重试", silent: true }) });
  }

  init();
})();
