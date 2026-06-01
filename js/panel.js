const FOLDER_KEY = "rakupochi_download_folder";
const HOME_URL   = "https://rakupochi-illust.com";

// ===== タブ管理 =====
// tabs[id] = { id, iframe, history:[], histIdx:0, title }
var tabs       = {};
var tabOrder   = [];   // 並び順
var activeId   = null;
var tabCounter = 0;

// ===== 起動 =====
(function init() {
  var saved = localStorage.getItem(FOLDER_KEY);
  if (saved) updateFolderDisplay(saved);

  createTab(HOME_URL, "ラクポチ イラスト");

  // postMessage リスナー
  window.addEventListener("message", function(e) {
    if (!e.data) return;
    if (e.data.type === "openTab") {
      createTab(e.data.url || HOME_URL, e.data.title || "");
    }
  });

  // パネルサイズ変更時に全 iframe を明示的にリサイズ
  var container = document.getElementById("iframe-container");
  function fitIframes() {
    var w = container.offsetWidth;
    var h = container.offsetHeight;
    Object.keys(tabs).forEach(function(id) {
      var f = tabs[id].iframe;
      f.style.width  = w + "px";
      f.style.height = h + "px";
    });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(fitIframes).observe(container);
  } else {
    window.addEventListener("resize", fitIframes);
  }
})();

// ===== タブ作成 =====
function createTab(url, title) {
  var id = "t" + (++tabCounter);

  var container = document.getElementById("iframe-container");
  var iframe = document.createElement("iframe");
  iframe.style.cssText = "position:absolute;top:0;left:0;border:none;display:none;";
  iframe.width  = container.offsetWidth  || "100%";
  iframe.height = container.offsetHeight || "100%";
  iframe.style.width  = (container.offsetWidth  || 400) + "px";
  iframe.style.height = (container.offsetHeight || 600) + "px";
  iframe.src = url;
  container.appendChild(iframe);

  tabs[id] = { id: id, iframe: iframe, history: [url], histIdx: 0, title: title || labelFromUrl(url) };
  tabOrder.push(id);

  renderTabs();
  switchTab(id);
}

// ===== タブ切替 =====
function switchTab(id) {
  if (!tabs[id]) return;

  // 設定パネル閉じる
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
  if (!tabs[id] || tabOrder.length <= 1) return;   // 最後の1枚は閉じない

  tabs[id].iframe.remove();
  delete tabs[id];
  tabOrder.splice(tabOrder.indexOf(id), 1);

  if (activeId === id) {
    switchTab(tabOrder[Math.max(0, tabOrder.indexOf(id) - 1)] || tabOrder[0]);
  } else {
    renderTabs();
  }
}

// ===== 「+」で新規タブ =====
function openNewTab() {
  createTab(HOME_URL, "ラクポチ イラスト");
}

// ===== ナビゲーション =====
function navBack() {
  var t = tabs[activeId]; if (!t) return;
  if (t.histIdx > 0) {
    t.histIdx--;
    t.iframe.src = t.history[t.histIdx];
    syncNavBar();
  }
}

function navForward() {
  var t = tabs[activeId]; if (!t) return;
  if (t.histIdx < t.history.length - 1) {
    t.histIdx++;
    t.iframe.src = t.history[t.histIdx];
    syncNavBar();
  }
}

function navReload() {
  var t = tabs[activeId]; if (!t) return;
  t.iframe.src = t.history[t.histIdx];
}

