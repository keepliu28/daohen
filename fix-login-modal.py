import re

# 读取文件
with open('src/pages/index/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 查找文件末尾的正确组件引用（保留这两处）
# 1. LoginModal 组件
# 2. WechatLogin 组件

# 定义要删除的模式 - 匹配所有在列表渲染中的重复模态框
pattern = r'\s*\{showLoginModal\s*&&\s*\(\s*<View\s+className="login-modal-mask"[^>]*>[\s\S]*?<\/View>\s*\)\}(?!\s*{/*\s*全局模态框组件)'

# 使用更简单的方法：找到所有重复的模态框代码并删除
lines = content.split('\n')
new_lines = []
skip_until_closing = 0
in_duplicate_modal = False

for i, line in enumerate(lines):
    # 检查是否是重复的模态框开始（不在文件末尾）
    if 'showLoginModal &&' in line and i < len(lines) - 100:  # 不在文件末尾
        # 检查后面是否紧跟 login-modal-mask
        if i + 1 < len(lines) and 'login-modal-mask' in lines[i + 1]:
            in_duplicate_modal = True
            skip_until_closing = 1  # 需要匹配一个闭合标签
            continue
    
    if in_duplicate_modal:
        # 计算嵌套层级
        if '<View' in line:
            skip_until_closing += line.count('<View')
        if '</View>' in line:
            skip_until_closing -= line.count('</View>')
        
        if skip_until_closing <= 0:
            in_duplicate_modal = False
        continue
    
    new_lines.append(line)

# 写回文件
with open('src/pages/index/index.tsx', 'w', encoding='utf-8') as f:
    f.write('\n'.join(new_lines))

print("已完成清理重复的登录模态框代码")
