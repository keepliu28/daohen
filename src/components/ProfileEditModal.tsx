import { useState } from 'react'
import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { saveUserProfile, uploadAvatar } from '../utils/storage'
import './ProfileEditModal.scss'

interface ProfileEditModalProps {
  visible: boolean
  userProfile: any
  onClose: () => void
  onSuccess: (profile: any) => void
}

export default function ProfileEditModal({ visible, userProfile, onClose, onSuccess }: ProfileEditModalProps) {
  const [avatarUrl, setAvatarUrl] = useState(userProfile?.avatarUrl || '')
  const [nickName, setNickName] = useState(userProfile?.nickName || '')
  const [saving, setSaving] = useState(false)

  if (!visible) return null

  const handleChooseAvatar = (e: any) => {
    const { avatarUrl: tempUrl } = e.detail
    if (tempUrl) {
      setAvatarUrl(tempUrl)
    }
  }

  const handleGetNickname = (e: any) => {
    const { nickName: wechatNickName } = e.detail
    if (wechatNickName) {
      setNickName(wechatNickName)
    }
  }

  const handleManualInput = (e: any) => {
    setNickName(e.detail.value)
  }

  const handleSave = async () => {
    if (!nickName.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    setSaving(true)
    Taro.showLoading({ title: '保存中...' })

    try {
      let finalAvatarUrl = avatarUrl

      // 如果是临时文件，上传到云端
      if (avatarUrl && (avatarUrl.startsWith('http://tmp/') || avatarUrl.startsWith('wxfile://'))) {
        const fileID = await uploadAvatar(avatarUrl)
        if (fileID) {
          finalAvatarUrl = fileID
        }
      }

      // 保存用户资料（包含完整信息）
      const profile = {
        ...userProfile,
        avatarUrl: finalAvatarUrl,
        nickName: nickName.trim(),
        updateTime: Date.now()
      }

      await saveUserProfile(profile)

      Taro.hideLoading()
      Taro.showToast({ title: '保存成功', icon: 'success' })
      
      // 延迟调用 onSuccess，让用户看到成功提示
      setTimeout(() => {
        onSuccess(profile)
      }, 1500)

    } catch (error) {
      console.error('[ProfileEdit] 保存失败:', error)
      Taro.hideLoading()
      Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <View className='profile-edit-mask' onClick={onClose}>
      <View className='profile-edit-content' onClick={e => e.stopPropagation()}>
        {/* 头像区域 */}
        <View className='avatar-section'>
          <Button 
            className='avatar-picker-btn'
            openType='chooseAvatar'
            onChooseAvatar={handleChooseAvatar}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} className='preview-avatar' mode='aspectFill' />
            ) : (
              <View className='placeholder-avatar'>
                <Text className='placeholder-icon'>👤</Text>
              </View>
            )}
            <View className='edit-badge'>
              <Text className='edit-icon'>✏️</Text>
            </View>
          </Button>
        </View>

        {/* 昵称输入区域 - 支持微信昵称获取 */}
        <View className='nickname-section'>
          <Text className='section-title'>输入昵称</Text>
          
          <View className='input-wrapper'>
            <Input
              className='nickname-input'
              type='nickname'
              placeholder='点击获取微信昵称或手动输入~'
              value={nickName}
              onInput={handleManualInput}
              onNicknameReturn={handleGetNickname}
              maxlength={20}
              focus
            />
            <View className='input-underline' />
            
            {/* 微信昵称快捷按钮 */}
            {!nickName && (
              <Button 
                className='wechat-nickname-btn'
                openType='getNickname'
                onGetNickname={handleGetNickname}
                size='mini'
              >
                <Text className='wechat-icon'>💬</Text>
                <Text>使用微信昵称</Text>
              </Button>
            )}
          </View>
        </View>

        {/* 引导文案 */}
        <View className='guide-text-section'>
          <Text className='guide-text'>
            深潜内心岂能默默无闻？{'\n'}
            请设置你的头像和昵称
          </Text>
        </View>

        {/* 按钮区域 */}
        <View className='button-section'>
          <Button 
            className='skip-btn'
            onClick={handleSkip}
          >
            暂不
          </Button>
          
          <Button 
            className={`save-btn ${saving ? 'disabled' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>
        </View>
      </View>
    </View>
  )
}
