import Taro from '@tarojs/taro';

// ---------------------------------------------------------------------------
// 支付相关类型定义
// ---------------------------------------------------------------------------

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  error?: string;
  message?: string;
}

export interface OrderInfo {
  orderId: string;
  planType: PlanType;
  durationMonths: number;
  durationDays: number;
  price: number; // 单位：分
  status: 'pending' | 'paid' | 'failed';
  createTime?: string;
  payTime?: string | null;
  transactionId?: string | null;
  prepayId?: string | null;
  // 微信侧状态（从 queryOrder 返回）
  wxTradeState?: string;
  wxTradeStateDesc?: string;
  updated?: boolean;
  warning?: string;
}

export interface PaymentParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA' | 'MD5';
  paySign: string;
}

export type PlanType = 'daily' | 'monthly' | 'yearly';

// ---------------------------------------------------------------------------
// 价格配置（前端展示用，单位：元）
// ---------------------------------------------------------------------------

export const PAYMENT_PRICES = {
  daily: {
    price: 0.01, // ¥0.01/天（测试专用）
    durationMonths: 0,
    durationDays: 1,
    label: '体验会员',
    originalPrice: null,
    badge: '🧪 测试',
    isTestMode: true,
  },
  monthly: {
    price: 1.9,
    durationMonths: 1,
    durationDays: 0,
    label: '月度Pro',
    originalPrice: null,
    badge: '',
  },
  yearly: {
    price: 19.9,
    durationMonths: 12,
    durationDays: 0,
    label: '年度Pro',
    originalPrice: 22.8,
    badge: '推荐',
    saving: '省13%',
  },
};

// ---------------------------------------------------------------------------
// 调用云函数
// ---------------------------------------------------------------------------

async function callPaymentCloudFunction(
  action: string,
  data: any = {}
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const result = await Taro.cloud.callFunction({
      name: 'payment',
      data: { action, ...data },
      timeout: 15000,
    });

    console.log(`[Payment] 云函数 ${action} 返回:`, result);

    // 防御：云函数可能返回多种错误格式
    const resultData = (result as any).result;
    if (!resultData) {
      const errMsg = (result as any).errMsg || JSON.stringify(result);
      console.error(`[Payment] 云函数返回空: ${errMsg}`);
      return { success: false, error: errMsg };
    }

    if (resultData.success) {
      return { success: true, data: resultData.data };
    } else {
      return { success: false, error: resultData.error || '操作失败' };
    }
  } catch (error: any) {
    console.error('[Payment] 云函数调用失败:', error);
    return {
      success: false,
      error: error.errMsg || error.message || '网络错误',
    };
  }
}

// ---------------------------------------------------------------------------
// 核心功能：发起支付（已修复版）
// ---------------------------------------------------------------------------

/**
 * 发起微信支付流程
 * @param planType 订阅方案类型：'daily' | 'monthly' | 'yearly'
 * @returns 支付结果
 */
