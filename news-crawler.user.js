// ==UserScript==
// @name         新闻爬取器
// @namespace    https://github.com/username/news-crawler
// @version      4.0.0
// @description  一键抓取新闻、生成日报、查看新闻
// @author       You
// @match        *://*/*
// @run-at       document-end
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_download
// @grant        GM_notification
// @grant        GM_addElement
// @grant        GM_addStyle
// @connect     *
// ==/UserScript==

(function () {
  "use strict";

  const STORE = "news_data";
  const FEEDS = [
    { name: "新浪新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1", t: "json" },
    { name: "腾讯新闻", url: "https://rss.qq.com/news.xml" },
    { name: "网易新闻", url: "https://news.163.com/special/rss/newsrdf.xml" },
    { name: "搜狐新闻", url: "https://www.sohu.com/rss/rss.xml" },
    { name: "知乎热榜", url: "https://www.zhihu.com/rss" },
    { name: "36氪", url: "https://36kr.com/feed" },
    { name: "虎嗅", url: "https://www.huxiu.com/rss/" },
    { name: "IT之家", url: "https://www.ithome.com/rss/" },
    { name: "观察者网", url: "https://www.guancha.cn/rss/" },
    { name: "澎湃新闻", url: "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2165&num=50&page=1", t: "json" },
  ];

  const PRIORITY = { "人民日报": 10, "新华网": 10, "央视新闻": 10, "澎湃新闻": 8, "观察者网": 8, "腾讯新闻": 6, "新浪新闻": 6, "网易新闻": 6, "知乎热榜": 7, "36氪": 7, "虎嗅": 7 };

  let panel, badge;

  function init() {
    GM_addStyle(`
      .nc{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
      .nc-fab{position:fixed;bottom:24px;left:24px;width:52px;height:52px;background:linear-gradient(135deg,#4a9eff,#6b5bff);border-radius:50%;box-shadow:0 4px 16px rgba(74,158,255,.4);cursor:pointer;z-index:2147483646;display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;transition:transform .2s}
      .nc-fab:hover{transform:scale(1.1)}
      .nc-badge{position:absolute;top:-4px;right:-4px;background:#ff4d4d;color:#fff;font-size:10px;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center}
      .nc-panel{position:fixed;bottom:86px;left:20px;width:360px;max-height:65vh;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:2147483647;display:none;flex-direction:column;overflow:hidden}
      .nc-panel.open{display:flex;animation:fadeIn .2s}
      @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .nc-header{padding:14px 16px;background:linear-gradient(135deg,#4a9eff,#6b5bff);color:#fff;display:flex;justify-content:space-between;align-items:center}
      .nc-header h3{margin:0;font-size:15px;font-weight:600}
      .nc-close{width:26px;height:26px;border:none;background:rgba(255,255,255,.2);border-radius:50%;cursor:pointer;color:#fff;font-size:16px}
      .nc-toolbar{padding:10px 14px;background:#fafafa;border-bottom:1px solid #eee;display:flex;gap:6px}
      .nc-btn{padding:5px 10px;font-size:12px;border:1px solid #ddd;background:#fff;border-radius:5px;cursor:pointer;color:#555}
      .nc-btn:hover{background:#f0f0f0}
      .nc-btnPri{background:#4a9eff;color:#fff;border-color:#4a9eff}
      .nc-btnPri:hover{background:#3a8eef}
      .nc-list{flex:1;overflow-y:auto;padding:6px 0}
      .nc-src{margin-bottom:10px}
      .nc-srcTitle{padding:6px 14px;font-size:11px;font-weight:600;color:#888;background:#f5f5f5}
      .nc-item{padding:10px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;font-size:13px;color:#333;line-height:1.4}
      .nc-item:hover{background:#f5f7ff}
      .nc-item:last-child{border-bottom:none}
      .nc-itemDate{font-size:10px;color:#aaa;margin-top:3px}
      .nc-empty{padding:30px;text-align:center;color:#999;font-size:13px}
      .nc-loading{text-align:center;padding:20px;color:#666;font-size:13px}
      .nc-footer{padding:8px 14px;background:#fafafa;border-top:1px solid #eee;font-size:10px;color:#bbb;text-align:center}
      .nc-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:10px;box-shadow:0 12px 48px rgba(0,0,0,.2);z-index:2147483648;padding:20px;width:280px;display:none}
      .nc-modal.show{display:block}
      .nc-modal h4{margin:0 0 12px;font-size:14px;color:#333}
      .nc-modal input{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:13px;margin-bottom:10px;box-sizing:border-box}
      .nc-modalBtns{display:flex;gap:8px;justify-content:flex-end}
      .nc-modal .nc-btn{width:60px;text-align:center}
      .nc-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);z-index:2147483647;display:none}
      .nc-overlay.show{display:block}
    `);

    badge = GM_addElement("span", { className: "nc-badge", textContent: "0" });
    const fab = GM_addElement("div", { className: "nc-fab", innerHTML: "📰" });
    fab.appendChild(badge);

    panel = GM_addElement("div", { className: "nc-panel" });
    panel.innerHTML = `
      <div class="nc-header"><h3>📰 新闻快报</h3><button class="nc-close">×</button></div>
      <div class="nc-toolbar">
        <button class="nc-btn nc-btnPri" id="fetch">🔄 抓取</button>
        <button class="nc-btn" id="report">📑 日报</button>
        <button class="nc-btn" id="setting">⚙️</button>
      </div>
      <div class="nc-list"><div class="nc-empty">点击「🔄 抓取」获取新闻</div></div>
      <div class="nc-footer">点击标题打开原文</div>
    `;
    document.body.appendChild(panel);
    document.body.appendChild(fab);

    fab.addEventListener("click", () => {
      panel.classList.toggle("open");
      if (panel.classList.contains("open")) refresh();
    });
    panel.querySelector(".nc-close").addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("#fetch").addEventListener("click", fetch);
    panel.querySelector("#report").addEventListener("click", report);
    panel.querySelector("#setting").addEventListener("click", setting);

    updateBadge();
  }

  function getData() { return GM_getValue(STORE) || []; }
  function saveData(arr) { GM_setValue(STORE, arr); }
  function getFolder() { return GM_getValue("news_folder") || "新闻日报"; }
  function setFolder(f) { GM_setValue("news_folder", f); }
  function fmt(d) { if (!d) return ""; try { const t = new Date(d); return isNaN(t.getTime()) ? d : t.toLocaleString("zh-CN"); } catch { return d; } }

  function refresh() {
    const data = getData();
    const list = panel.querySelector(".nc-list");
    if (!data.length) { list.innerHTML = '<div class="nc-empty">暂无新闻<br>点击「🔄 抓取」获取</div>'; badge.textContent = "0"; return; }
    const gp = {};
    data.forEach(i => { const k = i.s || "未知"; (gp[k] = gp[k] || []).push(i); });
    let h = "";
    Object.entries(gp).forEach(([k, arr]) => {
      h += `<div class="nc-src"><div class="nc-srcTitle">${k} (${arr.length})</div>`;
      arr.slice(0, 15).forEach(i => {
        const click = i.l ? `onclick="window.open('${i.l}','_blank')"` : "";
        h += `<div class="nc-item" ${click}><div>${i.t}</div><div class="nc-itemDate">${i.d || ""}</div></div>`;
      });
      if (arr.length > 15) h += `<div class="nc-item" style="text-align:center;color:#999;">还有 ${arr.length - 15} 条</div>`;
      h += "</div>";
    });
    list.innerHTML = h;
    badge.textContent = data.length > 99 ? "99+" : data.length;
  }

  function updateBadge() {
    const data = getData();
    badge.textContent = data.length > 99 ? "99+" : data.length;
  }

  function fetch() {
    const list = panel.querySelector(".nc-list");
    list.innerHTML = '<div class="nc-loading">🔄 抓取中...</div>';
    let ok = 0;
    const results = [];
    let idx = 0;
    function next() {
      if (idx >= FEEDS.length) {
        results.sort((a, b) => new Date(b.d) - new Date(a.d));
        saveData(results);
        GM_notification({ title: "抓取完成", text: `成功 ${ok}/${FEEDS.length} 个，共 ${results.length} 条`, silent: true });
        refresh();
        return;
      }
      const f = FEEDS[idx++];
      GM_xmlhttpRequest({
        method: "GET", url: f.url, timeout: 12000,
        onload: r => {
          try {
            if (f.t === "json") {
              const obj = JSON.parse(r.responseText);
              (obj.result?.data || obj.items || []).forEach(it => {
                const t = it.title || it.titleTxt || "";
                if (t) {
                  let ct = it.ctime;
                  if (ct) ct = ct > 1e12 ? ct : ct * 1000;
                  results.push({ t, l: it.url || it.link || "", d: fmt(ct) || fmt(it.pubDate), s: f.name });
                }
              });
            } else {
              const p = new DOMParser().parseFromString(r.responseText, "text/xml");
              if (!p.querySelector("parsererror")) {
                p.querySelectorAll("item, entry").forEach(it => {
                  const t = it.querySelector("title")?.textContent?.trim() || "";
                  const l = it.querySelector("link")?.getAttribute("href") || it.querySelector("link")?.textContent?.trim() || "";
                  const dd = it.querySelector("pubDate")?.textContent?.trim() || it.querySelector("published")?.textContent?.trim() || "";
                  if (t) results.push({ t, l, d: fmt(dd), s: f.name });
                });
              }
            }
            ok++;
          } catch (e) { console.warn(f.name, e); }
          next();
        },
        onerror: () => next(), ontimeout: () => next()
      });
    }
    next();
  }

  function report() {
    const data = getData();
    if (!data.length) { GM_notification({ title: "无新闻", text: "请先抓取", silent: true }); return; }
    const top = [...data].sort((a, b) => (PRIORITY[b.s] || 5) - (PRIORITY[a.s] || 5)).slice(0, 3);
    const dateStr = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
    let md = `# 📰 今日新闻日报\n\n> ${dateStr} | 共 ${data.length} 条\n\n---\n\n## 📌 重点新闻\n\n`;
    top.forEach((n, i) => { md += `${i + 1}. **${n.t}**\n- 来源: ${n.s} | ${n.d || "未知"}\n- 链接: ${n.l || "无"}\n\n`; });
    md += `---\n\n## 📋 全部新闻\n\n`;
    const gp = {}; data.forEach(i => { const k = i.s || "未知"; (gp[k] = gp[k] || []).push(i); });
    Object.entries(gp).forEach(([k, arr]) => {
      md += `### ${k} (${arr.length})\n\n`;
      arr.forEach(n => { md += `- [${n.t}](${n.l || "#"})${n.d ? ` *${n.d}*` : ""}\n`; });
      md += "\n";
    });
    md += `\n---\n*由新闻爬取器自动生成*\n`;
    download(md, `${getFolder()}/【${dateStr}】新闻日报.md`);
  }

  function setting() {
    const overlay = GM_addElement("div", { className: "nc-overlay" });
    const modal = GM_addElement("div", { className: "nc-modal" });
    modal.innerHTML = `
      <h4>⚙️ 设置</h4>
      <input type="text" id="folderInput" placeholder="下载文件夹名称" value="${getFolder()}">
      <div class="nc-modalBtns">
        <button class="nc-btn" id="cancelBtn">取消</button>
        <button class="nc-btn nc-btnPri" id="saveBtn">保存</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    overlay.classList.add("show");
    modal.classList.add("show");

    const close = () => { overlay.remove(); modal.remove(); };
    overlay.addEventListener("click", close);
    modal.querySelector("#cancelBtn").addEventListener("click", close);
    modal.querySelector("#saveBtn").addEventListener("click", () => {
      const val = modal.querySelector("#folderInput").value.trim();
      if (val) setFolder(val);
      GM_notification({ title: "已保存", text: `文件夹: ${val || "新闻日报"}`, silent: true });
      close();
    });
  }

  function download(content, name) {
    const b = new Blob([content], { type: "text/plain;charset=utf-8" });
    const u = URL.createObjectURL(b);
    GM_download({ url: u, name, saveAs: true, onload: () => { URL.revokeObjectURL(u); GM_notification({ title: "下载成功", text: name, silent: true }); }, onerror: () => GM_notification({ title: "下载失败", text: "请重试", silent: true }) });
  }

  init();
})();
