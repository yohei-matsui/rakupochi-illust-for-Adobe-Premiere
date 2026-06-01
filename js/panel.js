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

  createTab(HOME_URL, "🔍 ラクポチ イラスト");

  // サイトからの postMessage でリンクを新タブに開く
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "openTab") {
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
  createTab(HOME_URL, "🔍 ラクポチ イラスト");
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
  if (!url || url === HOME_URL) return "🔍 ラクポチ";
  try { return new URL(url).hostname.replace("www.",""); } catch(e) { return url.slice(0,16); }
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