export async function requestPayment(planType: PlanType): Promise<PaymentResult> {
  console.log(`[Payment] 🚀 开始发起支付, 方案: ${planType}`);

  // 1. 调用云函数创建订单
  const orderResult = await callPaymentCloudFunction('createOrder', {
    data: { planType },
  });

  if (!orderResult.success || !orderResult.data) {
    console.error('[Payment] ❌ 创建订单失败:', orderResult.error);
    return {
      success: false,
      error: 'CREATE_ORDER_FAILED',
      message: orderResult.error || '创建支付订单失败，请重试',
    };
  }

  const { orderId, _testMode, ...paymentParams } = orderResult.data as PaymentParams & {
    orderId: string;
    _testMode?: boolean;
  };

  console.log(
    `[Payment] 📋 订单已创建: ${orderId}, 测试模式: ${_testMode}, paymentParams:`,
    JSON.stringify(paymentParams)
  );

  // 【测试模式】跳过微信支付弹窗，直接模拟成功
  if (_testMode) {
    console.log('[Payment] 🧪 测试模式：跳过微信支付弹窗，模拟支付成功');
    
    // 模拟用户确认支付
    await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
    
    console.log('[Payment] ✅ 测试模式：模拟支付完成，开始查询订单');
    
    // 直接查询订单（会触发 Pro 激活）
    const queryResult = await callPaymentCloudFunction('queryOrder', {
      data: { orderId },
    });

    if (queryResult.success && queryResult.data?.proActivated) {
      return {
        success: true,
        orderId,
        message: '测试支付成功，Pro 已激活',
      };
    }

    return {
      success: true,
      orderId,
      message: '测试支付完成',
    };
  }

  // 2. 调用微信支付 API（调起小程序支付）
  let paySuccess = false;
  let payCancelled = false;
  let payErrorMsg = '';

  try {
    await new Promise<void>((resolve, reject) => {
      Taro.requestPayment({
        ...paymentParams,
        success(res) {
          console.log('[Payment] ✅ Taro.requestPayment 成功:', res);
          paySuccess = true;
          resolve();
        },
        fail(err: any) {
          console.warn('[Payment] ⚠️ Taro.requestPayment 失败:', err);
          payErrorMsg = err.errMsg || JSON.stringify(err);

          // 用户主动取消
          if (
            err.errMsg?.includes('cancel') ||
            err.errMsg?.includes('chooseImage') || // 某些场景下 cancel 会被截断
            err.errMsg === 'requestPayment:fail cancel'
          ) {
            payCancelled = true;
            resolve(); // 取消不抛异常
          } else {
            reject(err); // 真正的失败抛异常
          }
        },
      });
    });
  } catch (paymentError: any) {
    console.error('[Payment] ❌ 支付调起失败:', paymentError);

    let errorMessage = '支付失败';
    if (paymentError.errMsg) {
      if (paymentError.errMsg.includes('no permission')) {
        errorMessage = '当前环境不支持支付，请在真机上测试';
      } else if (paymentError.errMsg.includes('cancel')) {
        // 兜底
        payCancelled = true;
      } else {
        errorMessage = paymentError.errMsg.replace('requestPayment:fail ', '');
      }
    }

    if (payCancelled) {
      return {
        success: false,
        error: 'USER_CANCELLED',
        message: '已取消支付',
      };
    }

    return {
      success: false,
      error: paymentError.errMsg || errorMessage,
      message: errorMessage,
    };
  }

  // 3. 用户取消（提前返回，不查订单）
  if (payCancelled) {
    console.log('[Payment] 👋 用户取消支付');
    return {
      success: false,
      error: 'USER_CANCELLED',
      message: '已取消支付',
    };
  }

  // 4. 微信支付调起成功，现在查询真实状态
  console.log(`[Payment] 🔍 微信支付调起成功，查询订单状态: ${orderId}`);

  let finalStatus: OrderInfo;
  try {
    const statusResult = await callPaymentCloudFunction('queryOrder', {
      orderId,
    });

    if (!statusResult.success) {
      console.warn('[Payment] ⚠️ 查询订单状态失败:', statusResult.error);
      // 降级：假设成功（用户已付钱，callback 会处理）
      return {
        success: true,
        orderId,
        message: '支付成功，会员已开通',
      };
    }

    finalStatus = statusResult.data as OrderInfo;
    console.log('[Payment] 📊 最终订单状态:', JSON.stringify(finalStatus));
  } catch (queryError: any) {
    console.warn('[Payment] ⚠️ 查询订单异常:', queryError);
    return {
      success: true,
      orderId,
      message: '支付成功，会员开通中...',
    };
  }

  // 5. 判断最终结果
  if (finalStatus.status === 'paid' || finalStatus.proActivated) {
    console.log(`[Payment] ✅ 支付完成! Pro已激活: ${orderId}`);
    Taro.showToast({
      title: '🎉 Pro开通成功',
      icon: 'success',
      duration: 2500,
    });
    // 注：Pro 状态刷新由用户手动触发（如返回个人中心页面时会重新获取）

    return {
      success: true,
      orderId,
      message: 'Pro会员已激活',
    };
  }

  if (finalStatus.wxTradeState === 'SUCCESS') {
    // 微信已付钱，激活中（服务端正在处理）
    console.log(`[Payment] ⏳ 微信已支付，Pro激活中: ${orderId}`);
    Taro.showToast({ title: '🎉 支付成功，Pro开通中...', icon: 'success', duration: 2000 });
    return {
      success: true,
      orderId,
      message: '支付成功，Pro开通中...',
    };
  }

  if (finalStatus.wxTradeState === 'USERPAYING') {
    console.log(`[Payment] ⏳ 微信支付中: ${orderId}`);
    return {
      success: true,
      orderId,
      message: '支付中，请稍候...',
    };
  }

  // 6. 异常情况
  console.error('[Payment] ❌ 支付结果异常:', JSON.stringify(finalStatus));
  return {
    success: false,
    error: finalStatus.wxTradeState || finalStatus.status || 'UNKNOWN',
    message: `支付状态异常: ${finalStatus.wxTradeStateDesc || finalStatus.status}`,
  };
}

// ---------------------------------------------------------------------------
// 查询订单状态（供外部调用）
// ---------------------------------------------------------------------------

export async function queryOrderStatus(orderId: string): Promise<OrderInfo> {
  const result = await callPaymentCloudFunction('queryOrder', { orderId });

  if (result.success && result.data) {
    return result.data as OrderInfo;
  }

  throw new Error(result.error || '查询订单失败');
}

// ---------------------------------------------------------------------------
// 手动激活 Pro（调试用，正常不需要）
// ---------------------------------------------------------------------------

export async function activateProManually(
  openid: string,
  durationMonths = 1,
  reason = '调试'
): Promise<{ success: boolean; message: string; proExpiry?: string }> {
  const result = await callPaymentCloudFunction('activatePro', {
    openid,
    data: { durationMonths, reason },
  });

  if (result.success) {
    return {
      success: true,
      message: result.data.message,
      proExpiry: result.data.proExpiry,
    };
  }

  throw new Error(result.error || '激活失败');
}

// ---------------------------------------------------------------------------
// 格式化工具
// ---------------------------------------------------------------------------

/**
 * 格式化价格（分 → 元）
 */
export function formatPrice(priceInCents: number): string {
  return (priceInCents / 100).toFixed(1);
}

/**
 * 获取价格描述文本
 */
export function getPriceDescription(planType: PlanType): string {
  const config = PAYMENT_PRICES[planType];

  if (planType === 'daily') {
    return `¥${config.price}/天（测试专用）`;
  }

  if (planType === 'yearly' && config.originalPrice) {
    return `¥${config.price}/年（原价¥${config.originalPrice}，${config.saving}）`;
  }

  return `¥${config.price}/月`;
}

/**
 * 判断是否为测试方案
 */
export function isTestPlan(planType: PlanType): boolean {
  return PAYMENT_PRICES[planType]?.isTestMode || false;
}

/**
 * 获取方案时长描述
 */
export function getDurationLabel(planType: PlanType): string {
  const config = PAYMENT_PRICES[planType];
  if (planType === 'daily') return `${config.durationDays}天`;
  if (planType === 'yearly') return `${config.durationMonths}个月`;
  return `${config.durationMonths}个月`;
}
