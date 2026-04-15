import { useState, useEffect } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import './index.scss'

interface OrderItem {
  _id: string
  planType: 'daily' | 'monthly' | 'yearly'
  durationMonths: number
  durationDays: number
  price: number
  isTestMode: boolean
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  createTime: string
  payTime: string | null
  transactionId: string | null
}

const PLAN_LABELS = {
  daily: { name: '体验会员', color: '#FF9500', icon: '🧪' },
  monthly: { name: '月度Pro', color: '#007AFF', icon: '📅' },
  yearly: { name: '年度Pro', color: '#34C759', icon: '📆' }
}

const STATUS_CONFIG = {
  pending: { label: '待支付', color: '#FF9500', bg: '#FFF5E6' },
  paid: { label: '已支付', color: '#34C759', bg: '#E6F9ED' },
  failed: { label: '失败', color: '#FF3B30', bg: '#FFE6E6' },
  refunded: { label: '已退款', color: '#8E8E93', bg: '#F2F2F7' }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'paid'>('all')

  useDidShow(() => {
    loadOrders()
  })

  const loadOrders = async () => {
    try {
      setLoading(true)
      const db = Taro.cloud.database()
      
      // 获取当前用户openid
      const { result } = await Taro.cloud.callFunction({
        name: 'login'
      })
      const openid = result?.data?.openid

      if (!openid) {
        console.warn('[Orders] 未登录')
        return
      }

      // 查询用户的所有订单（按时间倒序）
      const res = await db.collection('orders')
        .where({ openid })
        .orderBy('createTime', 'desc')
        .get()

      setOrders(res.data as OrderItem[])
    } catch (error) {
      console.error('[Orders] 加载订单失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  // 过滤订单
  const filteredOrders = orders.filter(order => {
    if (activeTab === 'all') return true
    if (activeTab === 'pending') return order.status === 'pending'
    if (activeTab === 'paid') return order.status === 'paid'
    return true
  })

  // 格式化时间
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '-'
    const date = new Date(timeStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  // 格式化价格
  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2)
  }

  // 点击订单查看详情
  const handleOrderClick = (order: OrderItem) => {
    Taro.showModal({
      title: '订单详情',
      content: [
        `订单号：${order._id}`,
        `方案：${PLAN_LABELS[order.planType]?.name || order.planType}`,
        `价格：¥${formatPrice(order.price)}`,
        `状态：${STATUS_CONFIG[order.status]?.label}`,
        `创建时间：${formatTime(order.createTime)}`,
        order.payTime ? `支付时间：${formatTime(order.payTime)}` : '',
        order.transactionId ? `交易号：${order.transactionId}` : ''
      ].filter(Boolean).join('\n'),
      showCancel: false,
      confirmText: '知道了'
    })
  }

  return (
    <View className='orders-page'>
      {/* 顶部导航栏 */}
      <View className='header'>
        <Text className='title'>我的订单</Text>
        <Text className='subtitle'>会员购买记录</Text>
      </View>

      {/* Tab 切换 */}
      <View className='tabs'>
        <View 
          className={`tab-item ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <Text>全部</Text>
          <View className='tab-badge'>{orders.length}</View>
        </View>
        <View 
          className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <Text>待支付</Text>
          <View className='tab-badge'>{orders.filter(o => o.status === 'pending').length}</View>
        </View>
        <View 
          className={`tab-item ${activeTab === 'paid' ? 'active' : ''}`}
          onClick={() => setActiveTab('paid')}
        >
          <Text>已完成</Text>
          <View className='tab-badge'>{orders.filter(o => o.status === 'paid').length}</View>
        </View>
      </View>

      {/* 订单列表 */}
      <ScrollView scrollY className='orders-list'>
        {loading ? (
          <View className='loading-container'>
            <Text className='loading-text'>加载中...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className='empty-container'>
            <Text className='empty-icon'>📦</Text>
            <Text className='empty-title'>暂无订单</Text>
            <Text className='empty-desc'>去开通 Pro 会员吧</Text>
          </View>
        ) : (
          filteredOrders.map((order) => (
            <View 
              key={order._id} 
              className='order-card'
              onClick={() => handleOrderClick(order)}
            >
              {/* 卡片头部 */}
              <View className='card-header'>
                <View className='plan-info'>
                  <Text className='plan-icon'>
                    {PLAN_LABELS[order.planType]?.icon || '💎'}
                  </Text>
                  <View className='plan-details'>
                    <Text className='plan-name'>
                      {PLAN_LABELS[order.planType]?.name || '会员订阅'}
                    </Text>
                    <Text className='plan-desc'>
                      {order.isTestMode ? '测试模式 · ' : ''}
                      {order.durationDays > 0 
                        ? `${order.durationDays}天` 
                        : `${order.durationMonths}个月`
                      }
                    </Text>
                  </View>
                </View>
                <View 
                  className='status-tag'
                  style={{ 
                    backgroundColor: STATUS_CONFIG[order.status]?.bg,
                    color: STATUS_CONFIG[order.status]?.color
                  }}
                >
                  <Text>{STATUS_CONFIG[order.status]?.label}</Text>
                </View>
              </View>

              {/* 价格信息 */}
              <View className='card-body'>
                <View className='price-info'>
                  <Text className='price-label'>实付金额</Text>
                  <Text className='price-value'>¥{formatPrice(order.price)}</Text>
                </View>
                
                <View className='order-meta'>
                  <Text className='meta-item'>
                    订单号：{order._id.slice(-8)}
                  </Text>
                  <Text className='meta-item'>
                    {formatTime(order.createTime)}
                  </Text>
                </View>
              </View>

              {/* 底部操作 */}
              {order.status === 'pending' && (
                <View className='card-footer'>
                  <Text className='action-btn cancel'>取消订单</Text>
                  <Text 
                    className='action-btn primary'
                    onClick={(e) => {
                      e.stopPropagation()
                      Taro.navigateTo({ url: '/pages/pro/index' })
                    }}
                  >
                    立即支付
                  </Text>
                </View>
              )}

              {order.status === 'paid' && (
                <View className='card-footer'>
                  <Text 
                    className='action-btn secondary'
                    onClick={(e) => {
                      e.stopPropagation()
                      Taro.navigateTo({ url: '/pages/profile/index' })
                    }}
                  >
                    查看权益
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* 底部提示 */}
      {!loading && orders.length > 0 && (
        <View className='footer-tip'>
          <Text>· 如有疑问请联系客服</Text>
          <Text>· 测试订单24小时后自动失效</Text>
        </View>
      )}
    </View>
  )
}
