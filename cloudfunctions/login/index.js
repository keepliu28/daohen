// 云函数：登录 & 检查会话
// 部署：在 cloudfunctions/login 文件夹右击选择 "上传并部署"

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action || 'login';

  console.log('[Login] action:', action, 'openid:', openid);

  // -------------------------------------------------------
  // action: login — 返回用户信息
  // -------------------------------------------------------
  if (action === 'login') {
    if (!openid) {
      return { success: false, error: '无法获取用户身份' };
    }

    // 确保用户记录存在（无则创建）
    try {
      const existing = await db
        .collection('users')
        .where({ openid })
        .limit(1)
        .get();

      if (existing.data.length === 0) {
        await db.collection('users').add({
          data: {
            openid,
            isPro: false,
            proExpiry: 0,
            createTime: db.serverDate(),
            updateTime: db.serverDate(),
          },
        });
        console.log('[Login] 新用户记录已创建:', openid);
      } else {
        console.log('[Login] 用户已存在:', openid);
      }
    } catch (e) {
      console.warn('[Login] 用户记录创建/查询失败（不影响登录）:', e.message);
    }

    return {
      success: true,
      data: {
        openid,
        appid: wxContext.APPID,
        unionid: wxContext.UNIONID || null,
        env: wxContext.ENV,
        loginTime: Date.now(),
      },
    };
  }

  // -------------------------------------------------------
  // action: checkSession — 验证 session 是否有效
  // 注意：微信的 checkSession 是客户端 API，这里是云函数版本
  // 前端不应调用云函数 checkSession，应该用 Taro.checkSession()
  // -------------------------------------------------------
  if (action === 'checkSession') {
    if (!openid) {
      return { success: false, error: '无法获取用户身份' };
    }

    // 云端 session 检查：验证用户在 users 集合中存在
    try {
      const userRes = await db
        .collection('users')
        .where({ openid })
        .limit(1)
        .get();

      if (userRes.data.length > 0) {
        return { success: true, valid: true, openid };
      } else {
        return { success: true, valid: false, openid, error: '用户记录不存在' };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // -------------------------------------------------------
  // 默认
  // -------------------------------------------------------
  return {
    success: false,
    error: `未知操作: ${action}`,
  };
};
