const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// ---------------------------------------------------------------------------
// 商户配置
// ---------------------------------------------------------------------------

const MCH_ID = '1744187597';
const APP_ID = 'wx4098138fe5a33e1c';
const API_KEY = '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikl';
const SERIAL_NO = '50705023C38D8B39A5A4050F61052AB9E371CC14';

// ⚠️ 【重要】支付回调地址（必填！）
const NOTIFY_URL = 'https://servicewechat.com/wx4098138fe5a33e1c/pages/profile/index';

// 🧪 测试模式：
const TEST_MODE = false; // ✅ 已上线：关闭测试模式，启用真实支付

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
PvhEg9fsgmgUVBWpMUE9J+Kaujz7cGyUmo+Q4Y2nvukCgYEA+Fsd0uFJH/zVto9J
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
-----END PRIVATE KEY-----`;

// 价格方案（单位：分）
const PRICE_PLANS = {
  daily: { durationDays: 1, price: 1, isTestMode: false, label: '体验会员 1 天' },
  monthly: { durationMonths: 1, price: 190, label: '月度 Pro' },
  yearly: { durationMonths: 12, price: 1990, label: '年度 Pro', originalPrice: 2280, saving: '省 13%' },
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function generateNonceStr(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function rsaSign(signStr) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  return sign.sign(PRIVATE_KEY, 'base64');
}

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function wxPayRequest(method, path, params) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonceStr();
  const body = params ? JSON.stringify(params) : '';

  console.log('\n');
  console.log('─'.repeat(60));
  console.log('🌐 [wxPayRequest] 开始请求微信支付 API');
  console.log('─'.repeat(60));
  console.log('[wxPayRequest] 请求方法:', method);
  console.log('[wxPayRequest] 请求路径:', path);
  console.log('[wxPayRequest] 请求时间:', new Date().toISOString());
  console.log('[wxPayRequest] Timestamp:', timestamp);
  console.log('[wxPayRequest] Nonce:', nonce);
  console.log('[wxPayRequest] 请求体:', body ? body.substring(0, 200) : '无');
  console.log('─'.repeat(60));

  const signParts = [method, path, timestamp, nonce];
  if (body) signParts.push(body);
  signParts.push('');
  const signStr = signParts.join('\n');

  console.log('[wxPayRequest] 签名原文:', signStr.replace(/\n/g, '\\n').substring(0, 150));

  const signature = rsaSign(signStr);
  console.log('[wxPayRequest] 签名结果 (base64):', signature.substring(0, 80) + '...');

  const authorization =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${MCH_ID}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${SERIAL_NO}"`;

  console.log('[wxPayRequest] Authorization:', authorization.substring(0, 100) + '...');
  console.log('─'.repeat(60));
  console.log('\n');

  const urlObj = new URL(`https://api.mch.weixin.qq.com${path}`);
  const requestOptions = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization,
      'User-Agent': 'daohen-payment/1.0',
    },
  };

  console.log(`[wxPayRequest] 🚀 发送 HTTPS 请求到：${urlObj.hostname}`);
  
  const startTime = Date.now();
  const result = await httpsRequest(requestOptions, body);
  const endTime = Date.now();
  
  console.log('\n');
  console.log('─'.repeat(60));
  console.log('📥 [wxPayRequest] 收到 API 响应');
  console.log('─'.repeat(60));
  console.log('[wxPayRequest] 响应状态码:', result.status);
  console.log('[wxPayRequest] 请求耗时:', `${endTime - startTime}ms`);
  console.log('[wxPayRequest] 响应数据:', JSON.stringify(result.data).substring(0, 300));
  console.log('─'.repeat(60));
  console.log('\n');
  
  if (result.status >= 200 && result.status < 300 && result.data.prepay_id) {
    console.log('[wxPayRequest] ✅ API 调用成功！获取到 prepay_id');
    return result.data;
  } else if (result.status >= 400) {
    console.error('[wxPayRequest] ❌ API 调用失败！HTTP 错误状态码');
    console.error('[wxPayRequest] 错误详情:', JSON.stringify(result.data));
    throw new Error(`API 错误 (${result.status}): ${JSON.stringify(result.data)}`);
  } else {
    console.error('[wxPayRequest] ❌ API 调用失败！未知响应格式');
    console.error('[wxPayRequest] 状态码:', result.status);
    console.error('[wxPayRequest] 响应数据:', JSON.stringify(result.data));
    throw new Error(`未知响应：status=${result.status}, data=${JSON.stringify(result.data)}`);
  }
}

