const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

// 商户配置（与 payment 云函数一致）
const MCH_ID = '1744187597';
const APP_ID = 'wx4098138fe5a33e1c';
const SERIAL_NO = '50705023C38D8B39A5A4050F61052AB9E371CC14';

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

async function testWechatPayAPI() {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  console.log('========================================');
  console.log('🔍 开始诊断微信支付配置');
  console.log('========================================');
  console.log('');
  console.log('📋 基础信息:');
  console.log('- OpenID:', openid);
  console.log('- 商户号:', MCH_ID);
  console.log('- AppID:', APP_ID);
  console.log('- 证书序列号:', SERIAL_NO);
  console.log('');

  // 诊断步骤1：测试签名
  console.log('✅ 步骤 1: 测试 RSA 签名...');
  const testSignStr = `GET\n/test\n1234567890\nabcdefg\n`;
  const signature = rsaSign(testSignStr);
  console.log('- 签名成功:', signature.substring(0, 50) + '...');
  console.log('');

  // 诊断步骤2：尝试调用微信支付 API
  console.log('✅ 步骤 2: 尝试调用微信支付 API...');
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonceStr();
  const path = '/v3/pay/transactions/jsapi';
  
  const testBody = {
    appid: APP_ID,
    mchid: MCH_ID,
    description: '测试订单',
    out_trade_no: `TEST_${Date.now()}`,
    notify_url: 'https://servicewechat.com/wx4098138fe5a33e1c/pages/profile/index',
    amount: {
      total: 1,
      currency: 'CNY',
    },
    payer: {
      openid: openid,
    },
  };

  const signStr = [
    'POST',
    path,
    timestamp,
    nonce,
    JSON.stringify(testBody)
  ].join('\n') + '\n';

  const signResult = rsaSign(signStr);

  const authorization =
    `WECHATPAY2-SHA256-RSA2048 ` +
    `mchid="${MCH_ID}",` +
    `nonce_str="${nonce}",` +
    `signature="${signResult}",` +
    `timestamp="${timestamp}",` +
    `serial_no="${SERIAL_NO}"`;

  console.log('- Authorization:', authorization.substring(0, 80) + '...');
  console.log('');

  const urlObj = new URL(`https://api.mch.weixin.qq.com${path}`);
  const requestOptions = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      authorization,
      'User-Agent': 'daohen-diagnostic/1.0',
    },
  };

  console.log('📡 正在调用微信支付 API...');
  console.log('');

  try {
    const result = await httpsRequest(requestOptions, JSON.stringify(testBody));
    
    console.log('========================================');
    console.log('📊 API 响应结果:');
    console.log('========================================');
    console.log('- HTTP 状态码:', result.status);
    console.log('- 响应数据:', JSON.stringify(result.data, null, 2));
    console.log('');

    if (result.status === 200 && result.data.prepay_id) {
      console.log('✅✅✅ 诊断结果：配置完全正确！');
      console.log('');
      console.log('📋 配置检查清单:');
      console.log('✅ 商户号正确');
      console.log('✅ AppID 正确');
      console.log('✅ 私钥正确');
      console.log('✅ 证书序列号正确');
      console.log('✅ 支付授权目录已配置');
      console.log('✅ AppID 与商户号已绑定');
      console.log('');
      console.log('🎉 可以正常使用支付功能！');
      
      return {
        success: true,
        message: '配置正确',
        prepayId: result.data.prepay_id,
      };
    } else if (result.status >= 400) {
      console.log('❌❌ 诊断结果：配置有问题！');
      console.log('');
      
      const errorCode = result.data?.code || 'UNKNOWN';
      const errorMessage = result.data?.message || JSON.stringify(result.data);
      
      console.log('🔴 错误代码:', errorCode);
      console.log('🔴 错误信息:', errorMessage);
      console.log('');
      
      // 错误分析
      console.log('📋 可能的原因:');
      if (errorCode === 'PARAM_ERROR') {
        console.log('- 参数配置错误（检查 notify_url、merchant_id 等）');
      } else if (errorCode === 'SIGN_ERROR') {
        console.log('- 签名错误（检查私钥、证书序列号）');
      } else if (errorCode === 'CERTIFICATE_ERROR') {
        console.log('- 证书错误（检查证书是否有效）');
      } else if (errorMessage.includes('access denied')) {
        console.log('- 权限拒绝（最常见原因）:');
        console.log('  1. 支付授权目录未配置');
        console.log('  2. AppID 与商户号未正确绑定');
        console.log('  3. 商户号状态异常');
      }
      console.log('');
      console.log('💡 解决方案:');
      console.log('1. 登录 https://pay.weixin.qq.com');
      console.log('2. 进入 产品中心 → 开发配置');
      console.log('3. 检查 JSAPI 支付的"支付授权目录"');
      console.log('4. 添加目录：https://servicewechat.com/wx4098138fe5a33e1c/');
      console.log('');
      
      return {
        success: false,
        errorCode,
        errorMessage,
        status: result.status,
      };
    }
  } catch (error) {
    console.log('❌ 调用失败:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

exports.main = async (event, context) => {
  return await testWechatPayAPI();
};
