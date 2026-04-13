const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// ---------------------------------------------------------------------------
// 配置项（需要在商户平台获取）
// ---------------------------------------------------------------------------

const PAYMENT_CONFIG = {
  // ⚠️ 这些值需要替换为你的真实配置
  mchId: process.env.WX_PAY_MCH_ID || '',              // 商户号
  apiKey: process.env.WX_PAY_API_KEY || '',             // APIv3密钥
  serialNo: process.env.WX_PAY_SERIAL_NO || '',         // 商户证书序列号
  privateKey: process.env.WX_PAY_PRIVATE_KEY || '',     // 商户私钥
  notifyUrl: process.env.WX_PAY_NOTIFY_URL || 'https://your-domain.com/api/payment/notify'  // 回调地址
}

// 价格方案（单位：分）
const PRICE_PLANS = {
  daily: { durationDays: 1, price: 1, isTestMode: true },      // ¥0.01/天（测试专用）
  monthly: { durationMonths: 1, price: 190 },    // ¥1.9/月 = 190分
  yearly: { durationMonths: 12, price: 1990 }     // ¥19.9/年 = 1990分
}

// ---------------------------------------------------------------------------
// 工具函数：签名生成（RSASSA-PKCS1-v1_5）
// ---------------------------------------------------------------------------

function sign(params, privateKey) {
  const signStr = JSON.stringify(params)
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(signStr)
  sign.end()
  return sign.sign(privateKey, 'base64')
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
// 云函数入口
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  console.log('[Payment] 收到请求:', event.action)
  console.log('[Payment] 用户openid:', openid)

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
        error: `未知操作: ${event.action}`
      }
  }
}

// ---------------------------------------------------------------------------
// 创建支付订单
// ---------------------------------------------------------------------------

async function createOrder(openid, data) {
  const { planType } = data  // 'monthly' | 'yearly'
  
  if (!PRICE_PLANS[planType]) {
    return {
      success: false,
      error: '无效的订阅方案'
    }
  }

  const plan = PRICE_PLANS[planType]
  const orderId = `DH${Date.now()}${generateNonceStr(8)}`
  const now = new Date()

  try {
    // 1. 在数据库中创建订单记录
    const orderData = {
      _id: orderId,
      openid,
      planType,
      durationMonths: plan.durationMonths || 0,
      durationDays: plan.durationDays || 0,      // 支持按天计费
      price: plan.price,                    // 单位：分
      isTestMode: plan.isTestMode || false, // 标记测试订单
      status: 'pending',                    // pending → paid → failed
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      payTime: null,
      transactionId: null,
      prepayId: null                       // 预支付ID，后续填充
    }

    await db.collection('orders').add({
      data: orderData
    })

    console.log('[Payment] 订单已创建:', orderId)

    // 2. 调用微信支付统一下单API
    const prepayResult = await callWechatUnifiedOrder(orderId, openid, plan.price)

    if (prepayResult.success) {
      // 3. 更新订单的预支付ID
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
          ...prepayResult.paymentParams   // 包含timeStamp, nonceStr, package, signType, paySign
        }
      }
    } else {
      // 下单失败，更新订单状态
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
// 调用微信支付统一下单API（JSAPI）
// ---------------------------------------------------------------------------

async function callWechatUnifiedOrder(orderId, openid, totalFee) {
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = generateNonceStr()

    // 构建请求参数
    const params = {
      appid: wxContext.APPID || 'wx4098138fe5a33e1c',
      mch_id: PAYMENT_CONFIG.mchId,
      description: `道痕Pro会员-${orderId}`,
      out_trade_no: orderId,
      notify_url: PAYMENT_CONFIG.notifyUrl,
      amount: {
        total: totalFee,
        currency: 'CNY'
      },
      payer: {
        openid: openid
      }
    }

    // TODO: 这里需要实际调用微信支付API
    // 当前返回模拟数据用于测试
    // 正式环境需要使用 axios/fetch 调用 https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi
    
    console.log('[Payment] 模拟调用统一下单API:', params)

    // 返回模拟的支付参数（正式环境需要替换为真实API调用结果）
    return {
      success: true,
      prepayId: `wx${generateNonceStr(32)}`,
      paymentParams: {
        timeStamp: timestamp,
        nonceStr: nonceStr,
        package: `prepay_id=wx${generateNonceStr(32)}`,
        signType: 'RSA',
        paySign: generateNonceStr(64)     // 正式环境需要用私钥签名
      }
    }

  } catch (error) {
    console.error('[Payment] 调用统一下单失败:', error)
    return {
      success: false,
      error: error.message || '调用支付接口失败'
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

    // 如果订单还是pending状态，尝试查询微信支付状态
    if (order.status === 'pending') {
      // TODO: 调用微信支付查询接口 https://api.mch.weixin.qq.com/v3/pay/out-trade-no/{out_trade_no}
      console.log('[Payment] 查询订单状态:', orderId)
    }

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
    const { orderId, transactionId } = event

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
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'paid',
        payTime: db.serverDate(),
        transactionId: transactionId,
        updateTime: db.serverDate()
      }
    })

    // 4. **关键：激活用户Pro会员**
    // 计算过期时间：支持按月或按天
    let expiryTime
    if (order.durationDays > 0) {
      // 按天计费（测试模式）
      expiryTime = Date.now() + order.durationDays * 24 * 60 * 60 * 1000
      console.log(`[Payment] 使用按天计费: ${order.durationDays}天`)
    } else {
      // 按月计费（正式模式）
      expiryTime = Date.now() + order.durationMonths * 30 * 24 * 60 * 60 * 1000
      console.log(`[Payment] 使用按月计费: ${order.durationMonths}个月`)
    }

    await db.collection('users').where({ openid: order.openid }).update({
      data: {
        isPro: true,
        proExpiry: expiryTime,
        isTestMode: order.isTestMode || false,  // 标记是否为测试会员
        proActivatedAt: db.serverDate(),
        activatedByOrderId: orderId,
        updateTime: db.serverDate()
      },
      multi: false  // 只更新一条记录
    })

    const expiryDate = new Date(expiryTime).toLocaleDateString()
    console.log(`[Payment] ✅ 用户 ${order.openid} 已开通Pro会员，有效期至 ${expiryDate}${order.isTestMode ? '（测试模式）' : ''}`)

    return {
      success: true,
      code: 'SUCCESS',
      message: '支付成功，Pro会员已激活'
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