function getFriendlyErrorMessage(errorMsg) {
  if (!errorMsg) return '未知错误';
  
  const errorMap = {
    'SIGN_ERROR': '签名配置错误，请检查商户私钥',
    'SIGNATURE_INVALID': '签名无效，请检查证书配置',
    'CERTIFICATE_ERROR': '证书序列号错误',
    'PARAM_ERROR': '参数配置错误',
    'access denied': '支付权限未开通，请在商户平台检查 AppID 绑定',
    'NO_AUTH': '无权限调用此接口',
    'NOT_ENOUGH': '余额不足',
    'ORDERPAID': '订单已支付',
    'ORDERCLOSED': '订单已关闭',
    'SYSTEMERROR': '系统繁忙，请稍后重试',
  };
  
  for (const [code, msg] of Object.entries(errorMap)) {
    if (errorMsg.includes(code)) return `${msg}（${errorMsg}）`;
  }
  
  return errorMsg;
}

// ---------------------------------------------------------------------------
// 云函数入口
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const timestamp = new Date().toISOString();

  console.log('\n');
  console.log('='.repeat(60));
  console.log('📍 [Payment] 云函数启动');
  console.log('='.repeat(60));
  console.log('[Payment] 时间戳:', timestamp);
  console.log('[Payment] 环境 ID:', wxContext.ENV_ID || 'unknown');
  console.log('[Payment] OpenID:', openid);
  console.log('[Payment] 请求 action:', event.action);
  console.log('[Payment] 请求 data:', JSON.stringify(event.data));
  console.log('[Payment] 测试模式:', TEST_MODE ? '✅ 开启' : '❌ 关闭');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    switch (event.action) {
      case 'createOrder':
        return await createOrder(openid, event.data);

      case 'queryOrder':
        return await queryOrderByWxApi(event.orderId);

      case 'activatePro':
        return await activateProManually(openid, event.data);

      default:
        console.error('[Payment] ❌ 未知操作:', event.action);
        return { success: false, error: `未知操作：${event.action}` };
    }
  } catch (error) {
    console.error('\n');
    console.error('='.repeat(60));
    console.error('❌ [Payment] 云函数执行异常');
    console.error('='.repeat(60));
    console.error('[Payment] 错误类型:', error.constructor.name);
    console.error('[Payment] 错误消息:', error.message);
    console.error('[Payment] 错误堆栈:', error.stack);
    console.error('='.repeat(60));
    console.error('\n');
    
    return { 
      success: false, 
      error: `系统异常：${error.message}`,
      _debug: {
        action: event.action,
        timestamp: timestamp,
        errorType: error.constructor.name
      }
    };
  }
};

// ---------------------------------------------------------------------------
// 创建订单
// ---------------------------------------------------------------------------

