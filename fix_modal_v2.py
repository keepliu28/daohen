# 读取文件
with open('src/pages/index/index.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 找出所有需要删除的行范围
delete_ranges = []
i = 0
while i < len(lines):
    line = lines[i]
    # 检查是否是模态框代码的开始
    if 'showLoginModal &&' in line and 'login-modal-mask' in ''.join(lines[i:i+3]):
        start_line = i
        # 找到对应的结束位置
        brace_count = 0
        found_start = False
        end_line = i
        
        for j in range(i, len(lines)):
            if '{' in lines[j]:
                brace_count += lines[j].count('{')
                found_start = True
            if '}' in lines[j]:
                brace_count -= lines[j].count('}')
            
            if found_start and brace_count == 0:
                end_line = j
                break
        
        delete_ranges.append((start_line, end_line + 1))
        i = end_line + 1
    else:
        i += 1

# 从后往前删除，避免索引偏移
for start, end in reversed(delete_ranges):
    print(f'删除行 {start+1} 到 {end} (共 {end-start} 行)')
    del lines[start:end]

# 写回文件
with open('src/pages/index/index.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'共删除 {len(delete_ranges)} 个重复代码块')
