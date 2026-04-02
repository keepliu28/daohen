import { useState, useEffect } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getUserSubscription, upgradeToPro, SUBSCRIPTION_CONFIG } from '../../utils/storage'
import './index.scss'

const PRO_FEATURES = [
  { icon: '∞', title: '无限深潜记录', desc: '不再受每月 30 条限制，随时记录内心探索' },
  { icon: '🔒', title: '3 位数字密码锁', desc: '童年日记本的记忆，保护最私密的想法' },
  { icon: '☁️', title: '云备份保障', desc: 'Pro 会员专享云端备份，换设备数据不丢失' },
  { icon: '💝', title: '心情印记', desc: '探索情绪背后的真实需求与成长轨迹' }
]

export default function ProPage() {
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    loadSubscription()
  }, [])

  const loadSubscription = async () => {
    try {
      const sub = await getUserSubscription()
      setSubscription(sub)
    } catch (error) {
      console.error('[ProPage] 加载订阅状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (durationMonths: number) => {
    try {
      setUpgrading(true)
      Taro.showLoading({ title: '升级中...' })

      const success = await upgradeToPro(durationMonths)

      Taro.hideLoading()
      if (success) {
        Taro.showToast({
          title: '升级成功',
          icon: 'success',
          duration: 2000
        })
        // 重新加载订阅状态
        await loadSubscription()
      } else {
        Taro.showModal({
          title: '升级失败',
          content: '请稍后重试',
          showCancel: false
        })
      }
    } catch (error) {
      console.error('[ProPage] 升级失败:', error)
      Taro.hideLoading()
      Taro.showModal({
        title: '升级失败',
        content: error.message || '请稍后重试',
        showCancel: false
      })
    } finally {
      setUpgrading(false)
    }
  }

  const handleContact = () => {
    Taro.showModal({
      title: '联系开发者',
      content: '请添加微信：daohen-support 或发送邮件至 support@daohen.com',
      showCancel: false,
      confirmText: '好的'
    })
  }

  if (loading) {
    return (
      <View className='pro-loading'>
        <Text>加载中...</Text>
      </View>
    )
  }

  const isPro = subscription?.isPro
  const proExpiry = subscription?.proExpiry

  return (
    <View className='pro-container'>
      {/* 头部状态 */}
      <View className='pro-header'>
        {isPro ? (
          <View className='pro-status-active'>
            <View className='pro-badge'>Pro 会员</View>
            <Text className='pro-expiry-text'>
              有效期至 {new Date(proExpiry!).toLocaleDateString('zh-CN')}
            </Text>
          </View>
        ) : (
          <View className='pro-status-free'>
            <View className='pro-badge free'>免费版</View>
            <Text className='pro-current-usage'>
              本月已用 {subscription?.entriesThisMonth || 0} / 30 条
            </Text>
          </View>
        )}
      </View>

      {/* Pro 功能列表 */}
      <View className='pro-features'>
        <View className='features-title'>
          <Text className='highlight'>Pro</Text>
          <Text> 会员专属功能</Text>
        </View>
        
        <View className='features-grid'>
          {PRO_FEATURES.map((feature, index) => (
            <View key={index} className='feature-item'>
              <View className='feature-icon'>{feature.icon}</View>
              <View className='feature-content'>
                <Text className='feature-title'>{feature.title}</Text>
                <Text className='feature-desc'>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 价格方案 */}
      {!isPro && (
        <View className='pro-pricing'>
          <View className='pricing-title'>选择适合您的方案</View>
          
          <View className='pricing-card monthly'>
            <View className='card-header'>
              <Text className='plan-name'>月度 Pro</Text>
              <View className='plan-price'>
                <Text className='currency'>¥</Text>
                <Text className='price'>1.9</Text>
                <Text className='period'>/月</Text>
              </View>
            </View>
            <View className='card-benefits'>
              <Text>• 所有 Pro 功能</Text>
              <Text>• 就像一瓶水的价格</Text>
            </View>
            <Button 
              className='upgrade-btn' 
              onClick={() => handleUpgrade(1)}
              disabled={upgrading}
            >
              {upgrading ? '升级中...' : '开通月度 Pro'}
            </Button>
          </View>

          <View className='pricing-card yearly recommended'>
            <View className='recommended-badge'>推荐</View>
            <View className='card-header'>
              <Text className='plan-name'>年度 Pro</Text>
              <View className='plan-price'>
                <Text className='currency'>¥</Text>
                <Text className='price'>19.9</Text>
                <Text className='period'>/年</Text>
              </View>
            </View>
            <View className='card-benefits'>
              <Text>• 所有 Pro 功能</Text>
              <Text>• 省 13% 相当于 ¥1.6/月</Text>
              <Text>• 就像一杯奶茶的价格</Text>
              <Text>• 赠送年度心路报告</Text>
            </View>
            <Button 
              className='upgrade-btn primary' 
              onClick={() => handleUpgrade(12)}
              disabled={upgrading}
            >
              {upgrading ? '升级中...' : '开通年度 Pro (省 13%)'}
            </Button>
          </View>
        </View>
      )}

      {/* 底部说明 */}
      <View className='pro-footer'>
        <View className='footer-links'>
          <Text className='footer-link' onClick={handleContact}>联系支持</Text>
          <Text className='footer-divider'>|</Text>
          <Text className='footer-link'>使用条款</Text>
          <Text className='footer-divider'>|</Text>
          <Text className='footer-link'>隐私政策</Text>
        </View>
        <Text className='footer-disclaimer'>
          支付完成后立即生效，可随时取消续费
        </Text>
      </View>
    </View>
  )
}
