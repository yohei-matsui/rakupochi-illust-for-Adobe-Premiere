const FOLDER_KEY = "rakupochi_download_folder";
const HOME_URL   = "https://rakupochi-illust.com";

// タブ管理
let tabs = []; // { id, url, title, iframe }
let activeTabId = null;
let tabCounter = 0;

// ===== 起動時初期化 =====
(function init() {
  // 保存済みフォルダ復元
  const saved = localStorage.getItem(FOLDER_KEY);
  if (saved) updateFolderDisplay(saved);

  // ホームタブを作成
  createTab(HOME_URL, "🔍 検索");

  // postMessage リスナー（サイトからのリンク開封）
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "openTab") {
      var url   = e.data.url   || "";
      var title = e.data.title || domainLabel(url);
      if (url) createTab(url, title);
    }
  });
})();

// ===== タブ作成 =====
function createTab(url, title) {
  var id = "tab_" + (++tabCounter);

  // iframe 作成
  var iframe = document.createElement("iframe");
  iframe.src = url;
  iframe.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;border:none;display:none;";
  document.getElementById("iframe-container").appendChild(iframe);

  tabs.push({ id: id, url: url, title: title, iframe: iframe });
  renderTabs();
  switchTab(id);
}

// ===== タブ切替 =====
function switchTab(id) {
  tabs.forEach(function(t) {
    t.iframe.style.display = (t.id === id) ? "block" : "none";
  });
  activeTabId = id;
  renderTabs();

  // 設定パネルが開いてたら閉じる
  document.getElementById("settings-panel").classList.remove("active");
  document.getElementById("iframe-container").style.display = "block";
}

// ===== タブ閉じる =====
function closeTab(id, e) {
  e.stopPropagation();
  var idx = tabs.findIndex(function(t) { return t.id === id; });
  if (idx === -1 || tabs[idx].title === "🔍 検索") return; // ホームは閉じない

  tabs[idx].iframe.remove();
  tabs.splice(idx, 1);

  // 閉じたのがアクティブなら隣へ
  if (activeTabId === id) {
    var next = tabs[Math.min(idx, tabs.length - 1)];
    if (next) switchTab(next.id);
  } else {
    renderTabs();
  }
}

// ===== タブバー描画 =====
function renderTabs() {
  var bar = document.getElementById("tab-bar");
  bar.innerHTML = "";

  tabs.forEach(function(t) {
    var isActive = t.id === activeTabId;
    var isHome   = t.title === "🔍 検索";

    var tab = document.createElement("div");
    tab.className = "cep-tab" + (isActive ? " active" : "");
    tab.onclick   = function() { switchTab(t.id); };

    var label = document.createElement("span");
    label.className = "cep-tab-label";
    label.textContent = isActive ? t.title : domainLabel(t.url === HOME_URL ? "検索" : t.url);
    label.title = t.title;
    tab.appendChild(label);

    if (!isHome) {
      var closeBtn = document.createElement("button");
      closeBtn.className = "cep-tab-close";
      closeBtn.textContent = "×";
      closeBtn.onclick = function(e) { closeTab(t.id, e); };
      tab.appendChild(closeBtn);
    }

    bar.appendChild(tab);
  });
}

// ===== URL からラベルを作る =====
function domainLabel(url) {
  if (url === "検索") return "🔍 検索";
  try {
    return new URL(url).hostname.replace("www.", "").split(".")[0];
  } catch(e) {
    return url.slice(0, 12);
  }
}

// ===== 設定パネル開閉 =====
function toggleSettings() {
  var panel     = document.getElementById("settings-panel");
  var container = document.getElementById("iframe-container");
  var btn       = document.getElementById("settings-btn");
  var isOpen    = panel.classList.contains("active");

  if (isOpen) {
    panel.classList.remove("active");
    container.style.display = "block";
    btn.textContent = "⚙️ 設定";
  } else {
    panel.classList.add("active");
    container.style.display = "none";
    btn.textContent = "← 戻る";
  }
}

// ===== フォルダ選択 =====
function selectFolder() {
  if (window.cep && window.cep.fs) {
    var result = window.cep.fs.showOpenDialog(false, true, "ダウンロードフォルダを選択", "", "");
    if (result && result.data && result.data.length > 0) {
      saveFolder(result.data[0]);
    }
  } else {
    var path = prompt("フォルダパスを入力", localStorage.getItem(FOLDER_KEY) || "");
    if (path !== null && path.trim()) saveFolder(path.trim());
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
  var toast = document.getElementById("saved-toast");
  toast.classList.add("show");
  setTimeout(function() { toast.classList.remove("show"); }, 2000);
}
