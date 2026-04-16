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

// ⚠️ 【重要】部署 payment-notify 云函数后，在此填入其 HTTP 触发 URL
// 格式：https://${envId}.env.${region}.tcapi.run/payment-notify
// 例如：https://abcdef-1a2b3c.env.cn-shanghai.tcapi.run/payment-notify
// 
// 📌 当前状态：
// - 留空或不填：微信不会发送回调通知（前端需主动调用 queryOrder 查询）
// - 填真实地址：微信支付成功后会自动回调该地址
const NOTIFY_URL = '';

// 🧪 测试模式：
// true  = 模拟支付（跳过微信API，直接激活Pro，不产生真实扣款）
// false = 真实支付（调用微信API，产生真实扣款）
// 用途：开发测试阶段使用true，正式发布前改为false
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
-----END PRIVATE KEY-----`;

// 价格方案（单位：分）
const PRICE_PLANS = {
  daily: { durationDays: 1, price: 1, isTestMode: true, label: '体验会员1天' },
  monthly: { durationMonths: 1, price: 190, label: '月度Pro' },
  yearly: { durationMonths: 12, price: 1990, label: '年度Pro', originalPrice: 2280, saving: '省13%' },
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

/**
 * RSA SHA256 签名（V3）
 */
function rsaSign(signStr) {
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  return sign.sign(PRIVATE_KEY, 'base64');
}

/**
 * Node.js 原生 https 请求（兼容云函数环境）
 */
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

/**
 * 发送微信支付 V3 API 请求（原生实现，不依赖第三方 SDK）
 */
async function wxPayRequest(method, path, params) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonceStr();
  const body = params ? JSON.stringify(params) : '';

  // 构造签名原文（严格按照微信支付 V3 规范）
  // 格式：HTTP_METHOD\n + URL_PATH\n + TIMESTAMP\n + NONCE\n + BODY\n
  const signParts = [method, path, timestamp, nonce];
  if (body) signParts.push(body);
  signParts.push('');
  const signStr = signParts.join('\n');

  // RSA 签名
  const signature = rsaSign(signStr);

  // 构造 Authorization 头（V3 格式）
  const authorization =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${MCH_ID}",` +
    `nonce_str="${nonce}",` +
    `signature="${signature}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${SERIAL_NO}"`;

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

  console.log(`[wxPayRequest] ${method} ${path}`);
  console.log(`[wxPayRequest] Authorization: ${authorization.substring(0, 60)}...`);

  const result = await httpsRequest(requestOptions, body);
  
  // ✅ 修复问题2：正确处理 V3 API 返回格式
  // V3 API 成功返回 HTTP 200 + { prepay_id: "..." }
  // V3 API 失败返回 HTTP 4xx/5xx + { code: "ERROR_CODE", message: "..." }
  if (result.status >= 200 && result.status < 300 && result.data.prepay_id) {
    return result.data;
  } else if (result.status >= 400) {
    // HTTP 错误状态码，抛出异常让调用方处理
    throw new Error(`API错误(${result.status}): ${JSON.stringify(result.data)}`);
  } else {
    // 其他情况也视为失败
    throw new Error(`未知响应: status=${result.status}, data=${JSON.stringify(result.data)}`);
  }
}

/**
 * 错误码友好提示映射
 */
