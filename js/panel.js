const FOLDER_KEY = "rakupochi_download_folder";
const HOME_URL   = "https://rakupochi-illust.com";

var tabs       = {};
var tabOrder   = [];
var activeId   = null;
var tabCounter = 0;
var PROXY_PORT = null;   // 起動後に確定

// ===== 起動 =====
(function init() {
  var saved = localStorage.getItem(FOLDER_KEY);
  if (saved) updateFolderDisplay(saved);

  startProxy(function(port) {
    PROXY_PORT = port;
    createTab(HOME_URL, "ラクポチ イラスト");
  });

  window.addEventListener("message", function(e) {
    if (!e.data) return;
    if (e.data.type === "openTab") {
      createTab(e.data.url || HOME_URL, e.data.title || "");
    }
    if (e.data.type === "downloadFile") {
      downloadFileWithNode(e.data.url, e.data.filename || "");
    }
  });
})();

function setProxyStatus(msg) {
  var el = document.getElementById("proxy-status");
  if (el) el.innerHTML = msg;
}

// ===== プロキシサーバー =====
function startProxy(onReady) {
  // Node.js が使えるか確認
  if (typeof require === "undefined") {
    setProxyStatus("❌ Node.js 未対応<br>manifest に --enable-nodejs が必要です");
    PROXY_PORT = null;
    createTab(HOME_URL, "ラクポチ イラスト");
    return;
  }

  try {
    var http   = require("http");
    var https  = require("https");
    var urlMod = require("url");

    // サイトの HTML に注入するスクリプト：download リンクをインターセプト
    var INJECT = [
      '<script>(function(){',
      'document.addEventListener("click",function(e){',
      '  var a=e.target;',
      '  while(a&&a.tagName!=="A")a=a.parentElement;',
      '  if(!a)return;',
      '  var href=a.href||"";',
      '  var isDl=a.hasAttribute("download")||',
      '    href.match(/\\.(png|jpg|jpeg|gif|svg|webp|zip|eps|ai)(\\?|#|$)/i);',
      '  if(isDl&&href&&href.startsWith("http")){',
      '    e.preventDefault();e.stopPropagation();',
      '    window.top.postMessage({type:"downloadFile",url:href,filename:a.download||""},"*");',
      '  }',
      '},true);',
      '})();<\/script>'
    ].join("");

    var server = http.createServer(function(req, res) {
      var parsed    = urlMod.parse(req.url, true);
      var targetUrl = decodeURIComponent(parsed.query.url || "");
      if (!targetUrl) { res.writeHead(400); res.end("Missing url"); return; }

      var target = urlMod.parse(targetUrl);
      var origin = target.protocol + "//" + target.host;
      var client = target.protocol === "https:" ? https : http;

      var opts = {
        hostname: target.hostname,
        port:     target.port || (target.protocol === "https:" ? 443 : 80),
        path:     target.path || "/",
        method:   "GET",
        headers: {
          "User-Agent":      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          "Accept":          "text/html,application/xhtml+xml,*/*;q=0.9",
          "Accept-Language": "ja,en;q=0.9"
        },
        rejectUnauthorized: false
      };

      var proxyReq = client.request(opts, function(proxyRes) {
        // リダイレクト
        if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
          var loc = proxyRes.headers.location;
          if (!loc.startsWith("http")) loc = origin + (loc.startsWith("/") ? loc : "/" + loc);
          res.writeHead(302, { "Location": "/?url=" + encodeURIComponent(loc) });
          res.end(); return;
        }

        var ct = proxyRes.headers["content-type"] || "";

        if (ct.includes("text/html")) {
          var chunks = [];
          proxyRes.on("data", function(c) { chunks.push(c); });
          proxyRes.on("end", function() {
            var html = Buffer.concat(chunks).toString("utf8");
            // base タグで相対URLを解決 + download インターセプタを注入
            if (!html.includes("<base")) {
              html = html.replace(/(<head[^>]*>)/i, '$1<base href="' + origin + '/">');
            }
            html = html.replace("</body>", INJECT + "</body>");
            if (!html.includes("</body>")) html += INJECT;
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Access-Control-Allow-Origin": "*"
            });
            res.end(html);
          });
        } else {
          // HTML 以外はそのまま通過（CSP・X-Frame-Options は除去）
          var headers = {};
          Object.keys(proxyRes.headers).forEach(function(k) {
            if (k !== "content-security-policy" && k !== "x-frame-options") {
              headers[k] = proxyRes.headers[k];
            }
          });
          headers["access-control-allow-origin"] = "*";
          res.writeHead(proxyRes.statusCode, headers);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on("error", function(e) {
        res.writeHead(502); res.end("Proxy error: " + e.message);
      });
      proxyReq.end();
    });

    server.listen(0, "127.0.0.1", function() {
      var port = server.address().port;
      setProxyStatus(
        "✅ Node.js: 有効<br>" +
        "✅ プロキシ: ポート " + port + " で起動中<br>" +
        "✅ ダウンロード: 各サイトのボタンで保存可能"
      );
      onReady(port);
    });

    server.on("error", function(e) {
      setProxyStatus("❌ プロキシ起動失敗: " + e.message);
      PROXY_PORT = null;
      createTab(HOME_URL, "ラクポチ イラスト");
    });

  } catch(e) {
    setProxyStatus("❌ エラー: " + e.message);
    PROXY_PORT = null;
    createTab(HOME_URL, "ラクポチ イラスト");
  }
}

