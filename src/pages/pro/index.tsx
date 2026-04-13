import { useState, useEffect } from 'react'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getUserSubscription, deleteUserAccount } from '../../utils/storage'
import { requestPayment, PAYMENT_PRICES, formatPrice } from '../../utils/payment'
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

  const handleUpgrade = async (planType: 'monthly' | 'yearly') => {
    try {
      setUpgrading(true)
      Taro.showLoading({ title: '正在创建订单...' })

      // 调用真实支付流程
      const result = await requestPayment(planType)

      Taro.hideLoading()

      if (result.success) {
        // 支付成功
        Taro.showToast({
          title: '🎉 开通成功',
          icon: 'success',
          duration: 2000
        })
        
        // 重新加载订阅状态以刷新UI
        await loadSubscription()
        
        // 延迟返回上一页（可选）
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        // 支付失败或取消
        if (result.error === 'USER_CANCELLED') {
          console.log('[ProPage] 用户取消支付')
          // 用户主动取消，不显示错误提示
        } else {
          Taro.showModal({
            title: '支付失败',
            content: result.message || result.error || '请稍后重试',
            confirmText: '重试',
            cancelText: '稍后再说',
            success: (res) => {
              if (res.confirm) {
                // 用户选择重试
                handleUpgrade(planType)
              }
            }
          })
        }
      }
    } catch (error: any) {
      console.error('[ProPage] 支付异常:', error)
      Taro.hideLoading()
      Taro.showModal({
        title: '支付异常',
        content: error.message || '网络异常，请检查网络后重试',
        showCancel: false,
        confirmText: '知道了'
      })
    } finally {
      setUpgrading(false)
    }
  }

  const handleContact = () => {
    console.log('[handleContact] 点击联系支持')
    Taro.showModal({
      title: '联系开发者',
      content: '微信号：kanshan28\n邮箱：kanshan28@foxmail.com',
      showCancel: false,
      confirmText: '复制',  // 修改为 2 个字符
      success: (res) => {
        console.log('[handleContact] showModal success:', res)
        if (res.confirm) {
          console.log('[handleContact] 开始复制微信号')
          Taro.setClipboardData({
            data: 'kanshan28',
            success: () => {
              console.log('[handleContact] 复制成功')
              Taro.showToast({
                title: '已复制微信号',
                icon: 'success'
              })
            },
            fail: (err) => {
              console.error('[handleContact] 复制失败:', err)
              Taro.showToast({
                title: '复制失败',
                icon: 'none'
              })
            }
          })
        }
      },
      fail: (err) => {
        console.error('[handleContact] showModal fail:', err)
      }
    })
  }

  const handleTerms = () => {
    Taro.navigateTo({
      url: '/pages/terms/index'
    })
  }

  const handlePrivacy = () => {
    Taro.navigateTo({
      url: '/pages/privacy/index'
    })
  }

  const handleDeleteAccount = async () => {
    // 第一次确认
    const confirm1 = await Taro.showModal({
      title: '⚠️ 警告：删除账号',
      content: '此操作将永久删除您的所有数据，包括：\n\n• 所有日记记录\n• 用户资料\n• Pro 会员资格\n\n此操作不可恢复！确定继续吗？',
      confirmText: '继续',
      cancelText: '再想想',
      confirmColor: '#FF3B30'
    })

    if (!confirm1.confirm) {
      return
    }

    // 第二次确认
    const confirm2 = await Taro.showModal({
      title: '最终确认',
      content: '您确定要删除账号吗？\n\n一旦删除，所有数据将永久丢失！',
      confirmText: '确定删除',
      cancelText: '取消',
      confirmColor: '#FF3B30'
    })

    if (!confirm2.confirm) {
      return
    }

    // 执行删除
    try {
      Taro.showLoading({ title: '删除中...' })
      
      const result = await deleteUserAccount()
      
      Taro.hideLoading()
      
      if (result.success) {
        Taro.showModal({
          title: '账号已注销',
          content: `已删除 ${result.deletedEntries || 0} 条日记\n${result.deletedUser ? '用户记录已删除' : ''}`,
          showCancel: false,
          confirmText: '好的'
        })
        
        // 返回首页
        setTimeout(() => {
          Taro.switchTab({
            url: '/pages/index/index'
          })
        }, 1500)
      } else {
        Taro.showModal({
          title: '删除失败',
          content: result.message,
          showCancel: false
        })
      }
    } catch (error) {
      Taro.hideLoading()
      Taro.showModal({
        title: '删除失败',
        content: error.message || '请稍后重试',
        showCancel: false
      })
    }
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
              <Text className='plan-name'>{PAYMENT_PRICES.monthly.label}</Text>
              <View className='plan-price'>
                <Text className='currency'>¥</Text>
                <Text className='price'>{formatPrice(PAYMENT_PRICES.monthly.price * 100)}</Text>
                <Text className='period'>/月</Text>
              </View>
            </View>
            <View className='card-benefits'>
              <Text>• 所有 Pro 功能</Text>
              <Text>• 就像一瓶水的价格</Text>
            </View>
            <Button
              className='upgrade-btn'
              onClick={() => handleUpgrade('monthly')}
              disabled={upgrading}
            >
              {upgrading ? '处理中...' : `开通${PAYMENT_PRICES.monthly.label} (¥${PAYMENT_PRICES.monthly.price})`}
            </Button>
          </View>

          <View className='pricing-card yearly recommended'>
            <View className='recommended-badge'>{PAYMENT_PRICES.yearly.badge}</View>
            <View className='card-header'>
              <Text className='plan-name'>{PAYMENT_PRICES.yearly.label}</Text>
              <View className='plan-price'>
                <Text className='currency'>¥</Text>
                <Text className='price'>{formatPrice(PAYMENT_PRICES.yearly.price * 100)}</Text>
                <Text className='period'>/年</Text>
              </View>
            </View>
            <View className='card-benefits'>
              <Text>• 所有 Pro 功能</Text>
              <Text>• {PAYMENT_PRICES.yearly.saving} 相当于 ¥1.6/月</Text>
              <Text>• 就像一杯奶茶的价格</Text>
              <Text>• 赠送年度心路报告</Text>
            </View>
            <Button
              className='upgrade-btn primary'
              onClick={() => handleUpgrade('yearly')}
              disabled={upgrading}
            >
              {upgrading ? '处理中...' : `开通${PAYMENT_PRICES.yearly.label} (¥${PAYMENT_PRICES.yearly.price}, ${PAYMENT_PRICES.yearly.saving})`}
            </Button>
          </View>
        </View>
      )}

      {/* 底部说明 */}
      <View className='pro-footer'>
        <View className='footer-links'>
          <Text className='footer-link' onClick={handleContact}>联系支持</Text>
          <Text className='footer-divider'>|</Text>
          <Text className='footer-link' onClick={handleTerms}>使用条款</Text>
          <Text className='footer-divider'>|</Text>
          <Text className='footer-link' onClick={handlePrivacy}>隐私政策</Text>
        </View>
        <Text className='footer-disclaimer'>
          支付完成后立即生效，可随时取消续费
        </Text>
      </View>

      {/* 危险区域：注销账号 */}
      <View className='danger-zone'>
        <View className='danger-zone-title'>危险操作</View>
        <View className='danger-zone-desc'>
          <Text>注销账号将删除所有数据，此操作不可恢复</Text>
        </View>
        <Button className='delete-account-btn' onClick={handleDeleteAccount}>
          注销账号
        </Button>
      </View>
    </View>
  )
}
