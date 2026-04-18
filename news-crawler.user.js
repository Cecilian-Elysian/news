// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      5.0.0
// @description  一键抓取新闻、查看日报
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

  const S = { "人民日报": 10, "新华网": 10, "央视新闻": 10, "澎湃新闻": 8, "观察者网": 8, "腾讯新闻": 6, "新浪新闻": 6, "网易新闻": 6, "知乎热榜": 7, "36氪": 7, "虎嗅": 7 };

  let panel, badge;

  function init() {
    GM_addStyle(`
      .nc{position:fixed;bottom:20px;left:20px;z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .nc-btn{width:50px;height:50px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 16px rgba(74,158,255,.4);display:flex;align-items:center;justify-content:center;color:#fff;transition:transform .2s}
      .nc-btn:hover{transform:scale(1.1)}
      .nc-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:10px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}
      .nc-panel{position:fixed;bottom:80px;left:16px;width:340px;max-height:60vh;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);display:none;flex-direction:column;overflow:hidden}
      .nc-panel.open{display:flex;animation:fadeIn .2s}
      @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:0}}
      .nc-head{padding:12px 14px;background:linear-gradient(135deg,#4a9eff,#6b5bff);color:#fff;display:flex;justify-content:space-between;align-items:center}
      .nc-head h3{margin:0;font-size:14px;font-weight:600}
      .nc-head button{width:24px;height:24px;background:rgba(255,255,255,.2);border:none;border-radius:50%;color:#fff;cursor:pointer;font-size:14px}
      .nc-btns{padding:8px 12px;background:#fafafa;border-bottom:1px solid #eee;display:flex;gap:6px}
      .nc-b{width:60px;height:30px;background:#fff;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:11px;color:#555}
      .nc-b:hover{background:#f0f0f0}
      .nc-b.pri{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-b.pri:hover{background:#3a8eef}
      .nc-list{flex:1;overflow-y:auto;padding:0}
      .nc-src{margin:0}
      .nc-src h4{padding:6px 12px;margin:0;font-size:11px;font-weight:600;color:#888;background:#f5f5f5}
      .nc-item{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:12px;cursor:pointer;color:#333;line-height:1.4}
      .nc-item:hover{background:#f5f7ff}
      .nc-item:last-child{border:none}
      .nc-item span{display:block;font-size:10px;color:#aaa;margin-top:2px}
      .nc-tip{padding:30px;text-align:center;color:#999;font-size:12px}
    `);

    badge = GM_addElement("span", { class: "nc-badge", textContent: "0" });
    const btn = GM_addElement("button", { class: "nc-btn", innerHTML: "📰" });
    btn.appendChild(badge);

    panel = GM_addElement("div", { class: "nc-panel" });
    panel.innerHTML = `
      <div class="nc-head"><h3>📰 新闻</h3><button id="close">×</button></div>
      <div class="nc-btns">
        <button class="nc-b pri" id="fetch">🔄抓取</button>
        <button class="nc-b" id="report">📑日报</button>
        <button class="nc-b" id="export">📥导出</button>
      </div>
      <div class="nc-list"><div class="nc-tip">点击「🔄抓取」获取新闻</div></div>
    `;
    document.body.appendChild(panel);
    document.body.appendChild(btn);

    btn.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) show();
    });
    panel.querySelector("#close").addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("#fetch").addEventListener("click", fetchNews);
    panel.querySelector("#report").addEventListener("click", makeReport);
    panel.querySelector("#export").addEventListener("click", exportMD);
  }

  function get() { return GM_getValue("news") || []; }
  function set(arr) { GM_setValue("news", arr); }
  function fmt(s) { if (!s) return ""; try { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("zh-CN"); } catch { return s; } }
  function folder() { return GM_getValue("folder") || "新闻日报"; }

  function show() {
    const list = panel.querySelector(".nc-list");
    const data = get();
    if (!data.length) { list.innerHTML = '<div class="nc-tip">暂无新闻<br>点击「🔄抓取」获取</div>'; badge.textContent = "0"; return; }
    const g = {};
    data.forEach(i => { (g[i.s] = g[i.s] || []).push(i); });
    let h = "";
    Object.keys(g).sort().forEach(k => {
      h += `<div class="nc-src"><h4>${k} (${g[k].length})</h4>`;
      g[k].slice(0, 10).forEach(i => {
        const l = i.l ? `onclick="window.open('${i.l}','_blank')"` : "";
        h += `<div class="nc-item" ${l}>${i.t}<span>${i.d || ""}</span></div>`;
      });
      if (g[k].length > 10) h += `<div class="nc-item" style="text-align:center;color:#999;">+${g[k].length - 10}更多</div>`;
      h += "</div>";
    });
    list.innerHTML = h;
    badge.textContent = data.length > 99 ? "99+" : data.length;
  }

  function fetchNews() {
    const list = panel.querySelector(".nc-list");
    list.innerHTML = '<div class="nc-tip">🔄 抓取中...</div>';
    const news = [];
    let idx = 0;
    function next() {
      if (idx >= FEEDS.length) {
        news.sort((a, b) => new Date(b.d) - new Date(a.d));
        GM_setValue("news", news);
        GM_notification({ title: "完成", text: `获取 ${news.length} 条新闻`, silent: true });
        show();
        return;
      }
      const f = FEEDS[idx++];
      GM_xmlhttpRequest({
        method: "GET", url: f.u, timeout: 10000,
        onload: r => {
          try {
            if (f.t === "j") {
              const d = JSON.parse(r.responseText);
              (d.result?.data || []).forEach(it => {
                if (it.title || it.titleTxt) {
                  let ct = it.ctime;
                  if (ct) ct = ct > 1e12 ? ct : ct * 1000;
                  news.push({ t: it.title || it.titleTxt, l: it.url || "", d: fmt(ct) || "", s: f.n });
                }
              });
            } else {
              const p = new DOMParser().parseFromString(r.responseText, "text/xml");
              if (!p.querySelector("parsererror")) {
                p.querySelectorAll("item, entry").forEach(it => {
                  const t = it.querySelector("title")?.textContent?.trim();
                  const l = it.querySelector("link")?.getAttribute("href") || it.querySelector("link")?.textContent?.trim() || "";
                  const dd = it.querySelector("pubDate")?.textContent?.trim() || it.querySelector("published")?.textContent?.trim() || "";
                  if (t) news.push({ t, l, d: fmt(dd), s: f.n });
                });
              }
            }
          } catch (e) { console.warn(f.n, e); }
          next();
        },
        onerror: () => next(), ontimeout: () => next()
      });
    }
    next();
  }

  function exportMD() {
    const d = get();
    if (!d.length) { GM_notification({ title: "无新闻", text: "请先抓取", silent: true }); return; }
    let m = `# 📰 新闻快报\n\n> ${new Date().toLocaleString()} | ${d.length}条\n\n---\n\n`;
    const g = {}; d.forEach(i => { (g[i.s] = g[i.s] || []).push(i); });
    Object.keys(g).forEach(k => {
      m += `## ${k}\n\n`;
      g[k].forEach(i => { m += `- [${i.t}](${i.l || "#"})${i.d ? ` - ${i.d}` : ""}\n`; });
      m += "\n";
    });
    download(m, `新闻_${new Date().toISOString().slice(0,10)}.md`);
  }

  function makeReport() {
    const d = get();
    if (!d.length) { GM_notification({ title: "无新闻", text: "请先抓取", silent: true }); return; }
    const top = [...d].sort((a, b) => (S[b.s] || 5) - (S[a.s] || 5)).slice(0, 3);
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
    download(m, `${folder()}/【${date}】日报.md`);
  }

  function download(c, n) {
    const b = new Blob([c], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    GM_download({ url: u, name: n, saveAs: true, onload: () => { URL.revokeObjectURL(u); GM_notification({ title: "下载成功", text: n, silent: true }); }, onerror: () => GM_notification({ title: "失败", text: "请重试", silent: true }) });
  }

  init();
})();