function navGo(url) {
  var t = tabs[activeId]; if (!t || !url.trim()) return;
  var full = url.match(/^https?:\/\//) ? url : "https://" + url;
  // 履歴に追加
  t.history = t.history.slice(0, t.histIdx + 1);
  t.history.push(full);
  t.histIdx = t.history.length - 1;
  t.iframe.src = full;
  t.title = labelFromUrl(full);
  renderTabs();
  syncNavBar();
  document.getElementById("url-bar").blur();
}

// ===== URLバー・ボタン同期 =====
function syncNavBar() {
  var t = tabs[activeId];
  if (!t) return;
  var url = t.history[t.histIdx] || "";
  document.getElementById("url-bar").value = url;
  document.getElementById("btn-back").disabled  = t.histIdx <= 0;
  document.getElementById("btn-fwd").disabled   = t.histIdx >= t.history.length - 1;
}

// ===== タブバー描画 =====
function renderTabs() {
  var bar = document.getElementById("tab-bar");
  // 既存のタブ要素を削除（+ボタンは残す）
  var newTabBtn = document.getElementById("new-tab-btn");
  bar.innerHTML = "";
  bar.appendChild(newTabBtn);

  tabOrder.forEach(function(id) {
    var t = tabs[id]; if (!t) return;
    var isActive = id === activeId;

    var el = document.createElement("div");
    el.className = "cep-tab" + (isActive ? " active" : "");
    el.onclick   = function() { switchTab(id); };

    // ファビコン
    var fav = document.createElement("img");
    fav.className = "cep-tab-favicon";
    var currentUrl = t.history[t.histIdx] || "";
    var isHome = currentUrl === HOME_URL || currentUrl.indexOf("rakupochi") !== -1;
    if (isHome) {
      fav.src = "icon.svg";
    } else {
      var host = "";
      try { host = new URL(currentUrl).hostname; } catch(e) {}
      fav.src = host ? "https://www.google.com/s2/favicons?sz=16&domain=" + host : "icon.svg";
      fav.onerror = function() { this.src = "icon.svg"; };
    }
    el.appendChild(fav);

    var label = document.createElement("span");
    label.className = "cep-tab-label";
    label.textContent = t.title || labelFromUrl(t.history[t.histIdx]);
    label.title       = t.title;
    el.appendChild(label);

    // ×ボタン（タブが2枚以上のとき表示）
    if (tabOrder.length > 1) {
      var cls = document.createElement("button");
      cls.className   = "cep-tab-close";
      cls.textContent = "×";
      cls.title       = "閉じる";
      cls.onclick     = function(e) { closeTab(id, e); };
      el.appendChild(cls);
    }

    // タブを + ボタンの前に挿入
    bar.insertBefore(el, newTabBtn);
  });
}

// ===== URL からラベル =====
function labelFromUrl(url) {
  if (!url || url === HOME_URL) return "ラクポチ";
  try { return new URL(url).hostname.replace("www.",""); } catch(e) { return url.slice(0,16); }
}

// ===== アップデート（git pull） =====
function runUpdate() {
  var btn    = document.getElementById("update-btn");
  var status = document.getElementById("update-status");
  btn.disabled    = true;
  btn.textContent = "⏳ 更新中...";
  status.style.display = "block";
  status.style.color   = "#6b7280";
  status.textContent   = "GitHub から最新版を取得しています...";

  try {
    var exec = require("child_process").exec;
    // 拡張機能フォルダのパス
    var extPath = require("path").dirname(require("path").dirname(location.pathname));
    exec("git pull", { cwd: extPath }, function(err, stdout, stderr) {
      if (err) {
        btn.disabled    = false;
        btn.textContent = "⬆️ アップデート";
        status.style.color  = "#ef4444";
        status.textContent  = "❌ 失敗: " + (stderr || err.message);
        return;
      }
      status.style.color = "#22c55e";
      status.textContent = "✅ 更新完了！再読み込みします...";
      setTimeout(function() { location.reload(); }, 1500);
    });
  } catch(e) {
    btn.disabled    = false;
    btn.textContent = "⬆️ アップデート";
    status.style.color  = "#ef4444";
    status.textContent  = "❌ Node.js が利用できません: " + e.message;
  }
}

// ===== スマートダウンロード =====
function smartDownload() {
  var folder = localStorage.getItem(FOLDER_KEY);
  if (!folder) {
    showToast("⚙️ 設定でフォルダを指定してください", "warn");
    return;
  }
  var t = tabs[activeId];
  if (!t) return;
  var pageUrl = t.history[t.histIdx] || "";
  if (!pageUrl || pageUrl === HOME_URL) {
    showToast("イラストのページを開いてから押してください", "warn");
    return;
  }

  showToast("⬇️ 解析中...", "info");

  try {
    var https  = require("https");
    var http   = require("http");
    var fs     = require("fs");
    var path   = require("path");
    var urlMod = require("url");

    var parsed = urlMod.parse(pageUrl);
    var client = parsed.protocol === "https:" ? https : http;

    // ページ HTML を取得してダウンロード URL を探す
    var req = client.get(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } }, function(res) {
      // リダイレクト対応
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var redirected = res.headers.location;
        if (!redirected.startsWith("http")) redirected = parsed.protocol + "//" + parsed.host + redirected;
        fetchAndSave(redirected, folder, path, fs, https, http, urlMod);
        return;
      }
      var html = "";
      res.setEncoding("utf8");
      res.on("data", function(d) { html += d; });
      res.on("end", function() {
        var imgUrl = findImageUrl(html, pageUrl, parsed, urlMod);
        if (!imgUrl) {
          showToast("❌ 画像URLが見つかりませんでした", "error");
          return;
        }
        fetchAndSave(imgUrl, folder, path, fs, https, http, urlMod);
      });
    });
    req.on("error", function(e) { showToast("❌ " + e.message, "error"); });

  } catch(e) {
    showToast("❌ Node.js エラー: " + e.message, "error");
  }
}

