import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './PasswordLockModal.scss'

interface PasswordLockModalProps {
  visible: boolean
  onClose: () => void
  onConfirm: (password: string) => void
  title?: string
  isPasswordSet?: boolean
}

export default function PasswordLockModal({ 
  visible, 
  onClose, 
  onConfirm,
  title = '设置密码锁',
  isPasswordSet = false
}: PasswordLockModalProps) {
  const [password, setPassword] = useState('')

  if (!visible) return null

  const handleConfirm = () => {
    if (password.length !== 3 || !/^\d{3}$/.test(password)) {
      Taro.showToast({
        title: '请输入 3 位数字',
        icon: 'none'
      })
      return
    }

    onConfirm(password)
    setPassword('')
  }

  const handleClose = () => {
    setPassword('')
    onClose()
  }

  return (
    <View className='password-lock-mask' onClick={handleClose}>
      <View className='password-lock-content' onClick={e => e.stopPropagation()}>
        <View className='password-lock-header'>
          <Text className='password-lock-title'>{title}</Text>
          <Text className='password-lock-close' onClick={handleClose}>✕</Text>
        </View>
        
        <View className='password-lock-body'>
          <View className='password-input-wrapper'>
            <Input
              className='password-input'
              type='number'
              maxlength={3}
              placeholder='请输入 3 位数字密码'
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
              autoFocus
            />
            <View className='password-dots'>
              {[0, 1, 2].map((i) => (
                <View 
                  key={i} 
                  className={`password-dot ${password.length > i ? 'filled' : ''}`}
                />
              ))}
            </View>
          </View>
          
          {isPasswordSet && (
            <View className='password-hint'>
              <Text>💡 提示：这是您设置的日记密码锁</Text>
            </View>
          )}
          
          <View className='password-lock-actions'>
            <Button className='password-btn cancel' onClick={handleClose}>取消</Button>
            <Button className='password-btn confirm' onClick={handleConfirm}>确定</Button>
          </View>
        </View>
      </View>
    </View>
  )
}
