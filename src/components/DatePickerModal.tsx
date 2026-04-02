import { useState, useEffect } from 'react'
import { View, Text, Picker, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './DatePickerModal.scss'

interface DatePickerModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: (startDate: Date, endDate: Date) => void
  title?: string
}

export default function DatePickerModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = '选择时间范围'
}: DatePickerModalProps) {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  
  // 获取当前日期字符串
  const getCurrentDateStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  // 获取一年前的日期字符串
  const getYearAgoDateStr = () => {
    const now = new Date()
    const year = now.getFullYear() - 1
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  useEffect(() => {
    if (visible) {
      // 初始化：开始日期为一年前，结束日期为今天
      setStartDate(getYearAgoDateStr())
      setEndDate(getCurrentDateStr())
    }
  }, [visible])
  
  const handleConfirm = () => {
    if (!startDate || !endDate) {
      Taro.showToast({
        title: '请选择日期',
        icon: 'none'
      })
      return
    }
    
    const start = new Date(startDate)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
    
    if (end < start) {
      Taro.showToast({
        title: '结束日期不能早于开始日期',
        icon: 'none'
      })
      return
    }
    
    onConfirm(start, end)
    onClose()
  }
  
  if (!visible) return null
  
  return (
    <View className='date-picker-modal'>
      <View className='date-picker-mask' onClick={onClose} />
      <View className='date-picker-content'>
        <View className='date-picker-header'>
          <Text className='date-picker-title'>{title}</Text>
          <Text className='date-picker-cancel' onClick={onClose}>取消</Text>
        </View>
        
        <View className='date-picker-body'>
          <View className='date-picker-item'>
            <Text className='date-picker-label'>开始日期</Text>
            <Picker 
              mode='date' 
              value={startDate}
              start={getYearAgoDateStr()}
              end={endDate || getCurrentDateStr()}
              onChange={(e) => setStartDate(e.detail.value)}
            >
              <View className='date-picker-value'>
                <Text>{startDate || '请选择'}</Text>
                <Text className='date-picker-arrow'>›</Text>
              </View>
            </Picker>
          </View>
          
          <View className='date-picker-divider' />
          
          <View className='date-picker-item'>
            <Text className='date-picker-label'>结束日期</Text>
            <Picker 
              mode='date' 
              value={endDate}
              start={startDate || getYearAgoDateStr()}
              end={getCurrentDateStr()}
              onChange={(e) => setEndDate(e.detail.value)}
            >
              <View className='date-picker-value'>
                <Text>{endDate || '请选择'}</Text>
                <Text className='date-picker-arrow'>›</Text>
              </View>
            </Picker>
          </View>
        </View>
        
        <View className='date-picker-footer'>
          <Button className='date-picker-confirm' onClick={handleConfirm}>
            确定
          </Button>
        </View>
      </View>
    </View>
  )
}
