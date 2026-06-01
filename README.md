# ラクポチ イラスト — Premiere Pro CEP パネル

Premiere Pro のパネルとして動作する CEP 拡張機能です。  
`rakupochi-illust.com` を iframe で表示し、さらにダウンロードフォルダ設定などプラグイン固有の機能を追加します。

## ファイル構成

```
illust-search-cep/
├── CSXS/
│   └── manifest.xml      # CEP マニフェスト（拡張機能の定義）
├── jsx/
│   └── host.jsx          # ExtendScript（Premiere Pro ホスト側）
├── js/
│   └── panel.js          # パネル UI ロジック
├── index.html            # パネル本体
├── icon.svg              # パネルアイコン
└── .debug                # デバッグポート設定
```

## インストール方法

### 1. PlayerDebugMode を有効化（初回のみ）

**Mac:**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```

**Windows:**
レジストリ `HKCU\Software\Adobe\CSXS.11` に `PlayerDebugMode` = `1` を追加

### 2. 拡張機能フォルダにコピー

**Mac:**
```
~/Library/Application Support/Adobe/CEP/extensions/illust-search-cep/
```

**Windows:**
```
%APPDATA%\Adobe\CEP\extensions\illust-search-cep\
```

このリポジトリのファイルをすべて上記フォルダにコピーしてください。

### 3. Premiere Pro を起動

`ウィンドウ > 拡張機能 > ラクポチ イラスト` で開きます。

## 機能

- **横断検索**: `rakupochi-illust.com` を iframe で表示
- **⚙️ 設定ボタン**: パネル右上から設定画面を開閉
- **フォルダ選択**: OS ネイティブのダイアログでダウンロード先を指定
- **設定の永続化**: localStorage に保存、次回起動時に自動復元