// ===== プロキシ URL を生成 =====
function proxyUrl(url) {
  if (!PROXY_PORT) return url;
  if (!url || url.startsWith("http://127.0.0.1") || url === HOME_URL) return url;
  return "http://127.0.0.1:" + PROXY_PORT + "/?url=" + encodeURIComponent(url);
}

// ===== Node.js でファイルを保存 =====
function downloadFileWithNode(fileUrl, hint) {
  var folder = localStorage.getItem(FOLDER_KEY);
  if (!folder) { showToast("⚙️ 設定でフォルダを指定してください", "warn"); return; }

  try {
    var https  = require("https");
    var http   = require("http");
    var fs     = require("fs");
    var path   = require("path");
    var urlMod = require("url");

    var parsed = urlMod.parse(fileUrl);
    var client = parsed.protocol === "https:" ? https : http;
    var ext    = (path.extname(parsed.pathname) || ".png").split("?")[0].toLowerCase();
    var base   = hint || path.basename(parsed.pathname, ext) || "illust";
    base = base.replace(/[\\/:*?"<>|]/g, "_").slice(0, 50);
    var sep    = (folder.endsWith("/") || folder.endsWith("\\")) ? "" : "/";
    var dest   = folder + sep + base + "_" + Date.now() + ext;

    showToast("⬇️ ダウンロード中...", "info");

    var file = fs.createWriteStream(dest);
    client.get(fileUrl, { headers: { "User-Agent": "Mozilla/5.0", "Referer": fileUrl } }, function(res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(dest, function(){});
        downloadFileWithNode(res.headers.location, hint);
        return;
      }
      res.pipe(file);
      file.on("finish", function() {
        file.close();
        showToast("✅ 保存: " + path.basename(dest), "ok");
      });
    }).on("error", function(e) {
      fs.unlink(dest, function(){});
      showToast("❌ " + e.message, "error");
    });
  } catch(e) {
    showToast("❌ Node.js エラー: " + e.message, "error");
  }
}

// ===== トースト =====
function showToast(msg, type) {
  var el = document.getElementById("dl-toast");
  el.style.background =
    type === "ok"    ? "rgba(34,197,94,0.93)"  :
    type === "warn"  ? "rgba(234,179,8,0.93)"   :
    type === "error" ? "rgba(239,68,68,0.93)"   :
                       "rgba(100,116,139,0.93)";
  el.textContent   = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.opacity = "0"; }, 3000);
}

