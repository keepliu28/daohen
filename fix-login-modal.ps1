# 读取文件内容
$content = Get-Content "src/pages/index/index.tsx" -Raw

# 定义要删除的重复登录模态框代码模式
$pattern = '\s*\{showLoginModal\s*&&\s*\(\s*<View\s+className="login-modal-mask"[^)]*?onClick\s*=\s*\{\s*\(\)\s*=>\s*setShowLoginModal\(false\)\s*\}[^>]*>[\s\S]*?<\/View>\s*\)\}\s*'

# 使用循环多次替换，直到没有匹配项
$previousContent = ""
while ($content -ne $previousContent) {
    $previousContent = $content
    $content = $content -replace $pattern, ''
}

# 保存文件
$content | Set-Content "src/pages/index/index.tsx" -NoNewline

Write-Host "已完成删除重复的登录模态框代码"
Write-Host "文件已保存到 src/pages/index/index.tsx"
