const fs = require('fs');

let content = fs.readFileSync('src/pages/index/index.tsx', 'utf8');
const lines = content.split('\n');
const newLines = [];
let inDuplicateModal = false;
let skipCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否是重复的内联模态框（在文件末尾之前）
    // 保留最后使用 LoginModal 组件的部分
    if (i < lines.length - 50 && line.includes('showLoginModal &&')) {
        // 检查下一行是否包含 login-modal-mask
        if (lines[i + 1] && lines[i + 1].includes('login-modal-mask')) {
            inDuplicateModal = true;
            skipCount = 1;
            continue;
        }
    }
    
    if (inDuplicateModal) {
        // 计算 View 标签的嵌套层级
        const openTags = (line.match(/<View/g) || []).length;
        const closeTags = (line.match(/<\/View>/g) || []).length;
        skipCount += openTags - closeTags;
        
        if (skipCount <= 0) {
            inDuplicateModal = false;
        }
        continue;
    }
    
    newLines.push(line);
}

fs.writeFileSync('src/pages/index/index.tsx', newLines.join('\n'), 'utf8');
console.log('✅ 已删除所有重复的内联登录模态框代码');
console.log('✅ 保留了文件末尾的 LoginModal 和 WechatLogin 组件引用');
