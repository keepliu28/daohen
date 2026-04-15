const cloud = require('wx-server-sdk')
const { Rsa, Wechatpay } = require('@wechatpay/api-v3')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// ---------------------------------------------------------------------------
// 商户配置
// ---------------------------------------------------------------------------

const MCH_ID = '1744187597'
const APP_ID = 'wx4098138fe5a33e1c'
const API_KEY = '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikl'
const SERIAL_NO = '50705023C38D8B39A5A4050F61052AB9E371CC14'

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDBY+33arAGQ3yq
dzMrT9vl/2Bq4GnhqN0q/JRjI04cxnBZ3URiHauVKhIj/ScIrUcXj957DaaJYfDC
M0H7OJokVK2oaZFvoM/83cj2YOVs3+3T3Isqyt/eJWNw1ueuuP31u3AJFmrH7yBP
6Cl8EIq9hRtFTW8xwLlNKac0YOZKBHJ5ETPIVA1X1QBFO2e0vaxIndEYy69qWvZx
vPgRfExnvBC0goQQpoW6a1leCF1E5lbbfKnuq1ijnQxDbUSEwKbdE20C9EU74jRO
TzcSc+S56p5mzBsqOl7QemnpRYneuCQA38x9YlQDV8tb51IzBsUaT5gJUW0SOTA7
8oIgIgevAgMBAAECggEBALY2Zn/JKQMt0Sd4WmEDxIhHf1wUCA9ToNeg1ls2Z6Hb
Iv646XacyA8qbZ81JfMZ+LLtnk1JBlHJUyRXUWLX6Pw0QM8+cIbB+VYizfe+Qky8
DISi9wkhz56qkbA+/Fp2+OnwalZVpdStrT882uGHYIHDCXfZxtwU30Mh7OYAKtsv
AOHwdr4mRKoU/e9J8u0EpvtMnbAIXLaVH83zkF7RQrKzof+Lh6wQf3OVgQMBHEyh
Z2O/lsHde3fG2hT2NoEBYNDRfuzi2aiGk/3mL68az4LJq/Tcn4Z1jPPzn+UEveU6
PvhEg9fsgmgUVBWpMUE9J+Kaujz7cGyUmo+Q4Y2nvukCgYEA/Fsd0uFJH/zVto9J
6Gq8Amb9XvoxG6CZXHpRsbJD3NLbNcnY2UyRqR1w0I7MTK6xSb2cj4Qwc4YvpVnr
SsZeRWxp6CyEMwYOPCe709zjT2xTFvqLLmt1JEYe53bcKURy9avnKSWhcSP/VkqC
g30Dlu7pUaQbjMIoxIvUQFcyaMMCgYEAxC7VzbgnSQr54bhU8jgztB8pHeckEOi4
1ve7i3srPvJ4ASpLcbaA1EFArdzaZon0E/LIrE85dt5LJU0dJsqNgZLQan9o5HjZ
KXJU3LBQ8k/fEOzIsLvyYhkGaLYPd6dKqkK7VmpUU5+u+LS4oL+phK1X6y4o1PDR
a5VnpU2RVqUCgYBj5VHWA7Zlwjl7bhdsuKu6K7jK2zGLZTSwZf9m31F73cBG96Mu
yd+zWWMqPAzlohWuQi/yo/pmEM1VoFXDIOl6g+MctFqUtCX4bCYvRPZ6nz/5Da8A
7irN9DARonyenWkAlU8Je8r/tadDKnWlxVwhaGvWFKePPeDThSK9YYcj7wKBgDXy
wyytJXB6qjieHg310pIHt6DXfR2BQcMroNE8b6oBt2pqnRCKJWc5AnZNM2nbKdmK
fBCWQLElc/iv+gI+1Sb6noGKw+eALAevvxJpEflwaWEYHCAtrvu28gI9fodi469q
ZmXfG41bbhxKZjMeQZmQqYqsyOG1z4EMNtJIQF1ZAoGAPjWivQaY3O0Q8Y5VNvRL
sRIlPEWt9CTdeMQlTxQtPnNUa9ShwA2hFk8jk71MLvAdm33ioysKGGjj7xWr4n28
mG0jzvvMtIczc3wvulF2Wm21vqSKGQqROHlsHxU6JDZGLHfy2h2XzHCUHiPjG5a5
R1l/qsiHiShKqrYOjwzOjiE=
-----END PRIVATE KEY-----`

// 价格方案（单位：分）
const PRICE_PLANS = {
  daily: { durationDays: 1, price: 1, isTestMode: true },
  monthly: { durationMonths: 1, price: 190 },
  yearly: { durationMonths: 12, price: 1990 }
}

// ---------------------------------------------------------------------------
// 初始化微信支付实例（使用官方SDK）
// ---------------------------------------------------------------------------

let wechatpayInstance = null

function getWechatpayInstance() {
  if (!wechatpayInstance) {
    wechatpayInstance = new Wechatpay({
      mchid: MCH_ID,
      serial: SERIAL_NO,
      privateKey: PRIVATE_KEY,
      certs: {
        [SERIAL_NO]: '' // V3模式不需要商户证书公钥
      }
    })
    
    console.log('[Payment] ✅ 微信支付SDK初始化成功')
  }
  
  return wechatpayInstance
}

// ---------------------------------------------------------------------------
// 工具函数
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
    
    default:
      return { success: false, error: `未知操作：${event.action}` }
  }
}

// ---------------------------------------------------------------------------
// 创建订单
// ---------------------------------------------------------------------------

async function createOrder(openid, data) {
  const { planType } = data
  
  if (!PRICE_PLANS[planType]) {
    return { success: false, error: '无效的订阅方案' }
  }

  const plan = PRICE_PLANS[planType]
  const orderId = `DH${Date.now()}${generateNonceStr(8)}`

  try {
    console.log('[Payment] 开始创建订单:', orderId)
    console.log('[Payment] 方案类型:', planType)
    console.log('[Payment] 价格(分):', plan.price)

    // 1. 创建数据库记录
    await db.collection('orders').add({
      data: {
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
    })

    console.log('[Payment] 订单已创建:', orderId)

    // 2. 使用官方SDK调用微信支付API
    const payResult = await callWechatPayWithSDK(orderId, openid, plan.price, planType)

    if (payResult.success) {
      // 3. 更新 prepayId
      await db.collection('orders').doc(orderId).update({
        data: {
          prepayId: payResult.prepayId,
          updateTime: db.serverDate()
        }
      })

      return {
        success: true,
        data: {
          orderId,
          ...payResult.paymentParams
        }
      }
    } else {
      await db.collection('orders').doc(orderId).update({
        data: { status: 'failed', error: payResult.error, updateTime: db.serverDate() }
      })
      
      return { success: false, error: payResult.error }
    }

  } catch (error) {
    console.error('[Payment] 异常:', error)
    return { success: false, error: error.message }
  }
}

// ---------------------------------------------------------------------------
// 调用微信支付 API（使用官方SDK）
// ---------------------------------------------------------------------------

async function callWechatPayWithSDK(orderId, openid, totalFee, planType) {
  try {
    const instance = getWechatpayInstance()
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonceStr = generateNonceStr()

    // 构建请求参数
    const params = {
      appid: APP_ID,
      mchid: MCH_ID,
      description: `道痕Pro会员-${planType}`,
      out_trade_no: orderId,
      notify_url: '',
      amount: {
        total: totalFee,
        currency: 'CNY'
      },
      payer: {
        openid: openid
      }
    }

    console.log('[Payment] 调用SDK下单...')
    console.log('[Payment] 请求参数:', JSON.stringify(params))

    // 使用官方SDK的 v3.pay.transactions.jsapi 方法
    const result = await instance.v3.pay.transactions.jsapi.post({ params })

    console.log('[Payment] SDK响应状态:', result.status)
    console.log('[Payment] SDK响应数据:', JSON.stringify(result.data))

    if (result && result.data && result.data.prepay_id) {
      const prepayId = result.data.prepay_id
      
      // 构建前端调起支付的参数
      const packageStr = `prepay_id=${prepayId}`
      
      // 使用SDK生成二次签名
      const paySign = Rsa.sign(
        [APP_ID, timestamp, nonceStr, packageStr].join('\n') + '\n',
        PRIVATE_KEY
      )

      console.log('[Payment] ✅ 下单成功！prepay_id:', prepayId.substring(0, 20))

      return {
        success: true,
        prepayId: prepayId,
        paymentParams: {
          timeStamp: timestamp,
          nonceStr: nonceStr,
          package: packageStr,
          signType: 'RSA',
          paySign: paySign
        }
      }
    } else {
      console.error('[Payment] ❌ 下单失败:', JSON.stringify(result))
      return {
        success: false,
        error: result?.data?.message || JSON.stringify(result?.data) || '下单失败'
      }
    }

  } catch (error) {
    console.error('[Payment] SDK调用异常:')
    console.error('- 消息:', error.message)
    if (error.response) {
      console.error('- 状态码:', error.response.status)
      console.error('- 响应数据:', JSON.stringify(error.response.data))
      
      return {
        success: false,
        error: `API错误(${error.response.status}): ${JSON.stringify(error.response.data)}`
      }
    }
    
    return { success: false, error: error.message || '网络异常' }
  }
}

// ---------------------------------------------------------------------------
// 查询订单
// ---------------------------------------------------------------------------

async function queryOrder(orderId) {
  try {
    const res = await db.collection('orders').doc(orderId).get()
    
    if (!res.data) {
      return { success: false, error: '订单不存在' }
    }

    return { success: true, data: res.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
