import { useState } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './WheelLockModal.scss'

interface WheelLockModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  title?: string
  isPasswordSet?: boolean
}

export default function WheelLockModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = '设置密码锁',
  isPasswordSet = false
}: WheelLockModalProps) {
  const [password, setPassword] = useState([0, 0, 0])

  if (!visible) return null

  const handleWheelChange = (wheelIndex: number, value: number) => {
    const newPassword = [...password]
    newPassword[wheelIndex] = value
    setPassword(newPassword)
  }

  const handleConfirm = () => {
    const passwordStr = password.join('')
    onConfirm(passwordStr)
  }

  const handleClose = () => {
    setPassword([0, 0, 0])
    onClose()
  }

  // 生成数字数组 0-9
  const numbers = Array.from({ length: 10 }, (_, i) => i)

  return (
    <View className='wheel-lock-mask' onClick={handleClose}>
      <View className='wheel-lock-content' onClick={e => e.stopPropagation()}>
        <View className='wheel-lock-header'>
          <Text className='wheel-lock-title'>{title}</Text>
          <Text className='wheel-lock-close' onClick={handleClose}>✕</Text>
        </View>
        
        <View className='wheel-lock-body'>
          {/* 密码锁提示 */}
          <View className='wheel-lock-instruction'>
            <Text className='instruction-text'>
              {isPasswordSet ? '滑动滚轮，输入密码解锁' : '滑动滚轮，设置 3 位密码'}
            </Text>
          </View>

          {/* 3 个数字滚轮 */}
          <View className='wheels-container'>
            {[0, 1, 2].map((wheelIndex) => (
              <View key={wheelIndex} className='wheel-wrapper'>
                <View className='wheel-frame'>
                  <View className='wheel-indicator'>▼</View>
                  <ScrollView 
                    className='wheel-scroll'
                    scrollY
                    scrollWithAnimation
                    scrollIntoView={`number-${wheelIndex}-${password[wheelIndex]}`}
                    showScrollbar={false}
                  >
                    {numbers.map((num) => (
                      <View
                        key={num}
                        id={`number-${wheelIndex}-${num}`}
                        className='wheel-number'
                        onClick={() => handleWheelChange(wheelIndex, num)}
                      >
                        <Text className={`number-text ${num === password[wheelIndex] ? 'active' : ''}`}>
                          {num}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                  <View className='wheel-indicator bottom'>▲</View>
                </View>
              </View>
            ))}
          </View>

          {/* 当前密码显示（测试用） */}
          <View className='password-display'>
            <Text className='display-label'>当前密码：</Text>
            <View className='display-dots'>
              {password.map((digit, index) => (
                <View key={index} className='display-dot'>
                  <Text>{digit}</Text>
                </View>
              ))}
            </View>
          </View>

          {isPasswordSet && (
            <View className='wheel-hint'>
              <Text>💡 提示：这是您设置的日记密码锁</Text>
            </View>
          )}
          
          <View className='wheel-lock-actions'>
            <Button className='wheel-btn cancel' onClick={handleClose}>取消</Button>
            <Button className='wheel-btn confirm' onClick={handleConfirm}>确定</Button>
          </View>
        </View>
      </View>
    </View>
  )
}
