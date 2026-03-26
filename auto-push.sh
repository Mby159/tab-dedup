#!/bin/bash
# Auto-push script for Tab Dedup

cd "C:\Users\22324\.qclaw\workspace\tab-dedup-multi"

# 检查是否有未提交的更改
if git diff-index --quiet HEAD --; then
  echo "No changes to commit"
  exit 0
fi

# 添加所有更改
git add .

# 提交
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "Auto-update: $TIMESTAMP"

# 推送到 GitHub
git push origin main

echo "✅ Pushed to GitHub at $TIMESTAMP"
