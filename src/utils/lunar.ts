/**
 * 农历转换工具
 * 使用 lunar-javascript 库，提供准确的农历转换
 * 文档：https://6tail.cn/calendar/api.html
 */
import { Solar } from 'lunar-javascript'

// 农历月份名称
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const LUNAR_DAYS = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十']

// 公历转农历
export function solar2lunar(year: number, month: number, day: number): {
  lunarYear: number
  lunarMonth: number
  lunarDay: number
  isLeap: boolean
  monthText: string
  dayText: string
} {
  try {
    // 创建公历对象
    const solar = Solar.fromYmd(year, month, day)
    // 转换为农历
    const lunar = solar.getLunar()
    
    // 获取农历信息
    const lunarYear = lunar.getYear()
    const lunarMonth = lunar.getMonth()
    const lunarDay = lunar.getDay()
    const isLeap = lunar.isLeap()  // 判断是否为闰月
    
    return {
      lunarYear,
      lunarMonth,
      lunarDay,
      isLeap,
      monthText: LUNAR_MONTHS[lunarMonth - 1] + '月',
      dayText: LUNAR_DAYS[lunarDay - 1] || '初一'
    }
  } catch (error) {
    console.error('农历转换失败:', error)
    // 降级处理
    return {
      lunarYear: year,
      lunarMonth: 1,
      lunarDay: 1,
      isLeap: false,
      monthText: '正月',
      dayText: '初一'
    }
  }
}

// 获取农历节日
export function getLunarFestival(month: number, day: number, isLeap: boolean = false): string {
  if (isLeap) return ''
  
  const festivals: { [key: string]: string } = {
    '1-1': '春节',
    '1-15': '元宵节',
    '5-5': '端午节',
    '7-7': '七夕节',
    '7-15': '中元节',
    '8-15': '中秋节',
    '9-9': '重阳节',
    '12-8': '腊八节',
    '12-30': '除夕'
  }
  
  return festivals[`${month}-${day}`] || ''
}

// 导出农历天数数组（兼容旧代码）
export { LUNAR_DAYS }
