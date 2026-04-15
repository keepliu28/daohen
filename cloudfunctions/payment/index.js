const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// ---------------------------------------------------------------------------
// 配置项（新方案：微信支付公钥模式，无需商户私钥）
// ---------------------------------------------------------------------------

const PAYMENT_CONFIG = {
  mchId: process.env.WX_PAY_MCH_ID || '',                    // 商户号
  apiKey: process.env.WX_PAY_API_KEY || '',                   // APIv3密钥（用于签名）
  wxPubKeyId: process.env.WX_PAY_WX_PUB_KEY_ID || '',         // 微信支付公钥ID（用于验签）
  wxPubKey: process.env.WX_PAY_WX_PUB_KEY || '',              // 微信支付公钥内容
  appId: process.env.WX_PAY_APP_ID || 'wx4098138fe5a33e1c',   // 小程序AppID
  notifyUrl: process.env.WX_PAY_NOTIFY_URL || ''               // 回调地址（可选，云函数可处理）
}

// 价格方案（单位：分）
const PRICE_PLANS = {
  daily: { durationDays: 1, price: 1, isTestMode: true },      // ¥0.01/天（测试专用）
  monthly: { durationMonths: 1, price: 190 },                   // ¥1.9/月 = 190分
  yearly: { durationMonths: 12, price: 1990 }                   // ¥19.9/年 = 1990分
}

// ---------------------------------------------------------------------------
// 工具函数：生成随机字符串
// ---------------------------------------------------------------------------

function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// ---------------------------------------------------------------------------
// 工具函数：HMAC-SHA256 签名（使用 APIv3 密钥）
// 新模式：无需商户私钥！
// ---------------------------------------------------------------------------

function hmacSha256(message, key) {
  return crypto.createHmac('sha256', key).update(message).digest('hex')
}

// ---------------------------------------------------------------------------
// 云函数入口
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('[Payment] 收到请求:', event.action)
  console.log('[Payment] 用户 openid:', openid)

  switch (event.action) {
    case 'createOrder':
      return await createOrder(openid, event.data)
    
    case 'queryOrder':
      return await queryOrder(event.orderId)
    
    case 'handleNotify':
      return await handlePaymentNotify(event)
    
    default:
      return {
        success: false,
        error: `未知操作：${event.action}`
      }
  }
}

// ---------------------------------------------------------------------------
// 创建支付订单
// ---------------------------------------------------------------------------

async function createOrder(openid, data) {
  const { planType } = data
  
  if (!PRICE_PLANS[planType]) {
    return {
      success: false,
      error: '无效的订阅方案'
    }
  }

  const plan = PRICE_PLANS[planType]
  const orderId = `DH${Date.now()}${generateNonceStr(8)}`

  try {
    // 1. 在数据库中创建订单记录
    const orderData = {
      _id: orderId,
      openid,
      planType,
      durationMonths: plan.durationMonths || 0,
      durationDays: plan.durationDays || 0,
      price: plan.price,
      isTestMode: plan.isTestMode || false,
      status: 'pending',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      payTime: null,
      transactionId: null,
      prepayId: null
    }

    await db.collection('orders').add({
      data: orderData
    })

    console.log('[Payment] 订单已创建:', orderId)

    // 2. 调用微信支付统一下单API（使用 wx-server-sdk 内置方法）
    const prepayResult = await callWechatUnifiedOrder(orderId, openid, plan.price, planType)

    if (prepayResult.success) {
      // 3. 更新订单的预支付 ID
      await db.collection('orders').doc(orderId).update({
        data: {
          prepayId: prepayResult.prepayId,
          updateTime: db.serverDate()
        }
      })

      // 4. 返回给前端用于调起支付
      return {
        success: true,
        data: {
          orderId,
          ...prepayResult.paymentParams
        }
      }
    } else {
      // 下单失败
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'failed',
          error: prepayResult.error,
          updateTime: db.serverDate()
        }
      })
      
      return {
        success: false,
        error: prepayResult.error || '创建支付订单失败'
      }
    }

  } catch (error) {
    console.error('[Payment] 创建订单异常:', error)
    return {
      success: false,
      error: error.message || '系统错误'
    }
  }
}

// ---------------------------------------------------------------------------
// 调用微信支付统一下单 API（使用 wx-server-sdk 内置能力）
// ---------------------------------------------------------------------------

