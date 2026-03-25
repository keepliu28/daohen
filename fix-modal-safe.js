const fs = require('fs');

let content = fs.readFileSync('src/pages/index/index.tsx', 'utf8');
const lines = content.split('\n');
const newLines = [];
let inDuplicateModal = false;
let skipCount = 0;

// 保留文件末尾的最后 30 行（包含组件引用）
const preserveFromLine = lines.length - 30;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 如果是需要保留的区域，直接添加
    if (i >= preserveFromLine) {
        newLines.push(line);
        continue;
    }
    
    // 检查是否是重复的内联模态框
    if (line.includes('showLoginModal &&') && lines[i + 1] && lines[i + 1].includes('login-modal-mask')) {
        inDuplicateModal = true;
        skipCount = 1;
        continue;
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
console.log(`✅ 原文件 ${lines.length} 行，新文件 ${newLines.length} 行`);
