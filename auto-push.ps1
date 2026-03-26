# Auto-push script for Tab Dedup (PowerShell) - SSH Version

$projectPath = "C:\Users\22324\.qclaw\workspace\tab-dedup-multi"

Set-Location $projectPath

# 检查是否有未提交的更改
$status = git status --porcelain
if ([string]::IsNullOrEmpty($status)) {
    Write-Host "✅ No changes to commit"
    exit 0
}

# 添加所有更改
git add .

# 提交
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git commit -m "Auto-update: $timestamp"

# 推送到 GitHub (使用 SSH)
git push origin main

Write-Host "✅ Pushed to GitHub at $timestamp"
