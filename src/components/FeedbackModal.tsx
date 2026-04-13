import { useState } from 'react'
import { View, Text, Input, Textarea, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getOpenId, getUserProfile } from '../utils/storage'
import './FeedbackModal.scss'

interface FeedbackModalProps {
  visible: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function FeedbackModal({ visible, onClose, onSuccess }: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState('suggestion') // suggestion/bug/other
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  if (!visible) return null

  // 反馈类型选项
  const feedbackTypes = [
    { value: 'suggestion', label: '💡 功能建议' },
    { value: 'bug', label: '🐛 问题反馈' },
    { value: 'other', label: '💬 其他意见' }
  ]

  const handleTypeChange = (e: any) => {
    setFeedbackType(e.detail.value)
  }

  const handleSubmit = async () => {
    if (!content.trim()) {
      Taro.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    
    try {
      // 检查用户是否登录
      const openid = getOpenId()
      if (!openid) {
        throw new Error('USER_NOT_LOGGED_IN')
      }
      
      const userProfile = getUserProfile()
      
      // 获取系统信息
      let systemInfo
      try {
        systemInfo = Taro.getSystemInfoSync()
      } catch (sysError) {
        console.warn('[FeedbackModal] 获取系统信息失败:', sysError)
        systemInfo = {
          platform: 'unknown',
          system: 'unknown',
          version: 'unknown',
          model: 'unknown',
          SDKVersion: 'unknown'
        }
      }
      
      // 构建反馈数据
      const feedbackData = {
        type: feedbackType,
        content: content.trim(),
        contact: contact.trim(),
        userInfo: {
          nickName: userProfile?.nickName || '匿名用户',
          avatarUrl: userProfile?.avatarUrl || ''
        },
        systemInfo: {
          platform: systemInfo.platform,
          system: systemInfo.system,
          version: systemInfo.version,
          model: systemInfo.model,
        SDKVersion: systemInfo.SDKVersion
        },
        // 安全获取应用版本号（小程序环境可能没有 process.env）
        appVersion: (() => {
          try {
            const accountInfo = Taro.getAccountInfoSync()
            return accountInfo.miniProgram.version || '1.0.0'
          } catch (e) {
            console.warn('[FeedbackModal] 获取应用版本失败:', e)
            return '1.0.0'
          }
        })(),
        createTime: new Date(),
        status: 'pending' // pending/processed/replied
      }

      // 保存到云端数据库（带重试机制）
      const db = Taro.cloud.database()
      let result
      
      // 第一次尝试
      try {
        result = await db.collection('feedback').add({
          data: feedbackData
        })
      } catch (dbError) {
        console.error('[FeedbackModal] 第一次数据库操作失败:', dbError)
        
        // 如果是权限错误或集合不存在，等待1秒后重试一次
        if (dbError.errMsg && (
          dbError.errMsg.includes('permission') || 
          dbError.errMsg.includes('collection') ||
          dbError.errCode === -502003
        )) {
          console.log('[FeedbackModal] 等待后重试...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          
          result = await db.collection('feedback').add({
            data: feedbackData
          })
        } else {
          throw dbError  // 其他错误直接抛出
        }
      }

      console.log('[FeedbackModal] 提交成功:', result)
      setShowSuccess(true)
      
      setTimeout(() => {
        setShowSuccess(false)
        setContent('')
        setContact('')
        setFeedbackType('suggestion')
        onClose()
        onSuccess()
        
        Taro.showToast({ 
          title: '感谢您的反馈！', 
          icon: 'success',
          duration: 2000 
        })
      }, 1500)

    } catch (error: any) {
      console.error('[FeedbackModal] 提交失败完整错误:', error)
      console.error('[FeedbackModal] 错误码:', error.errCode)
      console.error('[FeedbackModal] 错误消息:', error.errMsg)
      
      // 根据错误类型给出具体提示
      if (error.message === 'USER_NOT_LOGGED_IN') {
        Taro.showToast({ title: '请先登录后再提交反馈', icon: 'none' })
      } else if (error.errCode === -502003) {
        // 权限错误 - 引导用户去创建集合
        Taro.showModal({
          title: '⚠️ 数据库权限错误',
          content: '请在微信云开发控制台创建 "feedback" 集合，并设置所有用户可读写权限。\n\n详细步骤：\n1. 打开微信开发者工具\n2. 点击"云开发"按钮\n3. 进入"数据库"\n4. 点击"+"号添加集合\n5. 输入集合名：feedback\n6. 点击集合 → 权限设置\n7. 选择"所有用户可读写"',
          confirmText: '我知道了',
          showCancel: false,
          success: () => {
            // 可以选择性地复制链接给用户
            console.log('[FeedbackModal] 用户已了解如何修复')
          }
        })
      } else if (error.errMsg && error.errMsg.includes('network')) {
        Taro.showToast({ title: '网络异常，请检查网络后重试', icon: 'none' })
      } else {
        // 其他未知错误
        Taro.showModal({
          title: '提交失败',
          content: `错误信息：${error.errMsg || error.message || '未知错误'}\n\n建议：\n1. 检查网络连接\n2. 确认已登录\n3. 稍后重试`,
          confirmText: '重试',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              handleSubmit()  // 自动重试
            }
          }
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setContent('')
      setContact('')
      setFeedbackType('suggestion')
      setShowSuccess(false)
      onClose()
    }
  }

  if (showSuccess) {
    return (
      <View className='feedback-mask' onClick={handleClose}>
        <View className='feedback-content success-view' onClick={e => e.stopPropagation()}>
          <View className='success-icon'>✅</View>
          <Text className='success-title'>提交成功</Text>
          <Text className='success-desc'>感谢您的宝贵意见，我们会认真处理！</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='feedback-mask' onClick={handleClose}>
      <View className='feedback-content' onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <View className='feedback-header'>
          <Text className='feedback-title'>用户反馈</Text>
          <Text className='feedback-close' onClick={handleClose}>✕</Text>
        </View>

        {/* 反馈类型选择 */}
        <View className='form-section'>
          <Text className='section-label'>反馈类型</Text>
          <Picker 
            mode='selector'
            range={feedbackTypes.map(t => t.label)}
            value={feedbackTypes.findIndex(t => t.value === feedbackType)}
            onChange={handleTypeChange}
          >
            <View className='picker-wrapper'>
              <Text className='picker-text'>
                {feedbackTypes.find(t => t.value === feedbackType)?.label || '请选择'}
              </Text>
              <Text className='picker-arrow'>›</Text>
            </View>
          </Picker>
        </View>

        {/* 反馈内容 */}
        <View className='form-section'>
          <Text className='section-label'>
            反馈内容 <Text className='required'>*</Text>
          </Text>
          <Textarea
            className='feedback-textarea'
            placeholder='请详细描述您的建议或遇到的问题，我们将认真对待每一条反馈...'
            value={content}
            onInput={(e) => setContent(e.detail.value)}
            maxlength={ 500}
            autoHeight
            showConfirmBar={false}
          />
          <Text className={`char-count ${content.length > 450 ? 'warning' : ''}`}>
            {content.length}/500
          </Text>
        </View>

        {/* 联系方式（可选） */}
        <View className='form-section'>
          <Text className='section-label'>
            联系方式 <Text className='optional'>（选填）</Text>
          </Text>
          <Input
            className='contact-input'
            placeholder='微信号或邮箱，方便我们回复您'
            value={contact}
            onInput={(e) => setContact(e.detail.value)}
            maxlength={ 50}
          />
        </View>

        {/* 提示信息 */}
        <View className='tips-section'>
          <Text className='tips-icon'>💡</Text>
          <Text className='tips-text'>
            您的反馈对我们非常重要，我们会尽快处理并持续优化产品体验
          </Text>
        </View>

        {/* 按钮区域 */}
        <View className='button-section'>
          <Button 
            className='cancel-btn'
            onClick={handleClose}
            disabled={submitting}
          >
            取消
          </Button>
          
          <Button 
            className={`submit-btn ${submitting || !content.trim() ? 'disabled' : ''}`}
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
          >
            {submitting ? '提交中...' : '提交反馈'}
          </Button>
        </View>
      </View>
    </View>
  )
}
