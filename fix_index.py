import re

file_path = '/mnt/d/google_code/note/local/daohen-weapp_V5/daohen-weapp/src/pages/index/index.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the useDidShow block
old_block = """    getEntries().then(data => {
      setEntries(data)
      
    })
    const tags = Array.from(new Set(data.flatMap((e: any) => e.tags ? e.tags.split(/[#\\s,，]+/).filter(Boolean) : []))).slice(0, 10)
    setHistoryTags(tags as string[])"""

new_block = """    getEntries().then(data => {
      setEntries(data)
      const tags = Array.from(new Set(data.flatMap((e: any) => e.tags ? e.tags.split(/[#\\s,，]+/).filter(Boolean) : []))).slice(0, 10)
      setHistoryTags(tags as string[])
      
      // 真实的河底：重力沉淀 + 物理防穿模算法 (Circle Packing)
      const positions: Record<string, any> = {}
      const allMoods = getAggregatedMoods(data).sort((a, b) => b.count - a.count)
      
      const containerW = info.windowWidth
      const containerH = info.windowHeight * 0.65 // 容器高度
      const padding = 8 // 石头之间的最小间距
      
      // 1. 初始化节点位置 (中心点坐标)
      let nodes = allMoods.map((mood, i) => {
        const size = Math.min(80 + mood.count * 12, 160)
        const radius = size / 2
        const weightRatio = allMoods.length > 1 ? i / (allMoods.length - 1) : 0
        
        // 初始 Y 轴：重的在下，轻的在上
        const baseY = (containerH - radius - 40) - (weightRatio * containerH * 0.4)
        let y = baseY + (Math.random() * 40 - 20)
        
        // 初始 X 轴：随机分布，稍微向两侧靠拢
        let x = (containerW / 2) + (Math.random() * containerW * 0.6 - containerW * 0.3)
        
        return { id: mood.id, x, y, radius, size, weightRatio }
      })
      
      // 2. 物理碰撞排斥迭代 (Relaxation Loop)
      for (let iter = 0; iter < 80; iter++) { // 提升迭代精度
        // 阶段 A：处理所有碰撞排斥
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x
            const dy = nodes[i].y - nodes[j].y
            const dist = Math.sqrt(dx * dx + dy * dy)
            const minDist = nodes[i].radius + nodes[j].radius + padding
            
            if (dist < minDist && dist > 0) {
              // 发生重叠，计算排斥力
              const angle = Math.atan2(dy, dx)
              const overlap = minDist - dist
              
              // 互相推开一半的重叠距离
              const pushX = Math.cos(angle) * (overlap / 2)
              const pushY = Math.sin(angle) * (overlap / 2)
              
              nodes[i].x += pushX
              nodes[i].y += pushY
              nodes[j].x -= pushX
              nodes[j].y -= pushY
            }
          }
        }
        
        // 阶段 B：统一处理边界约束 (确保最后一步绝对不越界)
        for (let i = 0; i < nodes.length; i++) {
          // 右侧增加额外安全距离 (padding * 2)，防止 MovableArea 滚动条或安全区导致的视觉穿模
          nodes[i].x = Math.max(nodes[i].radius + padding, Math.min(containerW - nodes[i].radius - padding * 2, nodes[i].x))
          nodes[i].y = Math.max(nodes[i].radius + padding, Math.min(containerH - nodes[i].radius - padding, nodes[i].y))
        }
      }
      
      // 4. 转换为 MovableView 需要的左上角坐标
      nodes.forEach(node => {
        positions[node.id] = { 
          x: node.x - node.radius, 
          y: node.y - node.radius, 
          size: node.size 
        }
      })
      
      setSpherePositions(positions)
    })"""

content = content.replace(old_block, new_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
