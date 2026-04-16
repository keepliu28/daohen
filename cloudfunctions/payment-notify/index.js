/**
 * 微信支付回调云函数（V3 Native/JsAPI 通用）
 *
 * 【重要】部署后必须在微信支付商户平台配置此云函数的 HTTP 触发 URL
 * 触发 URL 格式：https://${env}.env.[region].tcapi.run/payment-notify
 * 例如：https://my-env-xxxx.env.cn-shanghai.tcapi.run/payment-notify
 *
 * 微信支付回调要求：
 * 1. URL 必须为 HTTPS
 * 2. 必须返回 { "code": "SUCCESS", "message": "成功" } 才算签收成功
 * 3. 需要验签以确保回调来自微信支付
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 商户配置（需与 payment 云函数保持一致）
const MCH_ID = '1744187597'; // 商户号
const API_KEY = '1qaz2wsx3edc4rfv5tgb6yhn7ujm8ikl'; // APIv3 密钥（32位）
const APP_ID = 'wx4098138fe5a33e1c'; // 应用ID

// ---------------------------------------------------------------------------
// 验签工具（V3 回调）
// ---------------------------------------------------------------------------

/**
 * V3 回调签名算法：
 * Wechatpay-Signature: <base64 signature>
 * Wechatpay-Signature-Type: wechatpay-v3-signature
 * Wechatpay-Nonce: <nonce>
 * Wechatpay-Timestamp: <timestamp>
 * Authorization: <base64 signature>  (请求头)
 *
 * 签名原文 = HTTP_METHOD + "\n" + URL_PATH + "\n" + TIMESTAMP + "\n" + NONCE + "\n" + BODY + "\n"
 */