// ===== タブ作成 =====
function createTab(url, title) {
  var id = "t" + (++tabCounter);
  var loadUrl = proxyUrl(url);

  var container = document.getElementById("iframe-container");
  var iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;top:0;left:0;border:none;display:none;";
  iframe.style.width  = (container.offsetWidth  || 400) + "px";
  iframe.style.height = (container.offsetHeight || 600) + "px";
  iframe.src = loadUrl;
  container.appendChild(iframe);

  tabs[id] = { id: id, iframe: iframe, history: [url], proxyHistory: [loadUrl], histIdx: 0, title: title || labelFromUrl(url) };
  tabOrder.push(id);
  renderTabs();
  switchTab(id);
}

// ===== タブ切替 =====
function switchTab(id) {
  if (!tabs[id]) return;
  document.getElementById("settings-panel").classList.remove("active");
  Object.keys(tabs).forEach(function(k) {
    tabs[k].iframe.style.display = (k === id) ? "block" : "none";
  });
  activeId = id;
  renderTabs();
  syncNavBar();
}

// ===== タブ閉じる =====
function closeTab(id, e) {
  e.stopPropagation();
  if (!tabs[id] || tabOrder.length <= 1) return;
  tabs[id].iframe.remove();
  delete tabs[id];
  tabOrder.splice(tabOrder.indexOf(id), 1);
  if (activeId === id) {
    switchTab(tabOrder[Math.max(0, tabOrder.indexOf(id) - 1)] || tabOrder[0]);
  } else { renderTabs(); }
}

function openNewTab() { createTab(HOME_URL, "ラクポチ イラスト"); }

