#!/bin/bash
DEST=~/Library/Application\ Support/Adobe/CEP/extensions/illust-search-cep/
rsync -av --exclude='.git' "$(dirname "$0")/" "$DEST"
echo "✅ インストール完了！Premiere Pro を再起動してください。"
read -p "Enterキーで閉じる..."
