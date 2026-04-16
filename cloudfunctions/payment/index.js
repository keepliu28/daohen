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
// 格式: https://${envId}.env.${region}.tcapi.run/payment-notify
// 例如: https://abcdef-1a2b3c.env.cn-shanghai.tcapi.run/payment-notify
const NOTIFY_URL = 'https://YOUR_ENV_ID.env.YOUR_REGION.tcapi.run/payment-notify';

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
  yearly: { durationMonths: 12, price: 1990, label: '年度Pro' },
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
          resolve(JSON.parse(data));
        } catch {
          resolve(data);
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
 * @param {string} method - GET/POST
 * @param {string} path - API 路径，如 /v3/pay/transactions/jsapi
 * @param {object|null} params - 请求体参数
 */
async function wxPayRequest(method, path, params) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonceStr();
  const body = params ? JSON.stringify(params) : '';

  // 构造签名原文（严格按照微信支付 V3 规范）
  // 格式：HTTP_METHOD\n + URL_PATH\n + TIMESTAMP\n + NONCE\n + BODY\n
  const signParts = [method, path, timestamp, nonce];
  if (body) signParts.push(body);
  signParts.push(''); // 末尾空行
  const signStr = signParts.join('\n');

  console.log(`[wxPayRequest] 签名原文:`, signStr.replace(/\n/g, '\\n'));

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
      authorization,  // ✅ 修复：使用小写变量名
      'User-Agent': 'daohen-payment/1.0',
    },
  };

  console.log(`[wxPayRequest] ${method} ${path}`);
  console.log(`[wxPayRequest] Authorization: ${authorization.substring(0, 60)}...`);

  let result;
  try {
    result = await httpsRequest(requestOptions, body);
  } catch (e) {
    console.error(`[wxPayRequest] ❌ 网络请求失败: ${e.message}`);
    throw e;
  }

  console.log(`[wxPayRequest] Response:`, JSON.stringify(result).substring(0, 300));
  return result;
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
      if (age < 10 * 60 * 1000 && latest.prepayId) {
        console.log(`[createOrder] 复用未支付订单: ${latest._id}，age=${Math.round(age / 1000)}s`);
        const params = generateAppPayParams(latest.prepayId);
        return {
          success: true,
          data: { orderId: latest._id, ...params },
        };
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

    // 3. 调用微信支付 JSAPI 下单
    const wxParams = {
      appid: APP_ID,
      mchid: MCH_ID,
      description: plan.label,
      out_trade_no: orderId,
      notify_url: NOTIFY_URL,
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
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'failed',
          error: wxError.message,
          updateTime: db.serverDate(),
        },
      });
      return {
        success: false,
        error: `微信支付下单失败: ${wxError.message}`,
      };
    }

    // 4. 检查微信返回
    if (wxResult.code || (wxResult.return_code && wxResult.return_code !== 'SUCCESS')) {
      const errMsg = wxResult.message || wxResult.err_code_des || JSON.stringify(wxResult);
      console.error(`[createOrder] ❌ 微信返回错误:`, errMsg);
      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'failed',
          error: errMsg,
          updateTime: db.serverDate(),
        },
      });
      return { success: false, error: `微信支付: ${errMsg}` };
    }

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
    if (localOrder.status === 'paid' || localOrder.status === 'failed') {
      return { success: true, data: localOrder };
    }

    // 微信侧已是终态但本地未更新 → 触发激活
    if (localOrder.transactionId) {
      try {
        const wxRes = await wxPayRequest(
          'GET',
          `/v3/pay/transactions/id/${localOrder.transactionId}?mchid=${MCH_ID}`,
          null
        );
        console.log(`[queryOrder] 微信查询结果: trade_state=${wxRes.trade_state}`);

        if (wxRes.trade_state === 'SUCCESS' && localOrder.status === 'pending') {
          console.log(`[queryOrder] 微信已支付，激活 Pro: ${orderId}`);
          await activateProFromOrder(orderId);
        }

        return {
          success: true,
          data: {
            ...localOrder,
            wxTradeState: wxRes.trade_state,
            wxTradeStateDesc: wxRes.trade_state_desc,
            updated: true,
          },
        };
      } catch (wxError) {
        console.warn(`[queryOrder] 微信查询失败，降级返回本地状态:`, wxError.message);
        return { success: true, data: localOrder, warning: wxError.message };
      }
    }

    // 无 transactionId（可能 prepayId 未使用）直接返回本地状态
    return { success: true, data: localOrder };
  } catch (error) {
    console.error(`[queryOrder] ❌ 查询失败:`, error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// 从订单激活 Pro（核心业务逻辑）
// ---------------------------------------------------------------------------

async function activateProFromOrder(orderId) {
  try {
    const orderRes = await db.collection('orders').doc(orderId).get();
    if (!orderRes.data) return false;

    const order = orderRes.data;
    const { openid, planType, durationMonths, durationDays } = order;
    const now = Date.now();

    let newExpiry;
    if (durationDays > 0) {
      newExpiry = now + durationDays * 24 * 60 * 60 * 1000;
    } else {
      newExpiry = now + durationMonths * 30 * 24 * 60 * 60 * 1000;
    }

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
      console.log(`[activateProFromOrder] ✅ 新用户开通 Pro，过期: ${new Date(newExpiry).toLocaleString()}`);
    } else {
      const user = userRes.data[0];
      const existingExpiry = user.proExpiry || 0;
      // 累加模式：当前 Pro 未过期则叠加
      const finalExpiry =
        existingExpiry > now
          ? existingExpiry + durationMonths * 30 * 24 * 60 * 60 * 1000
          : newExpiry;

      await db.collection('users').doc(user._id).update({
        data: {
          isPro: true,
          proExpiry: finalExpiry,
          updateTime: db.serverDate(),
        },
      });
      console.log(`[activateProFromOrder] ✅ 续期 Pro，过期: ${new Date(finalExpiry).toLocaleString()}`);
    }

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