function getFriendlyErrorMessage(errorMsg) {
  if (!errorMsg) return '未知错误';
  
  const errorMap = {
    'SIGN_ERROR': '签名配置错误，请检查商户私钥',
    'SIGNATURE_INVALID': '签名无效，请检查证书配置',
    'CERTIFICATE_ERROR': '证书序列号错误',
    'PARAM_ERROR': '参数配置错误',
    'access denied': '支付权限未开通，请在商户平台检查AppID绑定',
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

  console.log('[Payment] ===== 收到请求 =====');
  console.log('[Payment] action:', event.action);
  console.log('[Payment] openid:', openid);
  console.log('[Payment] data:', JSON.stringify(event.data));

  switch (event.action) {
    case 'createOrder':
      return await createOrder(openid, event.data);

    case 'queryOrder':
      return await queryOrderByWxApi(event.orderId);

    case 'activatePro':
      return await activateProManually(openid, event.data);

    default:
      return { success: false, error: `未知操作：${event.action}` };
  }
};

// ---------------------------------------------------------------------------
// 创建订单
// ---------------------------------------------------------------------------

async function createOrder(openid, data) {
  const { planType } = data;

  if (!PRICE_PLANS[planType]) {
    return { success: false, error: `无效的订阅方案: ${planType}` };
  }

  const plan = PRICE_PLANS[planType];
  const orderId = `DH${Date.now()}${generateNonceStr(8)}`;

  try {
    console.log(`[createOrder] 🚀 开始: orderId=${orderId}, plan=${planType}, price=${plan.price}分`);

    // 1. 幂等检查：10分钟内同名 pending 订单直接复用
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
        console.log(`[createOrder] 复用未支付订单: ${latest._id}，age=${Math.round(age / 1000)}s`);
        
        // ✅ 修复问题5：测试模式下复用订单也要能正常工作
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

    // 2. 创建本地订单记录
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
    console.log(`[createOrder] 本地订单已创建: ${orderId}`);

    // 3. 【测试模式】✅ 修复问题1 & 问题5：直接激活Pro，不调微信API
    if (TEST_MODE) {
      console.log(`[createOrder] 🧪 测试模式：模拟支付成功，直接激活 Pro`);
      
      // 标记订单为已支付（模拟）
      await db.collection('orders').doc(orderId).update({
        data: { 
          status: 'paid',
          isMockOrder: true,
          transactionId: `MOCK_${Date.now()}`,
          payTime: db.serverDate(),
          updateTime: db.serverDate() 
        },
      });
      
      // 直接激活 Pro 会员
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

    // 4. 调用微信支付 JSAPI 下单（真实支付）
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
      
      // ✅ 修复问题6：使用友好的错误提示
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

    // ✅ 修复问题2：这里不需要再判断了，因为 wxPayRequest 已经处理好了
    const prepayId = wxResult.prepay_id;
    if (!prepayId) {
      console.error(`[createOrder] ❌ 未获取到 prepay_id:`, JSON.stringify(wxResult));
      await db.collection('orders').doc(orderId).update({
        data: { status: 'failed', error: '未返回 prepay_id', updateTime: db.serverDate() },
      });
      return { success: false, error: '微信支付下单未返回 prepay_id' };
    }

    // 5. 保存 prepayId
    await db.collection('orders').doc(orderId).update({
      data: { prepayId, updateTime: db.serverDate() },
    });
    console.log(`[createOrder] ✅ 微信下单成功，prepay_id: ${prepayId.substring(0, 30)}`);

    // 6. 生成调起支付参数
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

  // 调起签名的原文（V3 JSAPI 规定格式）
  const signStr = `${APP_ID}\n${timestamp}\n${nonceStr}\n${packageStr}\n`;
  const paySign = rsaSign(signStr);

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
  try {
    const dbRes = await db.collection('orders').doc(orderId).get();
    if (!dbRes.data) return { success: false, error: '订单不存在' };

    const localOrder = dbRes.data;

    // 已终态直接返回（减少微信 API 调用）
    if (localOrder.status === 'paid') {
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
      return { success: true, data: localOrder };
    }

    // ✅ 修复问题5：测试模式的订单查询
    if (TEST_MODE && localOrder.isMockOrder) {
      console.log(`[queryOrder] 🧪 测试模式订单: ${orderId}, status=${localOrder.status}`);
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

    // 真实支付：调用微信 API 查询
    let wxRes;
    try {
      wxRes = await wxPayRequest(
        'GET',
        `/v3/pay/transactions/out-trade-no/${orderId}?mchid=${MCH_ID}`,
        null
      );
      console.log(`[queryOrder] 微信查询: trade_state=${wxRes.trade_state}`);
    } catch (wxError) {
      console.warn(`[queryOrder] 微信查询失败，降级返回本地状态:`, wxError.message);
      return { success: true, data: localOrder, warning: getFriendlyErrorMessage(wxError.message) };
    }

    const tradeState = wxRes.trade_state;
    const tradeStateDesc = wxRes.trade_state_desc || '';
    let activated = false;

    // 微信侧已支付 → 激活 Pro
    if (tradeState === 'SUCCESS' && localOrder.status === 'pending') {
      console.log(`[queryOrder] ✅ 微信已支付，激活 Pro: ${orderId}`);
      activated = await activateProFromOrder(orderId);

      // 保存 transactionId
      if (wxRes.transaction_id && !localOrder.transactionId) {
        await db.collection('orders').doc(orderId).update({
          data: {
            transactionId: wxRes.transaction_id,
            updateTime: db.serverDate(),
          },
        });
      }
    }

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
// 从订单激活 Pro（核心业务逻辑）✅ 修复问题3
// ---------------------------------------------------------------------------

async function activateProFromOrder(orderId) {
  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    if (!orderRes.data) return false;

    const order = orderRes.data;
    const { openid, planType, durationMonths, durationDays } = order;
    const now = Date.now();

    // ✅ 修复问题3：同时支持天数和月数计算
    let newExpiry;
    
    if (durationDays > 0) {
      // 天卡：按天计算
      newExpiry = now + durationDays * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 天卡模式：${durationDays}天`);
    } else if (durationMonths > 0) {
      // 月卡：按月计算（每月30天）
      newExpiry = now + durationMonths * 30 * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 月卡模式：${durationMonths}个月`);
    } else {
      // 默认：1个月
      newExpiry = now + 30 * 24 * 60 * 60 * 1000;
      console.log(`[activateProFromOrder] 📅 默认模式：1个月`);
    }

    const userRes = await db.collection('users').where({ openid }).limit(1).get();

    if (userRes.data.length === 0) {
      // 新用户：直接创建
      await db.collection('users').add({
        data: {
          openid,
          isPro: true,
          proExpiry: newExpiry,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        },
      });
      console.log(`[activateProFromOrder] ✅ 新用户开通 Pro，过期: ${new Date(newExpiry).toLocaleString()}`);
    } else {
      // 老用户：续期（✅ 修复问题3：正确计算续期时间）
      const user = userRes.data[0];
      const existingExpiry = user.proExpiry || 0;
      
      let finalExpiry;
      
      if (existingExpiry > now) {
        // 当前 Pro 未过期 → 叠加时长
        if (durationDays > 0) {
          finalExpiry = existingExpiry + durationDays * 24 * 60 * 60 * 1000;
        } else {
          finalExpiry = existingExpiry + (durationMonths || 1) * 30 * 24 * 60 * 60 * 1000;
        }
        console.log(`[activateProFromOrder] 📅 续期叠加，新过期: ${new Date(finalExpiry).toLocaleString()}`);
      } else {
        // 当前 Pro 已过期 → 从现在开始算
        finalExpiry = newExpiry;
        console.log(`[activateProFromOrder] 📅 重新开通，过期: ${new Date(finalExpiry).toLocaleString()}`);
      }

      await db.collection('users').doc(user._id).update({
        data: {
          isPro: true,
          proExpiry: finalExpiry,
          updateTime: db.serverDate(),
        },
      });
    }

    // 更新订单状态为已支付
    await db.collection('orders').doc(orderId).update({
      data: {
        status: 'paid',
        payTime: db.serverDate(),
        updateTime: db.serverDate(),
      },
    });

    return true;
  } catch (error) {
    console.error(`[activateProFromOrder] ❌ 激活失败:`, error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 手动激活 Pro（管理接口，仅调试用）
// ---------------------------------------------------------------------------

async function activateProManually(openid, data) {
  const { durationMonths = 1, reason = '管理手动开通' } = data || {};
  console.warn(`[activateProManually] ⚠️ 管理操作: ${reason}, openid=${openid}`);

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
