import { useState, useEffect } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getUserProfile, getOpenId, deleteUserAccount, getUserSubscription } from '../../utils/storage'
import LoginGuideModal from '../../components/LoginGuideModal'
import ProfileEditModal from '../../components/ProfileEditModal'
import QRCodeModal from '../../components/QRCodeModal'
import FeedbackModal from '../../components/FeedbackModal'
import './index.scss'

export default function ProfilePage() {
  const [userProfile, setUserProfile] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLoginGuide, setShowLoginGuide] = useState(false)
  const [showProfileEdit, setShowProfileEdit] = useState(false)
  const [subscription, setSubscription] = useState<any>(null)
  const [version, setVersion] = useState('1.0.0')
  const [showQRCode, setShowQRCode] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  useEffect(() => {
    checkLoginStatus()
    loadVersion()
    loadSubscription()
  }, [])

  const checkLoginStatus = () => {
    const openid = getOpenId()
    const profile = getUserProfile()
    
    if (openid && profile) {
      setIsLoggedIn(true)
      setUserProfile(profile)
    } else {
      setIsLoggedIn(false)
      setUserProfile(null)
    }
  }

  const loadVersion = () => {
    const accountInfo = Taro.getAccountInfoSync()
    setVersion(accountInfo.miniProgram.version || '1.0.0')
  }

  const loadSubscription = async () => {
    try {
      const sub = await getUserSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error('[Profile] 获取订阅状态失败:', error)
    }
  }

  const handleUserAreaClick = () => {
    if (!isLoggedIn) {
      setShowLoginGuide(true)
    } else {
      setShowProfileEdit(true)
    }
  }

  const handleLoginSuccess = (userInfo: any) => {
    setUserProfile(userInfo)
    setIsLoggedIn(true)
    setShowLoginGuide(false)
    loadSubscription()
  }

  const handleProfileUpdate = (profile: any) => {
    // 从本地存储重新获取最新数据，确保数据一致性
    const latestProfile = getUserProfile()
    
    if (latestProfile) {
      // 使用最新数据更新状态
      setUserProfile({
        ...latestProfile,
        // 优先使用传入的新数据（确保实时性）
        avatarUrl: profile.avatarUrl || latestProfile.avatarUrl,
        nickName: profile.nickName || latestProfile.nickName
      })
    } else {
      // 如果本地没有数据，直接使用传入的数据
      setUserProfile(profile)
    }
    
    setShowProfileEdit(false)
    
    // 延迟显示成功提示（因为 ProfileEditModal 已经显示了）
    setTimeout(() => {
      Taro.showToast({ 
        title: '资料已更新', 
        icon: 'success',
        duration: 1500
      })
    }, 100)
  }

  // 页面显示时刷新数据（从其他页面返回时）
  useDidShow(() => {
    checkLoginStatus()
    loadSubscription()
  })

  const handleMenuClick = (menuType: string) => {
    switch (menuType) {
      case 'terms':
        Taro.navigateTo({ url: '/pages/terms/index' })
        break
      case 'privacy':
        Taro.navigateTo({ url: '/pages/privacy/index' })
        break
      case 'about':
        Taro.showModal({
          title: '关于道痕',
          content: '道痕 - 深潜内心，安全记录\n\n基于路飞老师的方法论搭建的情绪记录工具\n\n版本：' + version,
          showCancel: false,
          confirmText: '知道了'
        })
        break
      case 'pro':
        Taro.navigateTo({ url: '/pages/pro/index' })
        break
      case 'orders':
        Taro.navigateTo({ url: '/pages/orders/index' })
        break
      case 'feedback':
        setShowFeedback(true)
        break
      case 'qrcode':
        setShowQRCode(true)
        break
      case 'delete':
        handleDeleteAccount()
        break
      default:
        break
    }
  }

  const handleDeleteAccount = async () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const confirm1 = await Taro.showModal({
      title: '⚠️ 注销账号',
      content: '此操作将永久删除您的所有数据，包括：\n\n• 所有日记记录\n• 用户资料\n• Pro会员资格\n\n此操作不可恢复！',
      confirmText: '继续',
      cancelText: '再想想',
      confirmColor: '#FF3B30'
    })

    if (!confirm1.confirm) return

    const confirm2 = await Taro.showModal({
      title: '最终确认',
      content: '您确定要注销账号吗？\n\n一旦删除，所有数据将永久丢失！',
      confirmText: '确定注销',
      cancelText: '取消',
      confirmColor: '#FF3B30'
    })

    if (!confirm2.confirm) return

    try {
      Taro.showLoading({ title: '注销中...' })
      const result = await deleteUserAccount()
      
      Taro.hideLoading()
      
      if (result.success) {
        Taro.showModal({
          title: '账号已注销',
          content: `已删除 ${result.deletedEntries || 0} 条日记`,
          showCancel: false,
          confirmText: '好的',
          success: () => {
            setIsLoggedIn(false)
            setUserProfile(null)
            setSubscription(null)
          }
        })
      } else {
        Taro.showModal({ title: '注销失败', content: result.message, showCancel: false })
      }
    } catch (error: any) {
      Taro.hideLoading()
      Taro.showModal({ title: '注销失败', content: error.message || '请稍后重试', showCancel: false })
    }
  }

  return (
    <View className='profile-page'>
      {/* 用户信息区域 */}
      <View className='user-section' onClick={handleUserAreaClick}>
        <View className='avatar-wrapper'>
          {userProfile?.avatarUrl ? (
            <Image src={userProfile.avatarUrl} className='user-avatar' mode='aspectFill' />
          ) : (
            <View className='user-avatar placeholder'>
              <Text className='avatar-icon'>👤</Text>
            </View>
          )}
        </View>
        
        <View className='user-info'>
          <Text className='user-name'>
            {isLoggedIn ? (userProfile?.nickName || '道痕行者') : '未登录'}
          </Text>
          {isLoggedIn && subscription?.isPro && (
            <View className='pro-badge'>
              <Text>Pro 会员</Text>
            </View>
          )}
        </View>

        <Text className='arrow-icon'>›</Text>
      </View>

      {/* 功能菜单卡片 */}
      <View className='menu-card'>
        {/* 订阅管理 */}
        <View className='menu-item' onClick={() => handleMenuClick('pro')}>
          <View className='menu-left'>
            <Text className='menu-title'>{subscription?.isPro ? 'Pro 会员' : '升级 Pro'}</Text>
            {!subscription?.isPro && (
              <Text className='menu-desc'>解锁无限记录 + 密码锁 + 心情印记</Text>
            )}
          </View>
          <Text className='arrow-icon'>›</Text>
        </View>

        {/* 我的订单 */}
        <View className='menu-item orders-item' onClick={() => handleMenuClick('orders')}>
          <View className='menu-left'>
            <Text className='menu-title'>我的订单</Text>
            <Text className='menu-desc'>查看购买记录和会员状态</Text>
          </View>
          <Text className='arrow-icon'>›</Text>
        </View>
        <View className='menu-divider' />

        {/* 服务协议 */}
        <View className='menu-item' onClick={() => handleMenuClick('terms')}>
          <Text className='menu-title'>服务协议</Text>
          <Text className='arrow-icon'>›</Text>
        </View>
        <View className='menu-divider' />

        {/* 隐私政策 */}
        <View className='menu-item' onClick={() => handleMenuClick('privacy')}>
          <Text className='menu-title'>隐私政策</Text>
          <Text className='arrow-icon'>›</Text>
        </View>
        <View className='menu-divider' />

        {/* 关于 */}
        <View className='menu-item' onClick={() => handleMenuClick('about')}>
          <Text className='menu-title'>关于道痕</Text>
          <Text className='arrow-icon'>›</Text>
        </View>
        <View className='menu-divider' />

        {/* 用户反馈 */}
        <View className='menu-item feedback-item' onClick={() => handleMenuClick('feedback')}>
          <View className='menu-left'>
            <Text className='menu-title'>用户反馈</Text>
            <Text className='menu-desc'>帮助我们改进产品体验</Text>
          </View>
          <Text className='arrow-icon'>›</Text>
        </View>
        <View className='menu-divider' />

        {/* 关注公众号 */}
        <View className='menu-item qrcode-item' onClick={() => handleMenuClick('qrcode')}>
          <View className='menu-left'>
            <Text className='menu-title'>关注公众号</Text>
            <Text className='menu-desc'>获取最新功能更新和使用技巧</Text>
          </View>
          <Text className='arrow-icon'>›</Text>
        </View>

        {/* 危险操作：注销账号 */}
        {isLoggedIn && (
          <>
            <View className='menu-divider' />
            <View className='menu-item danger' onClick={() => handleMenuClick('delete')}>
              <Text className='menu-title danger-text'>注销账号</Text>
              <Text className='arrow-icon'>›</Text>
            </View>
          </>
        )}
      </View>

      {/* 版本号 */}
      <View className='version-info'>
        <Text className='version-text'>当前版本：{version}</Text>
      </View>

      {/* 登录引导弹窗 */}
      <LoginGuideModal
        visible={showLoginGuide}
        onClose={() => setShowLoginGuide(false)}
        onSuccess={handleLoginSuccess}
      />

      {/* 资料编辑弹窗 */}
      <ProfileEditModal
        visible={showProfileEdit}
        userProfile={userProfile}
        onClose={() => setShowProfileEdit(false)}
        onSuccess={handleProfileUpdate}
      />

      {/* 公众号二维码弹窗 */}
      <QRCodeModal
        visible={showQRCode}
        onClose={() => setShowQRCode(false)}
      />

      {/* 用户反馈弹窗 */}
      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSuccess={() => {
          console.log('[Profile] 用户已提交反馈')
        }}
      />
    </View>
  )
}
