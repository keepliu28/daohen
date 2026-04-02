import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './ApplePasscodeModal.scss'

interface ApplePasscodeModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  title?: string
  isPasswordSet?: boolean
}

export default function ApplePasscodeModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = '设置密码',
  isPasswordSet = false
}: ApplePasscodeModalProps) {
  const [passcode, setPasscode] = useState('')

  if (!visible) return null

  const handleNumberClick = (num: number) => {
    if (passcode.length < 3) {
      const newPasscode = passcode + num.toString()
      setPasscode(newPasscode)
      
      // 当输入满 3 位时自动提交
      if (newPasscode.length === 3) {
        setTimeout(() => {
          onConfirm(newPasscode)
          setPasscode('')
        }, 200)
      }
    }
  }

  const handleDelete = () => {
    if (passcode.length > 0) {
      setPasscode(passcode.slice(0, -1))
    }
  }

  const handleClose = () => {
    setPasscode('')
    onClose()
  }

  // 数字键盘布局 (3x4)
  const keypad = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [null, 0, 'delete'] as const
  ]

  return (
    <View className='apple-passcode-mask' onClick={handleClose}>
      <View className='apple-passcode-content' onClick={e => e.stopPropagation()}>
        {/* 顶部标题 */}
        <View className='passcode-header'>
          <Text className='passcode-title'>{title}</Text>
          <Text className='passcode-close' onClick={handleClose}>✕</Text>
        </View>

        {/* 密码指示器 */}
        <View className='passcode-indicator'>
          <View className='indicator-dots'>
            {[0, 1, 2].map((index) => (
              <View 
                key={index} 
                className={`dot ${passcode.length > index ? 'filled' : ''}`}
              />
            ))}
          </View>
          {isPasswordSet && (
            <Text className='passcode-hint'>请输入 3 位数字密码</Text>
          )}
        </View>

        {/* 数字键盘 */}
        <View className='passcode-keypad'>
          {keypad.map((row, rowIndex) => (
            <View key={rowIndex} className='keypad-row'>
              {row.map((item, colIndex) => {
                if (item === null) {
                  return <View key={colIndex} className='key-placeholder' />
                }
                
                if (item === 'delete') {
                  return (
                    <View 
                      key={colIndex} 
                      className='key delete-key'
                      onClick={handleDelete}
                    >
                      <Text className='delete-icon'>⌫</Text>
                    </View>
                  )
                }

                return (
                  <View 
                    key={colIndex} 
                    className='key'
                    onClick={() => handleNumberClick(item as number)}
                  >
                    <Text className='key-number'>{item}</Text>
                  </View>
                )
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