async function createOrder(openid, data) {
  const { planType } = data;
  const startTime = Date.now();

  console.log('\n');
  console.log('─'.repeat(60));
  console.log('📦 [createOrder] 开始创建订单');
  console.log('─'.repeat(60));
  console.log('[createOrder] 用户 OpenID:', openid);
  console.log('[createOrder] 订阅方案:', planType);
  console.log('[createOrder] 测试模式:', TEST_MODE ? '✅ 是' : '❌ 否');

  if (!PRICE_PLANS[planType]) {
    console.error('[createOrder] ❌ 无效的订阅方案:', planType);
    console.error('[createOrder] 可用方案:', Object.keys(PRICE_PLANS).join(', '));
    return { success: false, error: `无效的订阅方案：${planType}` };
  }

  const plan = PRICE_PLANS[planType];
  const orderId = `DH${Date.now()}${generateNonceStr(8)}`;

  console.log('[createOrder] 订单 ID:', orderId);
  console.log('[createOrder] 价格:', `${plan.price}分 (￥${(plan.price / 100).toFixed(2)})`);
  console.log('[createOrder] 商品描述:', plan.label);
  console.log('[createOrder] 时长:', plan.durationDays ? `${plan.durationDays}天` : `${plan.durationMonths}个月`);
  console.log('─'.repeat(60));
  console.log('\n');

  try {
    console.log(`[createOrder] 🚀 步骤 1/3: 开始创建订单，orderId=${orderId}`);

    const recentOrders = await db
      .collection('orders')
      .where({
        openid,
        planType,
        status: 'pending',
      })
      .limit(5)
      .get();

    if (recentOrders.data.length > 0) {
      const latest = recentOrders.data[0];
      const age = Date.now() - new Date(latest.createTime).getTime();
      if (age < 10 * 60 * 1000) {
        console.log(`[createOrder] 复用未支付订单：${latest._id}，age=${Math.round(age / 1000)}s`);
        
        if (TEST_MODE || latest.isMockOrder) {
          return {
            success: true,
            data: { orderId: latest._id, _testMode: true, _mockPaid: latest.status === 'paid' },
          };
        }
        
        if (latest.prepayId) {
          const params = generateAppPayParams(latest.prepayId);
          return {
            success: true,
            data: { orderId: latest._id, ...params },
          };
        }
      }
    }

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
        prepayId: null,
        error: null,
      },
    });
    console.log(`[createOrder] 本地订单已创建：${orderId}`);

    if (TEST_MODE) {
      console.log(`[createOrder] 🧪 测试模式：模拟支付成功，直接激活 Pro`);
      
      await db.collection('orders').doc(orderId).update({
        data: { 
          status: 'paid',
          isMockOrder: true,
          transactionId: `MOCK_${Date.now()}`,
          payTime: db.serverDate(),
          updateTime: db.serverDate() 
        },
      });
      
      const activated = await activateProFromOrder(orderId);
      
      return {
        success: true,
        data: { 
          orderId, 
          _testMode: true, 
          _mockPaid: true,
          proActivated: activated,
          message: activated ? '测试模式：Pro 已开通' : '测试模式：开通失败'
        },
      };
    }

    const wxParams = {
      appid: APP_ID,
      mchid: MCH_ID,
      description: plan.label,
      out_trade_no: orderId,
      notify_url: NOTIFY_URL || undefined,
      amount: {
        total: plan.price,
        currency: 'CNY',
      },
      payer: {
        openid: openid,
      },
    };

    let wxResult;
    try {
      wxResult = await wxPayRequest('POST', '/v3/pay/transactions/jsapi', wxParams);
    } catch (wxError) {
      console.error(`[createOrder] ❌ 微信下单失败:`, wxError.message);
      
      const friendlyMsg = getFriendlyErrorMessage(wxError.message);
      
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'failed',
          error: friendlyMsg,
          updateTime: db.serverDate(),
        },
      });
      return {
        success: false,
        error: friendlyMsg,
      };
    }

    const prepayId = wxResult.prepay_id;
    if (!prepayId) {
      console.error(`[createOrder] ❌ 未获取到 prepay_id:`, JSON.stringify(wxResult));
      await db.collection('orders').doc(orderId).update({
        data: { status: 'failed', error: '未返回 prepay_id', updateTime: db.serverDate() },
      });
      return { success: false, error: '微信支付下单未返回 prepay_id' };
    }

    await db.collection('orders').doc(orderId).update({
      data: { prepayId, updateTime: db.serverDate() },
    });
    console.log(`[createOrder] ✅ 微信下单成功，prepay_id: ${prepayId.substring(0, 30)}`);

    const paymentParams = generateAppPayParams(prepayId);
    return {
      success: true,
      data: { orderId, ...paymentParams },
    };
  } catch (error) {
    console.error(`[createOrder] ❌ 异常:`, error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 生成小程序调起支付参数（V3 JSAPI 二次签名）
// ---------------------------------------------------------------------------

function generateAppPayParams(prepayId) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonceStr = generateNonceStr();
  const packageStr = `prepay_id=${prepayId}`;

  console.log('\n');
  console.log('─'.repeat(60));
  console.log('✍️ [generateAppPayParams] 生成支付签名参数');
  console.log('─'.repeat(60));
  console.log('[generateAppPayParams] prepay_id:', prepayId.substring(0, 30) + '...');
  console.log('[generateAppPayParams] Timestamp:', timestamp);
  console.log('[generateAppPayParams] NonceStr:', nonceStr);
  
  const signStr = `${APP_ID}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
  console.log('[generateAppPayParams] 签名原文:', signStr.replace(/\n/g, '\\n'));
  
  const paySign = rsaSign(signStr);
  console.log('[generateAppPayParams] 支付签名:', paySign.substring(0, 80) + '...');
  console.log('─'.repeat(60));
  console.log('\n');

  return {
    timeStamp: timestamp,
    nonceStr: nonceStr,
    package: packageStr,
    signType: 'RSA',
    paySign: paySign,
  };
}

// ---------------------------------------------------------------------------
// 查询订单状态（调用微信 API 确认真实支付结果）
// ---------------------------------------------------------------------------

async function queryOrderByWxApi(orderId) {
  const startTime = Date.now();
  console.log('\n');
  console.log('─'.repeat(60));
  console.log('🔍 [queryOrder] 开始查询订单状态');
  console.log('─'.repeat(60));
  console.log('[queryOrder] 订单 ID:', orderId);
  console.log('[queryOrder] 查询时间:', new Date().toISOString());

  try {
    const dbRes = await db.collection('orders').doc(orderId).get();
    if (!dbRes.data) {
      console.error('[queryOrder] ❌ 订单不存在:', orderId);
      return { success: false, error: '订单不存在' };
    }

    const localOrder = dbRes.data;
    console.log('[queryOrder] 本地订单状态:', localOrder.status);
    console.log('[queryOrder] 是否测试订单:', localOrder.isMockOrder ? '是' : '否');

    if (localOrder.status === 'paid') {
      console.log('[queryOrder] ✅ 订单已支付，直接返回');
      return { 
        success: true, 
        data: {
          ...localOrder,
          wxTradeState: 'SUCCESS',
          proActivated: true,
        }
      };
    }
    
    if (localOrder.status === 'failed') {
      console.log('[queryOrder] ❌ 订单已失败，直接返回');
      return { success: true, data: localOrder };
    }

    if (TEST_MODE && localOrder.isMockOrder) {
      console.log(`[queryOrder] 🧪 测试模式订单：${orderId}, status=${localOrder.status}`);
      return {
        success: true,
        data: {
          ...localOrder,
          wxTradeState: localOrder.status === 'paid' ? 'SUCCESS' : 'NOTPAY',
          wxTradeStateDesc: localOrder.status === 'paid' ? '模拟支付成功' : '等待支付',
          _testMode: true,
        },
      };
    }

    console.log('[queryOrder] 🌐 调用微信 API 查询订单状态...');
    let wxRes;
    try {
      wxRes = await wxPayRequest(
        'GET',
        `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${MCH_ID}`,
        null
      );
      console.log(`[queryOrder] 微信查询结果：trade_state=${wxRes.trade_state}`);
    } catch (wxError) {
      console.warn(`[queryOrder] 微信查询失败，降级返回本地状态:`, wxError.message);
      return { success: true, data: localOrder, warning: getFriendlyErrorMessage(wxError.message) };
    }

    const tradeState = wxRes.trade_state;
    const tradeStateDesc = wxRes.trade_state_desc || '';
    let activated = false;

    if (tradeState === 'SUCCESS' && localOrder.status === 'pending') {
      console.log(`[queryOrder] ✅ 微信已支付，激活 Pro: ${orderId}`);
      activated = await activateProFromOrder(orderId);

      if (wxRes.transaction_id && !localOrder.transactionId) {
        await db.collection('orders').doc(orderId).update({
          data: {
            transactionId: wxRes.transaction_id,
            updateTime: db.serverDate(),
          },
        });
      }
    }

    const endTime = Date.now();
    console.log('[queryOrder] 查询耗时:', `${endTime - startTime}ms`);
    console.log('─'.repeat(60));
    console.log('\n');

    return {
      success: true,
      data: {
        ...localOrder,
        wxTradeState: tradeState,
        wxTradeStateDesc: tradeStateDesc,
        proActivated: activated,
        updated: true,
      },
    };
  } catch (error) {
    console.error(`[queryOrder] ❌ 查询失败:`, error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 从订单激活 Pro（核心业务逻辑）
// ---------------------------------------------------------------------------

async function activateProFromOrder(orderId) {
  console.log('\n');
  console.log('─'.repeat(60));
  console.log('🎯 [activateProFromOrder] 开始激活 Pro 会员');
  console.log('─'.repeat(60));
  console.log('[activateProFromOrder] 订单 ID:', orderId);

  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    if (!orderRes.data) {
      console.error('[activateProFromOrder] ❌ 订单不存在:', orderId);
      return false;
    }

    const order = orderRes.data;
    const { openid, planType, durationMonths, durationDays } = order;
    const now = Date.now();

    console.log('[activateProFromOrder] 用户 OpenID:', openid);
    console.log('[activateProFromOrder] 订阅方案:', planType);
    console.log('[activateProFromOrder] 时长:', durationDays ? `${durationDays}天` : `${durationMonths}个月`);

    let newExpiry;
    
    if (durationDays > 0) {
      newExpiry = now + durationDays * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 天卡模式：${durationDays}天，过期时间:`, new Date(newExpiry).toLocaleString());
    } else if (durationMonths > 0) {
      newExpiry = now + durationMonths * 30 * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 月卡模式：${durationMonths}个月，过期时间:`, new Date(newExpiry).toLocaleString());
    } else {
      newExpiry = now + 30 * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 默认模式：1 个月，过期时间:`, new Date(newExpiry).toLocaleString());
    }

    const userRes = await db.collection('users').where({ openid }).limit(1).get();

    if (userRes.data.length === 0) {
      console.log('[activateProFromOrder] 新用户，创建 Pro 记录');
      await db.collection('users').add({
        data: {
          openid,
          isPro: true,
          proExpiry: newExpiry,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        },
      });
      console.log(`[activateProFromOrder] ✅ 新用户开通 Pro，过期:`, new Date(newExpiry).toLocaleString());
    } else {
      const user = userRes.data[0];
      const existingExpiry = user.proExpiry || 0;
      
      let finalExpiry;
      
      if (existingExpiry > now) {
        if (durationDays > 0) {
          finalExpiry = existingExpiry + durationDays * 24 * 60 * 60 * 1000;
        } else {
          finalExpiry = existingExpiry + (durationMonths || 1) * 30 * 24 * 60 * 60 * 1000;
        }
        console.log(`[activateProFromOrder] 📅 续期叠加，原过期:`, new Date(existingExpiry).toLocaleString());
        console.log(`[activateProFromOrder] 📅 新过期:`, new Date(finalExpiry).toLocaleString());
      } else {
        finalExpiry = newExpiry;
        console.log(`[activateProFromOrder] 📅 重新开通，过期:`, new Date(finalExpiry).toLocaleString());
      }

      await db.collection('users').doc(user._id).update({
        data: {
          isPro: true,
          proExpiry: finalExpiry,
          updateTime: db.serverDate(),
        },
      });
      console.log(`[activateProFromOrder] ✅ 老用户续期成功`);
    }

    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'paid',
        payTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });

    console.log('[activateProFromOrder] ✅ Pro 激活成功');
    console.log('─'.repeat(60));
    console.log('\n');

    return true;
  } catch (error) {
    console.error(`[activateProFromOrder] ❌ 激活失败:`, error);
    console.error('[activateProFromOrder] 错误堆栈:', error.stack);
    console.log('─'.repeat(60));
    console.log('\n');
    return false;
  }
}

// ---------------------------------------------------------------------------
// 手动激活 Pro（管理接口，仅调试用）
// ---------------------------------------------------------------------------

async function activateProManually(openid, data) {
  const { durationMonths = 1, reason = '管理手动开通' } = data || {};
  console.warn(`[activateProManually] ⚠️ 管理操作：${reason}, openid=${openid}`);

  const newExpiry = Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000;

  const userRes = await db.collection('users').where({ openid }).limit(1).get();

  if (userRes.data.length === 0) {
    await db.collection('users').add({
      data: {
        openid,
        isPro: true,
        proExpiry: newExpiry,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });
  } else {
    await db.collection('users').doc(userRes.data[0]._id).update({
      data: { isPro: true, proExpiry: newExpiry, updateTime: db.serverDate() },
    });
  }

  return {
    success: true,
    message: `已开通 ${durationMonths} 个月 Pro（${reason}）`,
    proExpiry: new Date(newExpiry).toLocaleString(),
  };
}
