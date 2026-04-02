import { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getUserSubscription } from '../../utils/storage'
import DatePickerModal from '../../components/DatePickerModal'
import './index.scss'

// 心情类型定义（包含所有可能的心情）
const DEFAULT_MOOD_TYPES = [
  { id: 'happy', icon: '😊', label: '喜悦', color: '#FBBF24' },
  { id: 'neutral', icon: '😐', label: '平静', color: '#9CA3AF' },
  { id: 'sad', icon: '😔', label: '沮丧', color: '#60A5FA' },
  { id: 'angry', icon: '💢', label: '愤怒', color: '#EF4444' },
  { id: 'tired', icon: '😫', label: '疲惫', color: '#6366F1' },
  { id: 'anxious', icon: '😰', label: '焦虑', color: '#F59E0B' },
  { id: 'shame', icon: '😳', label: '羞愧', color: '#A78BFA' }
]

// 时间维度类型
type TimeDimension = 'week' | 'month' | 'year' | 'custom'

export default function MoodMemories() {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timeDimension, setTimeDimension] = useState<TimeDimension>('week')
  const [moodStats, setMoodStats] = useState<any[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [periodLabel, setPeriodLabel] = useState('本周')
  const [customDateRange, setCustomDateRange] = useState<{start: Date, end: Date} | null>(null)
  const [showDatePicker, setShowDatePicker] = useState(false)

  useEffect(() => {
    checkProStatus()
  }, [])

  const checkProStatus = async () => {
    try {
      const sub = await getUserSubscription()
      setSubscription(sub)
      
      if (sub.isPro) {
        // Pro 用户，加载心情印记数据
        await loadMoodMemories('week')
      }
    } catch (error) {
      console.error('[MoodMemories] 检查订阅状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 获取时间范围
   */
  const getTimeRange = (dimension: TimeDimension) => {
    const now = new Date()
    const start = new Date()
    
    switch (dimension) {
      case 'week':
        // 本周一
        const dayOfWeek = now.getDay() || 7 // 周日为 0，转为 7
        start.setDate(now.getDate() - (dayOfWeek - 1))
        start.setHours(0, 0, 0, 0)
        setPeriodLabel('本周')
        setCustomDateRange(null)
        break
      case 'month':
        // 本月 1 号
        start.setDate(1)
        start.setHours(0, 0, 0, 0)
        setPeriodLabel('本月')
        setCustomDateRange(null)
        break
      case 'year':
        // 今年 1 月 1 号
        start.setMonth(0, 1)
        start.setHours(0, 0, 0, 0)
        setPeriodLabel('今年')
        setCustomDateRange(null)
        break
      case 'custom':
        // 自定义时间范围，需要用户选择
        setPeriodLabel('自定义')
        break
    }
    
    return { start, end: now }
  }

  /**
   * 加载心情统计数据
   */
  const loadMoodMemories = async (dimension: TimeDimension, dateRange?: {start: Date, end: Date}) => {
    try {
      const { start, end } = dateRange || getTimeRange(dimension)
      
      console.log('[loadMoodMemories] 查询条件:', {
        openid: Taro.getStorageSync('openid'),
        startTime: start.getTime(),
        endTime: end.getTime(),
        startDate: new Date(start.getTime()).toLocaleString(),
        endDate: new Date(end.getTime()).toLocaleString()
      })
      
      // 从云端获取日记数据
      const db = Taro.cloud.database()
      const openid = Taro.getStorageSync('openid')
      
      console.log('[loadMoodMemories] 当前 openid:', openid)
      
      if (!openid) {
        console.error('[loadMoodMemories] 用户未登录')
        return
      }
      
      // 先查询所有数据（不带 openid 限制），看看数据库中实际有什么
      const allResNoFilter = await db.collection('entries')
        .limit(100)
        .field({
          _id: true,
          _openid: true,
          openid: true,
          mood: true,
          moodEmoji: true,
          moodLabel: true,
          createTime: true
        })
        .get()
      
      console.log('[loadMoodMemories] 数据库中所有记录（不限 openid）:', allResNoFilter.data.length, '条')
      console.log('[loadMoodMemories] 所有记录详情（检查 openid）:', allResNoFilter.data.map(d => ({
        _openid: d._openid,
        openid: d.openid,
        mood: d.mood,
        createTime: new Date(d.createTime).toLocaleString(),
        matchesCurrentUser: d._openid === openid || d.openid === openid
      })))
      
      // 先查询所有数据（不带时间范围），看看数据库中实际有什么
      const allRes = await db.collection('entries')
        .where({
          openid: openid
        })
        .field({
          _id: true,
          mood: true,
          moodEmoji: true,
          moodLabel: true,
          createTime: true
        })
        .get()
      
      console.log('[loadMoodMemories] 数据库中所有记录:', allRes.data.length, '条')
      console.log('[loadMoodMemories] 所有记录详情:', allRes.data.map(d => ({
        mood: d.mood,
        createTime: new Date(d.createTime).toLocaleString(),
        timestamp: d.createTime,
        isThisWeek: new Date(d.createTime) >= start
      })))
      
      // 查询指定时间范围内的所有日记（包含草稿和自定义心情）
      // 注意：使用 _openid 字段而不是 openid 字段（微信云数据库自动添加的）
      const res = await db.collection('entries')
        .where({
          _openid: openid,
          createTime: db.command.gte(start.getTime())
        })
        .field({  // 只查询需要的字段，提高性能
          _id: true,
          mood: true,
          moodEmoji: true,
          moodLabel: true,
          moodColor: true,
          customMood: true,  // 添加 customMood 字段
          createTime: true
        })
        .get()
      
      console.log('[loadMoodMemories] 查询结果:', res.data.length, '条记录')
      console.log('[loadMoodMemories] 前 3 条记录详情:', res.data.slice(0, 3).map(d => ({
        mood: d.mood,
        moodEmoji: d.moodEmoji,
        moodLabel: d.moodLabel,
        customMood: d.customMood,  // 添加 customMood 字段
        createTime: new Date(d.createTime).toLocaleString(),
        createTimeDate: new Date(d.createTime),
        isThisWeek: new Date(d.createTime) >= start
      })))
      
      // 额外调试：显示所有记录的创建时间
      console.log('[loadMoodMemories] 所有记录的创建时间:', res.data.map(d => ({
        mood: d.mood,
        createTime: new Date(d.createTime).toLocaleString(),
        timestamp: d.createTime
      })))
      
      const entries = res.data
      const total = entries.length
      setTotalEntries(total)
      
      if (total === 0) {
        // 没有数据，初始化空统计
        const emptyStats = DEFAULT_MOOD_TYPES.map(mood => ({
          ...mood,
          count: 0,
          percentage: 0
        }))
        setMoodStats(emptyStats)
        return
      }
      
      // 动态收集所有心情类型（包括自定义）
      const moodCount: Record<string, number> = {}
      const moodCustomData: Record<string, { icon?: string; label?: string; color?: string }> = {}
      
      // 初始化和统计
      entries.forEach(entry => {
        if (entry.mood) {
          // 如果是自定义心情，使用实际的标签作为 key
          const moodKey = entry.mood === 'custom' 
            ? `custom_${entry.moodLabel || entry.customMood || '自定义'}` 
            : entry.mood;
          
          // 计数器 +1
          if (!moodCount[moodKey]) {
            moodCount[moodKey] = 0
          }
          moodCount[moodKey]++
          
          // 保存自定义心情的元数据
          if (entry.mood === 'custom' && entry.moodEmoji) {
            moodCustomData[moodKey] = {
              icon: entry.moodEmoji,
              label: entry.moodLabel || entry.customMood || '自定义',
              color: entry.moodColor || '#9CA3AF'
            }
          }
        }
      })
      
      // 构建统计结果：先标准心情，再自定义心情
      let stats: any[] = []
      
      // 添加标准心情
      DEFAULT_MOOD_TYPES.forEach(mood => {
        stats.push({
          ...mood,
          count: moodCount[mood.id] || 0,
          percentage: 0
        })
      })
      
      // 添加自定义心情
      Object.keys(moodCount).forEach(moodKey => {
        // 如果不是标准心情，则添加自定义心情
        if (!DEFAULT_MOOD_TYPES.find(m => m.id === moodKey)) {
          const customData = moodCustomData[moodKey] || {}
          // 从 key 中提取实际的心情名称（去掉 "custom_" 前缀）
          const actualMoodLabel = moodKey.startsWith('custom_') 
            ? moodKey.replace('custom_', '') 
            : customData.label || moodKey;
          
          stats.push({
            id: moodKey,
            icon: customData.icon || '🎨',  // 统一使用调色板图标表示自定义心情
            label: actualMoodLabel,
            color: customData.color || '#9CA3AF',
            count: moodCount[moodKey],
            percentage: 0
          })
        }
      })
      
      // 计算百分比（保留整数）
      stats.forEach(item => {
        item.percentage = Math.round((item.count / total) * 100)
      })
      
      // 过滤掉数量为 0 的自定义心情（可选）
      stats = stats.filter(item => {
        // 标准心情始终显示
        if (DEFAULT_MOOD_TYPES.find(m => m.id === item.id)) {
          return true
        }
        // 自定义心情只显示有记录的
        return item.count > 0
      })
      
      setMoodStats(stats)
      
    } catch (error) {
      console.error('[loadMoodMemories] 加载心情数据失败:', error)
    }
  }

  /**
   * 切换时间维度
   */
  const handleDimensionChange = (dimension: TimeDimension) => {
    if (dimension === 'custom') {
      // 自定义时间范围，显示日期选择器
      setShowDatePicker(true)
    } else {
      setTimeDimension(dimension)
      loadMoodMemories(dimension)
    }
  }

  /**
   * 确认日期选择
   */
  const handleDateConfirm = (startDate: Date, endDate: Date) => {
    // 设置自定义日期范围
    setCustomDateRange({ start: startDate, end: endDate })
    
    // 更新标签
    const startStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`
    const endStr = `${endDate.getMonth() + 1}/${endDate.getDate()}`
    setPeriodLabel(`${startStr}-${endStr}`)
    
    // 加载数据
    setTimeDimension('custom')
    loadMoodMemories('custom', { start: startDate, end: endDate })
  }

  const handleUpgrade = () => {
    Taro.navigateTo({
      url: '/pages/pro/index'
    })
  }

  if (loading) {
    return (
      <View className='mood-loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  // 非 Pro 用户，显示升级提示
  if (!subscription?.isPro) {
    return (
      <View className='mood-pro-lock'>
        <View className='lock-icon'>🔒</View>
        <Text className='lock-title'>Pro 会员专属功能</Text>
        <Text className='lock-desc'>心情印记 - 探索情绪背后的真实需求与成长轨迹</Text>
        <View className='upgrade-btn' onClick={handleUpgrade}>
          <Text>解锁心情印记</Text>
        </View>
      </View>
    )
  }

  // Pro 用户，显示心情印记
  return (
    <View className='mood-container'>
      <View className='mood-header'>
        <Text className='mood-title'>心情印记</Text>
        <Text className='mood-subtitle'>探索你的情绪世界</Text>
      </View>

      {/* 时间维度切换 */}
      <View className='dimension-selector'>
        <View 
          className={`dimension-btn ${timeDimension === 'week' ? 'active' : ''}`}
          onClick={() => handleDimensionChange('week')}
        >
          <Text>周</Text>
        </View>
        <View 
          className={`dimension-btn ${timeDimension === 'month' ? 'active' : ''}`}
          onClick={() => handleDimensionChange('month')}
        >
          <Text>月</Text>
        </View>
        <View 
          className={`dimension-btn ${timeDimension === 'year' ? 'active' : ''}`}
          onClick={() => handleDimensionChange('year')}
        >
          <Text>年</Text>
        </View>
        <View 
          className={`dimension-btn ${timeDimension === 'custom' ? 'active' : ''}`}
          onClick={() => handleDimensionChange('custom')}
        >
          <Text>自定义</Text>
        </View>
      </View>

      {/* 统计概览 */}
      <View className='stats-overview'>
        <Text className='overview-text'>{periodLabel}共记录 {totalEntries} 条心情</Text>
      </View>

      {/* 心情分布 */}
      <View className='mood-section'>
        <Text className='section-title'>心情分布</Text>
        <View className='mood-bars'>
          {moodStats.map((mood) => (
            <View key={mood.id} className='mood-bar-item'>
              <View className='mood-info'>
                <Text className='mood-icon'>{mood.icon}</Text>
                <Text className='mood-label'>{mood.label}</Text>
              </View>
              <View className='mood-bar-container'>
                <View 
                  className='mood-bar'
                  style={{ 
                    width: `${mood.percentage}%`,
                    backgroundColor: mood.color
                  }}
                />
              </View>
              <Text className='mood-percentage'>{mood.percentage}%</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 心情解读 */}
      <View className='mood-section'>
        <Text className='section-title'>心情解读</Text>
        <View className='insight-card'>
          <Text className='insight-text'>
            💡 {periodLabel}你的心情印记显示，
            {totalEntries > 0 ? '每一种情绪都是内心深处的信使，它们提醒着你真正在意的东西。' : '还没有记录心情，开始记录吧！'}
          </Text>
        </View>
      </View>

      {/* 日期选择器 */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onConfirm={handleDateConfirm}
        title='选择时间范围'
      />
    </View>
  )
}
