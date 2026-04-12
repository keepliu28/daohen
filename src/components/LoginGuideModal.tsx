import { useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import OfficialWechatLogin from './OfficialWechatLogin'
import './LoginGuideModal.scss'

interface LoginGuideModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: (userInfo: any) => void
}

export default function LoginGuideModal({ visible, onClose, onSuccess }: LoginGuideModalProps) {
  const [agreed, setAgreed] = useState(false)
  const [showWechatLogin, setShowWechatLogin] = useState(false)

  if (!visible) return null

  const handleLoginClick = () => {
    if (!agreed) {
      Taro.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }
    setShowWechatLogin(true)
  }

  const handleAgreementClick = () => {
    Taro.navigateTo({ url: '/pages/terms/index' })
  }

  const handlePrivacyClick = () => {
    Taro.navigateTo({ url: '/pages/privacy/index' })
  }

  const handleWechatLoginSuccess = (userInfo: any) => {
    setShowWechatLogin(false)
    onSuccess(userInfo)
  }

  if (showWechatLogin) {
    return (
      <OfficialWechatLogin
        visible={true}
        onSuccess={handleWechatLoginSuccess}
        onClose={() => setShowWechatLogin(false)}
      />
    )
  }

  return (
    <View className='login-guide-mask' onClick={onClose}>
      <View className='login-guide-content' onClick={e => e.stopPropagation()}>
        {/* Logo 区域 */}
        <View className='guide-logo-section'>
          <View className='guide-logo'>
            <Text className='logo-text'>DH</Text>
          </View>
          <Text className='guide-title'>道痕</Text>
        </View>

        {/* 提示文案 */}
        <View className='guide-message'>
          <Text className='guide-text'>该操作需先登录哦~</Text>
        </View>

        {/* 登录按钮 */}
        <Button 
          className='guide-login-btn'
          onClick={handleLoginClick}
        >
          好哒，立即登录
        </Button>

        {/* 协议勾选 */}
        <View className='guide-agreement'>
          <View 
            className={`agreement-checkbox ${agreed ? 'checked' : ''}`}
            onClick={() => setAgreed(!agreed)}
          >
            {agreed && <Text className='check-icon'>✓</Text>}
          </View>
          <Text className='agreement-text'>
            登录即表示同意
            <Text className='agreement-link' onClick={(e) => { e.stopPropagation(); handleAgreementClick(); }}>《服务协议》</Text>
            和
            <Text className='agreement-link' onClick={(e) => { e.stopPropagation(); handlePrivacyClick(); }}>《隐私政策》</Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