// ===== ナビゲーション =====
function navBack() {
  var t = tabs[activeId]; if (!t || t.histIdx <= 0) return;
  t.histIdx--;
  t.iframe.src = t.proxyHistory[t.histIdx];
  syncNavBar();
}
function navForward() {
  var t = tabs[activeId]; if (!t || t.histIdx >= t.history.length - 1) return;
  t.histIdx++;
  t.iframe.src = t.proxyHistory[t.histIdx];
  syncNavBar();
}
function navReload() {
  var t = tabs[activeId]; if (!t) return;
  t.iframe.src = t.proxyHistory[t.histIdx];
}
function navGo(url) {
  var t = tabs[activeId]; if (!t || !url.trim()) return;
  var full  = url.match(/^https?:\/\//) ? url : "https://" + url;
  var proxy = proxyUrl(full);
  t.history = t.history.slice(0, t.histIdx + 1);
  t.proxyHistory = t.proxyHistory.slice(0, t.histIdx + 1);
  t.history.push(full);
  t.proxyHistory.push(proxy);
  t.histIdx = t.history.length - 1;
  t.iframe.src = proxy;
  t.title = labelFromUrl(full);
  renderTabs(); syncNavBar();
  document.getElementById("url-bar").blur();
}

function syncNavBar() {
  var t = tabs[activeId]; if (!t) return;
  document.getElementById("url-bar").value = t.history[t.histIdx] || "";
  document.getElementById("btn-back").disabled = t.histIdx <= 0;
  document.getElementById("btn-fwd").disabled  = t.histIdx >= t.history.length - 1;
}

// ===== タブバー描画 =====
function renderTabs() {
  var bar = document.getElementById("tab-bar");
  var newTabBtn = document.getElementById("new-tab-btn");
  bar.innerHTML = "";
  bar.appendChild(newTabBtn);

  tabOrder.forEach(function(id) {
    var t = tabs[id]; if (!t) return;
    var isActive = id === activeId;

    var el = document.createElement("div");
    el.className = "cep-tab" + (isActive ? " active" : "");
    el.onclick = function() { switchTab(id); };

    var fav = document.createElement("img");
    fav.className = "cep-tab-favicon";
    var currentUrl = t.history[t.histIdx] || "";
    var isHome = currentUrl === HOME_URL || currentUrl.indexOf("rakupochi") !== -1;
    if (isHome) {
      fav.src = "icon.svg";
    } else {
      try { fav.src = "https://www.google.com/s2/favicons?sz=16&domain=" + new URL(currentUrl).hostname; }
      catch(e) { fav.src = "icon.svg"; }
      fav.onerror = function() { this.src = "icon.svg"; };
    }
    el.appendChild(fav);

    var label = document.createElement("span");
    label.className = "cep-tab-label";
    label.textContent = t.title || labelFromUrl(currentUrl);
    label.title = t.title;
    el.appendChild(label);

    if (tabOrder.length > 1) {
      var cls = document.createElement("button");
      cls.className = "cep-tab-close";
      cls.textContent = "×";
      cls.onclick = function(e) { closeTab(id, e); };
      el.appendChild(cls);
    }
    bar.insertBefore(el, newTabBtn);
  });
}

function labelFromUrl(url) {
  if (!url || url === HOME_URL) return "ラクポチ";
  try { return new URL(url).hostname.replace("www.", ""); } catch(e) { return url.slice(0, 16); }
}

// ===== パネルサイズ自動フィット =====
(function() {
  var container = document.getElementById("iframe-container");
  function fitIframes() {
    var w = container.offsetWidth, h = container.offsetHeight;
    Object.keys(tabs).forEach(function(id) {
      tabs[id].iframe.style.width  = w + "px";
      tabs[id].iframe.style.height = h + "px";
    });
  }
  if (window.ResizeObserver) new ResizeObserver(fitIframes).observe(container);
  else window.addEventListener("resize", fitIframes);
})();

// ===== アップデート =====
function runUpdate() {
  var btn = document.getElementById("update-btn");
  var status = document.getElementById("update-status");
  btn.disabled = true; btn.textContent = "⏳ 更新中...";
  status.style.display = "block"; status.style.color = "#6b7280";
  status.textContent = "GitHub から最新版を取得しています...";
  try {
    var exec = require("child_process").exec;
    var extPath = require("path").dirname(location.pathname.replace(/^\//, "").replace(/\/$/, "") ? location.pathname : __dirname);
    exec("git pull", { cwd: __dirname || extPath }, function(err, stdout, stderr) {
      if (err) {
        btn.disabled = false; btn.textContent = "⬆️ アップデート";
        status.style.color = "#ef4444";
        status.textContent = "❌ 失敗: " + (stderr || err.message); return;
      }
      status.style.color = "#22c55e";
      status.textContent = "✅ 更新完了！再読み込みします...";
      setTimeout(function() { location.reload(); }, 1500);
    });
  } catch(e) {
    btn.disabled = false; btn.textContent = "⬆️ アップデート";
    status.style.color = "#ef4444";
    status.textContent = "❌ " + e.message;
  }
}

// ===== 設定パネル開閉 =====
function toggleSettings() {
  document.getElementById("settings-panel").classList.toggle("active");
}

// ===== フォルダ選択 =====
function selectFolder() {
  if (window.cep && window.cep.fs) {
    var r = window.cep.fs.showOpenDialog(false, true, "ダウンロードフォルダを選択", "", "");
    if (r && r.data && r.data.length) saveFolder(r.data[0]);
  } else {
    var p = prompt("フォルダパスを入力", localStorage.getItem(FOLDER_KEY) || "");
    if (p !== null && p.trim()) saveFolder(p.trim());
  }
}
function saveFolder(path) {
  localStorage.setItem(FOLDER_KEY, path);
  updateFolderDisplay(path);
  flashSaved();
}
function updateFolderDisplay(path) {
  var el = document.getElementById("folder-display");
  el.textContent = path; el.classList.remove("empty");
}
function flashSaved() {
  var t = document.getElementById("saved-toast");
  t.classList.add("show");
  setTimeout(function() { t.classList.remove("show"); }, 2000);
}
