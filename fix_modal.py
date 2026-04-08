# 读取文件
with open('src/pages/index/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 过滤掉包含特定关键词的行
new_lines = []
skip_mode = False
skip_count = 0

for i, line in enumerate(lines):
    # 检查是否需要开始跳过
    if 'login-modal-mask' in line or ('login-modal-content' in line and '完善个人资料' in ''.join(lines[i:i+5])):
        skip_mode = True
        skip_count += 1
        print(f'开始跳过代码块 #{skip_count} 在行 {i+1}')
    
    if skip_mode:
        # 检查是否结束跳过
        if ')}' in line and i > 0 and ')' in lines[i-1]:
            skip_mode = False
            print(f'结束跳过代码块 #{skip_count}')
            continue
        # 跳过这一行
        continue
    else:
        new_lines.append(line)

# 写回文件
with open('src/pages/index/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f'已完成清理，共删除 {skip_count} 个代码块')
