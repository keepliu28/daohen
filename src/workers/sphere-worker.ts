// src/workers/sphere-worker.ts

interface Node {
  id: string;
  x: number;
  y: number;
  radius: number;
  size: number;
  weightRatio: number;
}

interface MoodEntry {
  id: string;
  mood: string;
  customMood?: string;
  tags?: string;
}

interface AggregatedMood {
  id: string;
  label: string;
  icon: string;
  color: string;
  count: number;
}

const MOODS = [
  { id: 'happy', icon: '😊', label: '喜悦', color: '#FBBF24' },
  { id: 'neutral', icon: '😐', label: '平静', color: '#9CA3AF' },
  { id: 'sad', icon: '😔', label: '沮丧', color: '#60A5FA' },
  { id: 'angry', icon: '💢', label: '愤怒', color: '#EF4444' },
  { id: 'tired', icon: '😫', label: '疲惫', color: '#6366F1' },
  { id: 'anxious', icon: '😰', label: '焦虑', color: '#F59E0B' },
  { id: 'shame', icon: '😳', label: '羞愧', color: '#A78BFA' }
];

const getAggregatedMoods = (data: MoodEntry[]): AggregatedMood[] => {
  const stats: Record<string, AggregatedMood> = {};
  data.forEach(entry => {
    const moodId = entry.mood === 'custom' ? `custom_${entry.customMood}` : entry.mood;
    const label = entry.mood === 'custom' ? entry.customMood : MOODS.find(m => m.id === entry.mood)?.label;
    const icon = entry.mood === 'custom' ? '✨' : MOODS.find(m => m.id === entry.mood)?.icon;
    const color = entry.mood === 'custom' ? '#A78BFA' : MOODS.find(m => m.id === entry.mood)?.color;
    if (!stats[moodId]) stats[moodId] = { id: moodId, label: label || '', icon: icon || '', color: color || '', count: 0 };
    stats[moodId].count++;
  });
  return Object.values(stats);
};

const calculateSpherePositions = (data: MoodEntry[], containerW: number, containerH: number) => {
  const padding = 8; // 石头之间的最小间距
  const allMoods = getAggregatedMoods(data).sort((a, b) => b.count - a.count);

  let nodes: Node[] = allMoods.map((mood, i) => {
    const size = Math.min(80 + mood.count * 12, 160);
    const radius = size / 2;
    const weightRatio = allMoods.length > 1 ? i / (allMoods.length - 1) : 0;

    // 初始 Y 轴：重的在下，轻的在上
    const baseY = (containerH - radius - 40) - (weightRatio * containerH * 0.4);
    let y = baseY + (Math.random() * 40 - 20);

    // 初始 X 轴：随机分布，稍微向两侧靠拢
    let x = (containerW / 2) + (Math.random() * containerW * 0.6 - containerW * 0.3);

    return { id: mood.id, x, y, radius, size, weightRatio };
  });

  // 物理碰撞排斥迭代 (Relaxation Loop)
  for (let iter = 0; iter < 80; iter++) { // 提升迭代精度
    // 阶段 A：处理所有碰撞排斥
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = nodes[i].radius + nodes[j].radius + padding;

        if (dist < minDist && dist > 0) {
          // 发生重叠，计算排斥力
          const angle = Math.atan2(dy, dx);
          const overlap = minDist - dist;

          // 互相推开一半的重叠距离
          const pushX = Math.cos(angle) * (overlap / 2);
          const pushY = Math.sin(angle) * (overlap / 2);

          nodes[i].x += pushX;
          nodes[i].y += pushY;
          nodes[j].x -= pushX;
          nodes[j].y -= pushY;
        }
      }
    }

    // 阶段 B：统一处理边界约束 (确保最后一步绝对不越界)
    for (let i = 0; i < nodes.length; i++) {
      // 右侧增加额外安全距离 (padding * 2)，防止 MovableArea 滚动条或安全区导致的视觉穿模
      nodes[i].x = Math.max(nodes[i].radius + padding, Math.min(containerW - nodes[i].radius - padding * 2, nodes[i].x));
      nodes[i].y = Math.max(nodes[i].radius + padding, Math.min(containerH - nodes[i].radius - padding, nodes[i].y));
    }
  }

  // 转换为 MovableView 需要的左上角坐标
  const positions: Record<string, any> = {};
  nodes.forEach(node => {
    positions[node.id] = {
      x: node.x - node.radius,
      y: node.y - node.radius,
      size: node.size
    };
  });
  return positions;
};

self.onmessage = (event: MessageEvent) => {
  const { data, containerW, containerH } = event.data;
  const positions = calculateSpherePositions(data, containerW, containerH);
  self.postMessage(positions);
};