// ページ HTML から画像 URL を抽出
function findImageUrl(html, pageUrl, parsed, urlMod) {
  var candidates = [];

  // 1. <a download href="..."> を優先
  var dlRe = /<a[^>]+download[^>]*href=["']([^"']+)["']/gi;
  var m;
  while ((m = dlRe.exec(html)) !== null) candidates.push({ url: m[1], score: 100 });

  // 2. 直接ファイルリンク (.png/.jpg/.gif/.svg/.zip)
  var fileRe = /href=["']([^"']+\.(?:png|jpg|jpeg|gif|svg|webp|zip))["']/gi;
  while ((m = fileRe.exec(html)) !== null) candidates.push({ url: m[1], score: 80 });

  // 3. blogspot / CDN 画像 (irasutoya 等)
  var blogRe = /["'](https?:\/\/(?:\d+\.bp\.blogspot\.com|storage\.googleapis\.com|cdn\.|img\.)[^"']+\.(?:png|jpg|jpeg|gif))["']/gi;
  while ((m = blogRe.exec(html)) !== null) candidates.push({ url: m[1], score: 90 });

  // 4. og:image
  var ogRe = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i;
  m = ogRe.exec(html);
  if (m) candidates.push({ url: m[1], score: 70 });

  if (!candidates.length) return null;

  // スコア最高のものを選択
  candidates.sort(function(a, b) { return b.score - a.score; });
  var best = candidates[0].url;

  // 相対URLを絶対URLに変換
  if (!best.startsWith("http")) {
    best = best.startsWith("//")
      ? parsed.protocol + best
      : parsed.protocol + "//" + parsed.host + (best.startsWith("/") ? best : "/" + best);
  }
  return best;
}

// URL からファイルを取得してフォルダに保存
function fetchAndSave(imgUrl, folder, path, fs, https, http, urlMod) {
  showToast("⬇️ ダウンロード中...", "info");

  var parsed2 = urlMod.parse(imgUrl);
  var client2 = parsed2.protocol === "https:" ? https : http;

  var ext  = (path.extname(parsed2.pathname) || ".png").split("?")[0].toLowerCase();
  var base = path.basename(parsed2.pathname, ext).replace(/[\\/:*?"<>|]/g, "_").slice(0, 40) || "illust";
  var sep  = folder.endsWith("/") || folder.endsWith("\\") ? "" : "/";
  var dest = folder + sep + base + "_" + Date.now() + ext;

  var file = fs.createWriteStream(dest);
  var req2 = client2.get(imgUrl, { headers: { "User-Agent": "Mozilla/5.0", "Referer": imgUrl } }, function(res2) {
    if (res2.statusCode >= 300 && res2.statusCode < 400 && res2.headers.location) {
      file.close();
      fs.unlink(dest, function(){});
      fetchAndSave(res2.headers.location, folder, path, fs, https, http, urlMod);
      return;
    }
    res2.pipe(file);
    file.on("finish", function() {
      file.close();
      showToast("✅ 保存しました: " + path.basename(dest), "ok");
    });
  });
  req2.on("error", function(e) {
    fs.unlink(dest, function(){});
    showToast("❌ " + e.message, "error");
  });
}

// ===== トースト通知 =====
function showToast(msg, type) {
  var el = document.getElementById("dl-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "dl-toast";
    document.body.appendChild(el);
  }
  el.style.background =
    type === "ok"    ? "rgba(34,197,94,0.93)"  :
    type === "warn"  ? "rgba(234,179,8,0.93)"   :
    type === "error" ? "rgba(239,68,68,0.93)"   :
                       "rgba(100,116,139,0.93)";
  el.textContent  = msg;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.style.opacity = "0"; }, 3000);
}

// ===== 設定パネル開閉 =====
function toggleSettings() {
  var panel = document.getElementById("settings-panel");
  panel.classList.toggle("active");
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
  el.textContent = path;
  el.classList.remove("empty");
}

function flashSaved() {
  var t = document.getElementById("saved-toast");
  t.classList.add("show");
  setTimeout(function() { t.classList.remove("show"); }, 2000);
}
