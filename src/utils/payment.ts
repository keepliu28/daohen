import Taro from '@tarojs/taro'

// ---------------------------------------------------------------------------
// 支付相关类型定义
// ---------------------------------------------------------------------------

export interface PaymentResult {
  success: boolean
  orderId?: string
  error?: string
  message?: string
}

export interface OrderInfo {
  orderId: string
  planType: 'monthly' | 'yearly'
  durationMonths: number
  price: number        // 单位：分
  status: 'pending' | 'paid' | 'failed'
  createTime?: string
  payTime?: string | null
}

export interface PaymentParams {
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA' | 'MD5'
  paySign: string
}

export type PlanType = 'daily' | 'monthly' | 'yearly'

// ---------------------------------------------------------------------------
// 价格配置（单位：元）
// ---------------------------------------------------------------------------

export const PAYMENT_PRICES = {
  daily: {
    price: 0.01,            // ¥0.01/天（测试专用）
    durationMonths: 0,      // 0个月，使用天数
    durationDays: 1,        // 1天
    label: '体验会员',
    originalPrice: null,
    badge: '🧪 测试',
    isTestMode: true        // 标记为测试模式
  },
  monthly: {
    price: 1.9,           // ¥1.9/月
    durationMonths: 1,
    label: '月度Pro',
    originalPrice: null,
    badge: ''
  },
  yearly: {
    price: 19.9,          // ¥19.9/年
    durationMonths: 12,
    label: '年度Pro',
    originalPrice: 22.8,   // 原价 ¥1.9×12
    badge: '推荐',
    saving: '省13%'
  }
}

// ---------------------------------------------------------------------------
// 调用云函数
// ---------------------------------------------------------------------------

async function callPaymentCloudFunction(action: string, data: any = {}): Promise<any> {
  try {
    const result = await Taro.cloud.callFunction({
      name: 'payment',
      data: { action, ...data }
    })

    console.log(`[Payment] 云函数 ${action} 返回:`, result)

    if (result.result && result.result.success) {
      return {
        success: true,
        data: result.result.data
      }
    } else {
      return {
        success: false,
        error: result.result?.error || '操作失败'
      }
    }
  } catch (error: any) {
    console.error('[Payment] 云函数调用失败:', error)
    return {
      success: false,
      error: error.errMsg || error.message || '网络错误'
    }
  }
}

// ---------------------------------------------------------------------------
// 核心功能：发起支付
// ---------------------------------------------------------------------------

/**
 * 发起微信支付流程
 * @param planType 订阅方案类型：'daily'(测试/天) | 'monthly'(月度) | 'yearly'(年度)
 * @returns 支付结果
 */
export async function requestPayment(planType: PlanType): Promise<PaymentResult> {
  console.log(`[Payment] 开始发起支付, 方案: ${planType}`)

  try {
    // 1. 调用云函数创建订单
    const orderResult = await callPaymentCloudFunction('createOrder', {
      data: { planType }
    })

    if (!orderResult.success || !orderResult.data) {
      console.error('[Payment] 创建订单失败:', orderResult.error)
      return {
        success: false,
        error: orderResult.error || '创建支付订单失败'
      }
    }

    const { orderId, ...paymentParams } = orderResult.data as PaymentParams & { orderId: string }

    console.log(`[Payment] 订单已创建: ${orderId}, 准备调起支付...`)

    // 2. 调用微信支付API
    const payResult = await new Promise<WechatMiniprogram.RequestPaymentSuccessCallbackResult>((resolve, reject) => {
      Taro.requestPayment({
        ...paymentParams,
        success(res) {
          console.log('[Payment] 微信支付成功:', res)
          resolve(res)
        },
        fail(err: any) {
          console.warn('[Payment] 微信支付失败/取消:', err)
          
          // 用户取消支付不视为错误
          if (err.errMsg?.includes('cancel')) {
            resolve({ errMsg: '用户取消支付' } as any)
          } else {
            reject(err)
          }
        }
      })
    })

    // 3. 检查支付结果
    if (payResult.errMsg === 'requestPayment:ok' || payResult.errMsg === '用户取消支付') {
      // 如果是成功或取消，查询最终订单状态
      const finalStatus = await queryOrderStatus(orderId)
      
      if (finalStatus.status === 'paid') {
        console.log(`[Payment] ✅ 支付完成! 订单ID: ${orderId}`)
        
        // 显示成功提示
        Taro.showToast({
          title: '🎉 开通成功',
          icon: 'success',
          duration: 2000
        })

        return {
          success: true,
          orderId,
          message: 'Pro会员已激活'
        }
      } else if (payResult.errMsg === '用户取消支付') {
        return {
          success: false,
          error: 'USER_CANCELLED',
          message: '已取消支付'
        }
      } else {
        return {
          success: false,
          error: 'PAYMENT_PENDING',
          message: '支付处理中，请稍后查看'
        }
      }
    } else {
      return {
        success: false,
        error: payResult.errMsg || '支付失败',
        message: '支付失败，请重试'
      }
    }

  } catch (error: any) {
    console.error('[Payment] 支付流程异常:', error)
    
    // 处理常见错误
    let errorMessage = '支付失败'
    
    if (error.errMsg?.includes('requestPayment:fail')) {
      if (error.errMsg.includes('no permission')) {
        errorMessage = '当前环境不支持支付，请在真机上测试'
      } else {
        errorMessage = error.errMsg.replace('requestPayment:fail ', '')
      }
    }

    return {
      success: false,
      error: error.errMsg || errorMessage,
      message: errorMessage
    }
  }
}

// ---------------------------------------------------------------------------
// 辅助功能：查询订单状态
// ---------------------------------------------------------------------------

/**
 * 查询订单状态
 * @param orderId 订单ID
 */
export async function queryOrderStatus(orderId: string): Promise<OrderInfo> {
  const result = await callPaymentCloudFunction('queryOrder', { orderId })
  
  if (result.success && result.data) {
    return result.data as OrderInfo
  }
  
  throw new Error(result.error || '查询订单失败')
}

// ---------------------------------------------------------------------------
// 辅助功能：格式化价格显示
// ---------------------------------------------------------------------------

/**
 * 格式化价格（分 → 元）
 * @param priceInCents 价格（单位：分）
 */
export function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toFixed(1)
}

/**
 * 获取价格描述文本
 * @param planType 方案类型
 */
export function getPriceDescription(planType: PlanType): string {
  const config = PAYMENT_PRICES[planType]

  if (planType === 'daily') {
    return `¥${config.price}/天（测试专用）`
  }

  if (planType === 'yearly' && config.originalPrice) {
    return `¥${config.price}/年（原价¥${config.originalPrice}，${config.saving}）`
  }

  return `¥${config.price}/月`
}

/**
 * 判断是否为测试方案
 * @param planType 方案类型
 */
export function isTestPlan(planType: PlanType): boolean {
  return PAYMENT_PRICES[planType]?.isTestMode || false
}
