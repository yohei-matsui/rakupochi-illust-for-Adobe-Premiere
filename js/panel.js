const FOLDER_KEY = "rakupochi_download_folder";
const HOME_URL   = "https://rakupochi-illust.com";

// ===== 起動時：保存済みフォルダを復元 =====
(function init() {
  const saved = localStorage.getItem(FOLDER_KEY);
  if (saved) updateFolderDisplay(saved);
})();

// ===== 戻る（検索トップへ） =====
function goBack() {
  var frame = document.getElementById('search-frame');
  frame.src = HOME_URL;
  document.getElementById('back-btn').style.display = 'none';
}

// ===== 設定パネル開閉 =====
function toggleSettings() {
  const frame   = document.getElementById("search-frame");
  const panel   = document.getElementById("settings-panel");
  const btn     = document.getElementById("settings-btn");
  const isOpen  = panel.classList.contains("active");

  if (isOpen) {
    panel.classList.remove("active");
    frame.style.display = "block";
    btn.textContent = "⚙️ 設定";
  } else {
    panel.classList.add("active");
    frame.style.display = "none";
    btn.textContent = "← 検索に戻る";
  }
}

// ===== フォルダ選択 =====
function selectFolder() {
  if (window.cep && window.cep.fs) {
    // CEP環境：ネイティブダイアログ
    const result = window.cep.fs.showOpenDialog(
      false, true, "ダウンロードフォルダを選択", "", ""
    );
    if (result && result.data && result.data.length > 0) {
      saveFolder(result.data[0]);
    }
  } else {
    // 非CEP環境（デバッグ用）：prompt で代替
    const path = prompt("フォルダパスを入力してください", localStorage.getItem(FOLDER_KEY) || "");
    if (path !== null && path.trim() !== "") {
      saveFolder(path.trim());
    }
  }
}

// ===== 保存＆表示更新 =====
function saveFolder(path) {
  localStorage.setItem(FOLDER_KEY, path);
  updateFolderDisplay(path);
  flashSaved();
}

function updateFolderDisplay(path) {
  const el = document.getElementById("folder-display");
  el.textContent = path;
  el.classList.remove("empty");
}

function flashSaved() {
  const toast = document.getElementById("saved-toast");
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}