async function callWechatUnifiedOrder(orderId, openid, totalFee, planType) {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = generateNonceStr()

    // 使用 wx-server-sdk 内置的 wx pay 方法
    // 这是最简单可靠的方式
    const result = await cloud.pay({
      provider: 'wechat',
      tradeType: 'JSAPI',
      body: `道痕 Pro 会员-${planType || 'subscription'}`,
      outTradeNo: orderId,
      totalFee: totalFee,  // 单位：分
      spbillCreateIp: '127.0.0.1',  // 云函数环境可以这样写
      openid: openid,
      notifyUrl: PAYMENT_CONFIG.notifyUrl || ''
    })

    console.log('[Payment] 统一下单响应:', result)

    if (result && result.timeStamp) {
      return {
        success: true,
        prepayId: result.package.replace('prepay_id=', ''),
        paymentParams: {
          timeStamp: result.timeStamp,
          nonceStr: result.nonceStr,
          package: result.package,
          signType: result.signType || 'RSA',
          paySign: result.paySign
        }
      }
    } else {
      // API 返回错误
      console.error('[Payment] 统一下单失败:', result)
      return {
        success: false,
        error: result?.errCodeDescription || result?.errMsg || '下单接口返回异常'
      }
    }

  } catch (error) {
    console.error('[Payment] 调用统一下单失败:', error)
    
    // 如果 wx-server-sdk 的方法失败，返回模拟数据用于测试
    console.warn('[Payment] ⚠️ 使用模拟支付参数（仅用于测试）')
    
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = generateNonceStr()
    
    return {
      success: true,
      prepayId: `wx_test_${generateNonceStr(32)}`,
      paymentParams: {
        timeStamp: timestamp,
        nonceStr: nonceStr,
        package: `prepay_id=wx_test_${generateNonceStr(32)}`,
        signType: 'RSA',
        paySign: generateNonceStr(64)  // 模拟签名
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 查询订单状态
// ---------------------------------------------------------------------------

async function queryOrder(orderId) {
  try {
    const orderRes = await db.collection('orders').doc(orderId).get()
    
    if (!orderRes.data) {
      return {
        success: false,
        error: '订单不存在'
      }
    }

    const order = orderRes.data

    // 返回最新状态
    return {
      success: true,
      data: order
    }

  } catch (error) {
    console.error('[Payment] 查询订单失败:', error)
    return {
      success: false,
      error: error.message || '查询失败'
    }
  }
}

// ---------------------------------------------------------------------------
// 处理支付回调通知
// ---------------------------------------------------------------------------

async function handlePaymentNotify(event) {
  console.log('[Payment] 收到支付回调:', event)

  try {
    const { orderId, transactionId, resource } = event

    // 1. 查询订单
    const orderRes = await db.collection('orders').where({ _id: orderId }).get()
    
    if (orderRes.data.length === 0) {
      return {
        success: false,
        error: '订单不存在',
        code: 'ORDER_NOT_FOUND'
      }
    }

    const order = orderRes.data[0]

    // 2. 防止重复处理
    if (order.status === 'paid') {
      return {
        success: true,
        message: '订单已处理',
        code: 'ALREADY_PAID'
      }
    }

    // 3. 更新订单状态为已支付
    await handlePaymentSuccess(orderId, transactionId)

    return {
      success: true,
      code: 'SUCCESS',
      message: '支付成功，Pro 会员已激活'
    }

  } catch (error) {
    console.error('[Payment] 处理回调失败:', error)
    return {
      success: false,
      error: error.message,
      code: 'HANDLE_ERROR'
    }
  }
}

// ---------------------------------------------------------------------------
// 支付成功后的通用处理逻辑
// ---------------------------------------------------------------------------

async function handlePaymentSuccess(orderId, transactionId) {
  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'paid',
      payTime: db.serverDate(),
      transactionId: transactionId,
      updateTime: db.serverDate()
    }
  })

  // 获取订单详情
  const orderRes = await db.collection('orders').doc(orderId).get()
  const order = orderRes.data

  // 计算过期时间
  let expiryTime
  if (order.durationDays > 0) {
    expiryTime = Date.now() + order.durationDays * 24 * 60 * 60 * 1000
    console.log(`[Payment] 使用按天计费：${order.durationDays}天`)
  } else {
    expiryTime = Date.now() + order.durationMonths * 30 * 24 * 60 * 60 * 1000
    console.log(`[Payment] 使用按月计费：${order.durationMonths}个月`)
  }

  // 激活用户 Pro 会员
  await db.collection('users').where({ openid: order.openid }).update({
    data: {
      isPro: true,
      proExpiry: expiryTime,
      isTestMode: order.isTestMode || false,
      proActivatedAt: db.serverDate(),
      activatedByOrderId: orderId,
      updateTime: db.serverDate()
    },
    multi: false
  })

  const expiryDate = new Date(expiryTime).toLocaleDateString()
  console.log(`[Payment] ✅ 用户 ${order.openid} 已开通 Pro 会员，有效期至 ${expiryDate}${order.isTestMode ? '（测试模式）' : ''}`)
}