function verifySignature(signature, timestamp, nonce, body) {
  try {
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    // 解码签名（微信平台证书解密）
    const decryptedSignature = Buffer.from(signature, 'base64').toString('utf8');

    // 使用 APIv3 密钥进行 HMAC-SHA256 验签
    const secret = API_KEY;
    const computedSignature = crypto
      .createHmac('sha256', secret)
      .update(message, 'utf8')
      .digest('base64');

    return decryptedSignature === computedSignature;
  } catch (e) {
    console.error('[Notify] 验签失败:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 解密支付通知（V3 加密数据）
// ---------------------------------------------------------------------------

/**
 * 解密微信支付回调中的敏感数据（AES-256-GCM）
 * 微信返回的 plaintext = base64_decode(ciphertext)
 * 其中 nonce 是 response header 中的 Wechatpay-Nonce
 *       associated_data 是 response header 中的 Wechatpay-Attached-Data
 */
function decryptResource(ciphertext, nonce, associatedData) {
  try {
    const key = crypto.createHash('sha256').update(API_KEY).digest(); // APIv3 密钥取 SHA256 前32位
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));

    if (associatedData) {
      cipher.setAuthTag(Buffer.from(ciphertext.slice(-16), 'base64'));
    }

    const decrypted = Buffer.concat([
      cipher.update(Buffer.from(ciphertext.slice(0, -16), 'base64')),
      cipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  } catch (e) {
    console.error('[Notify] 解密失败:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 激活 Pro 会员
// ---------------------------------------------------------------------------

async function activatePro(openid, planType, orderId) {
  try {
    console.log(`[Notify] 开始激活 Pro: openid=${openid}, planType=${planType}, orderId=${orderId}`);

    // 查询订单获取时长
    const orderRes = await db.collection('orders').doc(orderId).get();
    if (!orderRes.data) {
      console.error(`[Notify] 订单不存在: ${orderId}`);
      return false;
    }

    const order = orderRes.data;
    const durationMonths = order.durationMonths || 0;
    const durationDays = order.durationDays || 0;

    // 计算新的过期时间
    let newExpiry;
    if (durationDays > 0) {
      // 按天续费
      newExpiry = Date.now() + durationDays * 24 * 60 * 60 * 1000;
    } else {
      // 按月续费
      newExpiry = Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000;
    }

    // 查询用户
    const userRes = await db
      .collection('users')
      .where({ openid })
      .limit(1)
      .get();

    if (userRes.data.length === 0) {
      // 创建用户记录
      await db.collection('users').add({
        data: {
          openid,
          isPro: true,
          proExpiry: newExpiry,
          createTime: db.serverDate(),
          updateTime: db.serverDate(),
        },
      });
      console.log(`[Notify] 新用户已创建 Pro 记录，过期时间: ${new Date(newExpiry).toLocaleString()}`);
    } else {
      const existingUser = userRes.data[0];
      const existingExpiry = existingUser.proExpiry || 0;

      // 累加过期时间（如果是叠加续费）
      const finalExpiry =
        existingExpiry > Date.now()
          ? existingExpiry + durationMonths * 30 * 24 * 60 * 60 * 1000
          : newExpiry;

      await db
        .collection('users')
        .doc(existingUser._id)
        .update({
          data: {
            isPro: true,
            proExpiry: finalExpiry,
            updateTime: db.serverDate(),
          },
        });
      console.log(`[Notify] 用户已续期 Pro，过期时间: ${new Date(finalExpiry).toLocaleString()}`);
    }

    // 更新订单状态
    await db
      .collection('orders')
      .doc(orderId)
      .update({
        data: {
          status: 'paid',
          payTime: db.serverDate(),
          transactionId: order.transactionId || null,
          updateTime: db.serverDate(),
        },
      });

    return true;
  } catch (error) {
    console.error('[Notify] 激活 Pro 失败:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// 云函数入口（HTTP 触发）
// ---------------------------------------------------------------------------

exports.main = async (event, context) => {
  const headers = event.headers || {};
  const body = event.body || event.rawBody || '{}';
  const signature = headers['wechatpay-signature'] || headers['wechatpay_signature'] || '';
  const timestamp = headers['wechatpay-timestamp'] || headers['wechatpay_timestamp'] || '';
  const nonce = headers['wechatpay-nonce'] || headers['wechatpay_nonce'] || '';
  const serialNo = headers['wechatpay-serial'] || headers['wechatpay_serial'] || '';

  console.log('[Notify] ===== 收到微信支付回调 =====');
  console.log('[Notify] 时间戳:', timestamp);
  console.log('[Notify] Nonce:', nonce);
  console.log('[Notify] 序列号:', serialNo);
  console.log('[Notify] Body:', typeof body === 'string' ? body : JSON.stringify(body));

  // 1. 验签（生产环境必须开启）
  // 注意：开发测试时如果验签失败可先注释掉，但生产必须验签！
  if (signature && timestamp && nonce) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
    const isValid = verifySignature(signature, timestamp, nonce, bodyStr);
    console.log('[Notify] 验签结果:', isValid);
    if (!isValid) {
      console.error('[Notify] ❌ 验签失败，拒绝处理');
      return {
        code: 'FAIL',
        message: '签名验证失败',
      };
    }
  } else {
    console.warn('[Notify] ⚠️ 缺少验签参数，跳过验签（非生产模式）');
  }

  // 2. 解析回调内容
  let notifyData;
  try {
    const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;

    // V3 加密回调格式：{ resource: { ciphertext, nonce, associated_data, algorithm } }
    if (bodyObj.resource) {
      const { ciphertext, nonce: decNonce, associated_data } = bodyObj.resource;
      notifyData = decryptResource(ciphertext, decNonce, associated_data);
      if (!notifyData) {
        return { code: 'FAIL', message: '解密失败' };
      }
    } else {
      // 明文回调（测试用）
      notifyData = bodyObj;
    }
  } catch (e) {
    console.error('[Notify] 解析回调数据失败:', e);
    return { code: 'FAIL', message: '解析失败' };
  }

  console.log('[Notify] 解密后数据:', JSON.stringify(notifyData));

  // 3. 处理回调类型
  const eventType = notifyData.event_type || notifyData.eventType || '';
  const tradeState = notifyData.trade_state || notifyData.tradeState || '';
  const orderId = notifyData.out_trade_no || notifyData.orderId || '';
  const transactionId = notifyData.transaction_id || notifyData.transactionId || '';
  const openid = notifyData.payer?.openid || notifyData.openid || '';

  // 4. 处理支付成功回调
  if (
    tradeState === 'SUCCESS' ||
    eventType === 'TRANSACTION.SUCCESS' ||
    tradeState === 'SUCCESS'
  ) {
    console.log(`[Notify] ✅ 检测到支付成功: orderId=${orderId}`);

    // 查询当前订单状态，防止重复处理
    try {
      const existingOrder = await db.collection('orders').doc(orderId).get();
      if (existingOrder.data && existingOrder.data.status === 'paid') {
        console.log(`[Notify] 订单 ${orderId} 已是 paid 状态，跳过重复处理`);
        return { code: 'SUCCESS', message: '成功' };
      }
    } catch (e) {
      // 忽略
    }

    // 更新 transaction_id
    if (transactionId) {
      await db
        .collection('orders')
        .doc(orderId)
        .update({
          data: {
            transactionId,
            updateTime: db.serverDate(),
          },
        });
    }

    // 激活 Pro
    const planType = notifyData.planType || 'monthly';
    const activated = await activatePro(openid, planType, orderId);

    if (activated) {
      console.log(`[Notify] ✅ Pro 激活完成: orderId=${orderId}`);
      return { code: 'SUCCESS', message: '成功' };
    } else {
      console.error(`[Notify] ❌ Pro 激活失败: orderId=${orderId}`);
      return { code: 'FAIL', message: '激活失败' };
    }
  }

  // 5. 处理支付失败
  if (
    tradeState === 'PAYERROR' ||
    tradeState === 'CLOSED' ||
    eventType === 'TRANSACTION.REFUND'
  ) {
    console.log(`[Notify] 检测到交易状态变化: ${tradeState}`);
    try {
      await db
        .collection('orders')
        .doc(orderId)
        .update({
          data: {
            status: tradeState === 'PAYERROR' ? 'failed' : 'closed',
            updateTime: db.serverDate(),
          },
        });
    } catch (e) {}
    return { code: 'SUCCESS', message: '成功' };
  }

  // 6. 其他情况：返回成功避免重复推送
  console.log(`[Notify] 未处理的回调类型: eventType=${eventType}, tradeState=${tradeState}`);
  return { code: 'SUCCESS', message: '成功' };
};
