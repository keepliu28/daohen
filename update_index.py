import re

file_path = '/mnt/d/google_code/note/local/daohen-weapp_V5/daohen-weapp/src/pages/index/index.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. useDidShow
content = content.replace(
    'const data = getEntries()\n    setEntries(data)',
    'getEntries().then(data => {\n      setEntries(data)\n      // 真实的河底：重力沉淀 + 物理防穿模算法 (Circle Packing)\n      const positions: Record<string, any> = {}\n      const allMoods = getAggregatedMoods(data).sort((a, b) => b.count - a.count)\n      \n      const containerW = info.windowWidth\n      const containerH = info.windowHeight * 0.65 // 容器高度\n      const padding = 8 // 石头之间的最小间距\n      \n      // 1. 初始化节点位置 (中心点坐标)\n      let nodes = allMoods.map((mood, i) => {\n        const size = Math.min(80 + mood.count * 12, 160)\n        const radius = size / 2\n        const weightRatio = allMoods.length > 1 ? i / (allMoods.length - 1) : 0\n        \n        // 初始 Y 轴：重的在下，轻的在上\n        const baseY = (containerH - radius - 40) - (weightRatio * containerH * 0.4)\n        let y = baseY + (Math.random() * 40 - 20)\n        \n        // 初始 X 轴：随机分布，稍微向两侧靠拢\n        let x = (containerW / 2) + (Math.random() * containerW * 0.6 - containerW * 0.3)\n        \n        return { id: mood.id, x, y, radius, size, weightRatio }\n      })\n      \n      // 2. 物理碰撞排斥迭代 (Relaxation Loop)\n      for (let iter = 0; iter < 80; iter++) { // 提升迭代精度\n        // 阶段 A：处理所有碰撞排斥\n        for (let i = 0; i < nodes.length; i++) {\n          for (let j = i + 1; j < nodes.length; j++) {\n            const dx = nodes[i].x - nodes[j].x\n            const dy = nodes[i].y - nodes[j].y\n            const dist = Math.sqrt(dx * dx + dy * dy)\n            const minDist = nodes[i].radius + nodes[j].radius + padding\n            \n            if (dist < minDist && dist > 0) {\n              // 发生重叠，计算排斥力\n              const angle = Math.atan2(dy, dx)\n              const overlap = minDist - dist\n              \n              // 互相推开一半的重叠距离\n              const pushX = Math.cos(angle) * (overlap / 2)\n              const pushY = Math.sin(angle) * (overlap / 2)\n              \n              nodes[i].x += pushX\n              nodes[i].y += pushY\n              nodes[j].x -= pushX\n              nodes[j].y -= pushY\n            }\n          }\n        }\n        \n        // 阶段 B：统一处理边界约束 (确保最后一步绝对不越界)\n        for (let i = 0; i < nodes.length; i++) {\n          // 右侧增加额外安全距离 (padding * 2)，防止 MovableArea 滚动条或安全区导致的视觉穿模\n          nodes[i].x = Math.max(nodes[i].radius + padding, Math.min(containerW - nodes[i].radius - padding * 2, nodes[i].x))\n          nodes[i].y = Math.max(nodes[i].radius + padding, Math.min(containerH - nodes[i].radius - padding, nodes[i].y))\n        }\n      }\n      \n      // 4. 转换为 MovableView 需要的左上角坐标\n      nodes.forEach(node => {\n        positions[node.id] = { \n          x: node.x - node.radius, \n          y: node.y - node.radius, \n          size: node.size \n        }\n      })\n      \n      setSpherePositions(positions)\n    })'
)

# Remove the old physics code from useDidShow since we moved it inside the promise
content = re.sub(r'// 真实的河底：重力沉淀 \+ 物理防穿模算法 \(Circle Packing\).*?setSpherePositions\(positions\)', '', content, flags=re.DOTALL)

# 2. handleStart
content = content.replace(
    'const handleStart = () => {',
    'const handleStart = async () => {'
)
content = content.replace(
    'const updated = saveEntry(newEntry)',
    'const updated = await saveEntry(newEntry)'
)

# 3. handleNext
content = content.replace(
    'const handleNext = () => {',
    'const handleNext = async () => {'
)

# 4. handleSaveDraft
content = content.replace(
    'const handleSaveDraft = () => {',
    'const handleSaveDraft = async () => {'
)

# 5. handleSave
content = content.replace(
    'const handleSave = () => {',
    'const handleSave = async () => {'
)

# 6. handleToggleLock
content = content.replace(
    'const handleToggleLock = () => {',
    'const handleToggleLock = async () => {'
)
content = content.replace(
    'const updatedList = saveEntry(updatedEntry);',
    'const updatedList = await saveEntry(updatedEntry);'
)

# 7. handleDelete
content = content.replace(
    'success: function (res) {',
    'success: async function (res) {'
)
content = content.replace(
    'const updatedList = deleteEntryById(selectedEntry.id);',
    'const updatedList = await deleteEntryById(selectedEntry.id);'
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
