import Taro from '@tarojs/taro';

const DB_COLLECTION = 'entries';

// -----------------------------------------------------------------------------
// 1. 登录与用户管理
// -----------------------------------------------------------------------------

// 统一的存储键名常量
const STORAGE_KEYS = {
  OPENID: 'openid',
  USER_PROFILE: 'user_profile',
  ENTRIES: 'DAOHEN_ENTRIES',
  LOGIN_TIMESTAMP: 'login_timestamp'
};

/**
 * 获取当前用户的 OpenID
 */
export const getOpenId = () => {
  const openid = Taro.getStorageSync(STORAGE_KEYS.OPENID);
  console.log('[getOpenId] 获取到的 openid:', openid);
  return openid;
};

/**
 * 设置当前用户的 OpenID
 */
export const setOpenId = (openid: string) => {
  console.log('[setOpenId] 准备保存 openid:', openid);
  Taro.setStorageSync(STORAGE_KEYS.OPENID, openid);
  // 记录登录时间戳
  Taro.setStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP, Date.now());
  console.log('[setOpenId] openid 已保存，验证读取:', Taro.getStorageSync(STORAGE_KEYS.OPENID));
};

/**
 * 获取用户资料
 */
export const getUserProfile = () => {
  return Taro.getStorageSync(STORAGE_KEYS.USER_PROFILE);
};

/**
 * 保存用户资料到本地和云端
 */
export const saveUserProfile = async (profile: any) => {
  try {
    // 1. 保存到本地存储
    Taro.setStorageSync(STORAGE_KEYS.USER_PROFILE, profile);
    
    // 2. 保存到云端数据库
    const db = Taro.cloud.database();
    const openid = getOpenId();
    
    console.log('[saveUserProfile] 开始保存用户信息，openid:', openid);
    
    if (!openid) {
      console.error('[saveUserProfile] 未找到 openid，无法保存到云端');
      return;
    }
    
    try {
      // 检查用户是否已存在（使用 openid 字段查询）
      console.log('[saveUserProfile] 查询用户是否存在...');
      const existingUser = await db.collection('users').where({
        openid: openid
      }).limit(1).get();
      
      console.log('[saveUserProfile] 查询结果:', existingUser.data.length, '条记录');
      
      if (existingUser.data.length > 0) {
        // 更新现有用户
        console.log('[saveUserProfile] 更新现有用户...');
        await db.collection('users').doc(existingUser.data[0]._id).update({
          data: {
            ...profile,
            updateTime: db.serverDate()
          }
        });
        console.log('用户信息已更新到云端');
      } else {
        // 新增用户 - 不手动添加 _openid，系统会自动添加
        console.log('[saveUserProfile] 新增用户...');
        const addResult = await db.collection('users').add({
          data: {
            ...profile,
            openid: openid,
            createTime: db.serverDate(),
            updateTime: db.serverDate()
          }
        });
        console.log('用户信息已新增到云端，_id:', addResult._id);
      }
    } catch (dbError) {
      console.error('[saveUserProfile] 数据库操作失败:', dbError);
      console.error('[saveUserProfile] 错误详情:', dbError.errCode, dbError.errMsg);
      
      // 如果是权限错误，给出明确提示
      if (dbError.errCode === -502003) {
        console.error('[saveUserProfile] 数据库权限不足，请检查云开发控制台权限配置');
        Taro.showModal({
          title: '权限错误',
          content: '数据库权限不足，请联系管理员检查 users 集合的权限配置',
          showCancel: false
        });
      }
      
      // 抛出错误，让调用方知道保存失败
      throw dbError;
    }
    
  } catch (error) {
    console.error('[saveUserProfile] 保存失败:', error);
    // 即使云端保存失败，也要确保本地保存成功
    Taro.setStorageSync(STORAGE_KEYS.USER_PROFILE, profile);
    throw error; // 重新抛出错误，让调用方知道失败
  }
};

/**
 * 更新用户的日记计数
 * @param {string} openid - 用户的 openid
 * @param {number} delta - 变化数量（+1 或 -1）
 */
export const updateUserEntryCount = async (openid: string, delta: number) => {
  try {
    const db = Taro.cloud.database();
    
    // 查找用户
    const userRes = await db.collection('users').where({
      openid: openid
    }).limit(1).get();
    
    if (userRes.data.length > 0) {
      // 更新现有用户的计数
      const userId = userRes.data[0]._id;
      const currentCount = userRes.data[0].entryCount || 0;
      
      await db.collection('users').doc(userId).update({
        data: {
          entryCount: currentCount + delta,
          updateTime: db.serverDate()
        }
      });
      
      console.log(`[updateUserEntryCount] 用户 ${openid} 的日记计数已更新：${currentCount} → ${currentCount + delta}`);
    } else {
      // 用户不存在，创建新用户记录（带初始计数）
      await db.collection('users').add({
        data: {
          openid: openid,
          entryCount: delta > 0 ? delta : 0,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
      
      console.log(`[updateUserEntryCount] 创建新用户记录，初始计数：${delta > 0 ? delta : 0}`);
    }
  } catch (error) {
    console.error('[updateUserEntryCount] 更新计数失败:', error);
    // 不抛出错误，避免影响主流程
  }
};

/**
 * 检查登录状态是否有效
 * @returns Promise<boolean>
 */
export const checkLoginStatus = async (): Promise<boolean> => {
  const openid = getOpenId();
  const loginTimestamp = Taro.getStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP);
  
  // 如果没有 openid，说明未登录
  if (!openid) {
    return false;
  }
  
  // 检查登录时间是否超过7天（需要重新登录）
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - loginTimestamp > sevenDays) {
    clearLoginData();
    return false;
  }
  
  try {
    // 检查云函数会话是否有效
    await Taro.cloud.callFunction({
      name: 'checkSession',
      timeout: 5000
    });
    return true;
  } catch (error) {
    console.warn('会话检查失败:', error);
    // 会话失效，清除登录数据
    clearLoginData();
    return false;
  }
};

/**
 * 清除登录数据
 */
export const clearLoginData = () => {
  Taro.removeStorageSync(STORAGE_KEYS.OPENID);
  Taro.removeStorageSync(STORAGE_KEYS.USER_PROFILE);
  Taro.removeStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP);
};

/**
 * 获取登录状态信息
 */
export const getLoginInfo = () => {
  return {
    openid: getOpenId(),
    userProfile: getUserProfile(),
    loginTimestamp: Taro.getStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP),
    isLoggedIn: !!getOpenId()
  };
};

// -----------------------------------------------------------------------------
// 2. 数据库操作 (云端优先，本地作为缓存/降级)
// -----------------------------------------------------------------------------

/**
 * 获取所有日记 (从云端获取)
 */
export const getEntries = async (limit: number = 20, offset: number = 0) => {
  try {
    const db = Taro.cloud.database();
    const res = await db.collection(DB_COLLECTION).orderBy('createTime', 'desc').limit(limit).skip(offset).get();
    
    const entries = res.data.map(item => {
      // 兼容旧的 id 字段
      if (!item.id && item._id) {
        item.id = item._id;
      }
      return item;
    });
    return entries;
  } catch (error) {
    console.error('Failed to get entries from cloud:', error);
    // 当云端获取失败时，不再尝试从本地获取所有，因为本地可能也存储了大量数据。
    // 此时应该返回空数组或抛出错误，让上层决定如何处理。
    return [];
  }
};

/**
 * 保存或更新日记 (同步到云端和本地)
 */
export const saveEntry = async (entry) => {
  // 检查用户是否登录
  const openid = getOpenId();
  if (!openid) {
    throw new Error('用户未登录，请先登录后再保存日记');
  }
  
  const db = Taro.cloud.database();
  const collection = db.collection(DB_COLLECTION);
  
  try {
    // 检查是否已存在 (通过 id 或 _id)
    const queryId = entry._id || entry.id;
    let isNewEntry = false;
    
    if (queryId) {
      // 尝试在云端查找
      const checkRes = await collection.where({
        _id: queryId
      }).get();
      
      if (checkRes.data.length > 0) {
        // 更新现有日记
        const { _id, _openid, ...updateData } = entry;
        updateData.updateTime = new Date().getTime();
        
        await collection.doc(queryId).update({
          data: updateData
        });
        console.log('[saveEntry] 日记已更新');
      } else {
        // 日记不存在，按新增处理
        isNewEntry = true;
      }
    } else {
      // 新增 (没有 id)
      isNewEntry = true;
    }
    
    // 如果是新增日记，需要检查配额
    if (isNewEntry) {
      // 检查容量配额
      const quotaCheck = await checkQuota();
      if (!quotaCheck.canProceed) {
        // 显示升级提示
        showQuotaUpgradeModal(quotaCheck.quotaType!, quotaCheck.current, quotaCheck.limit);
        throw new Error(`配额不足：${quotaCheck.quotaType} 已达上限`);
      }
      
      entry.createTime = entry.createTime || new Date().getTime();
      entry.updateTime = entry.updateTime || new Date().getTime();
      const addRes = await collection.add({
        data: entry
      });
      entry._id = addRes._id;
      entry.id = addRes._id; // 保持兼容
      
      // 更新用户的日记计数
      await updateUserEntryCount(openid, 1);
      console.log('[saveEntry] 新增日记，用户计数 +1');
    }
    
    // 更新本地缓存
    const entries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const existingIndex = entries.findIndex(e => (e.id === entry.id || e._id === entry._id));
    
    let newEntries;
    if (existingIndex >= 0) {
      newEntries = [...entries];
      newEntries[existingIndex] = entry;
    } else {
      newEntries = [entry, ...entries];
    }
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    
    return newEntries;
  } catch (error) {
    console.error('Failed to save entry to cloud:', error);
    
    // 明确区分权限错误和其他错误
    if (error.errCode === -502003) {
      // 权限错误：明确告知用户需要配置权限
      throw new Error('数据库权限被拒绝，请检查云开发控制台权限配置');
    }
    
    // 如果是未登录错误，直接抛出
    if (error.message === '用户未登录，请先登录后再保存日记') {
      throw error;
    }
    
    // 其他错误：降级到本地保存，但明确告知用户
    console.warn('云端保存失败，降级到本地保存');
    const entries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const existingIndex = entries.findIndex(e => e.id === entry.id);
    let newEntries;
    if (existingIndex >= 0) {
      newEntries = [...entries];
      newEntries[existingIndex] = entry;
    } else {
      newEntries = [entry, ...entries];
    }
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    
    // 返回降级结果，但标记为降级
    return { 
      entries: newEntries, 
      isFallback: true,
      error: error.message 
    };
  }
};

/**
 * 删除日记
 */
export const deleteEntryById = async (id) => {
  try {
    const db = Taro.cloud.database();
    
    // 先获取要删除的日记，确认其存在
    const entryRes = await db.collection(DB_COLLECTION).doc(id).get();
    
    if (entryRes.data) {
      // 删除日记
      await db.collection(DB_COLLECTION).doc(id).remove();
      
      // 获取当前用户的 openid
      const openid = getOpenId();
      if (openid) {
        // 减少用户的日记计数
        await updateUserEntryCount(openid, -1);
        console.log('[deleteEntryById] 删除日记，用户计数 -1');
      }
      
      // 更新本地缓存
      const entries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
      const newEntries = entries.filter(e => e.id !== id && e._id !== id);
      Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
      
      return newEntries;
    } else {
      throw new Error('日记不存在');
    }
  } catch (error) {
    console.error('Failed to delete entry from cloud:', error);
    // 降级：仅从本地删除
    const entries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    return newEntries;
  }
};

// -----------------------------------------------------------------------------
// 3. 数据迁徙 (本地 -> 云端)
// -----------------------------------------------------------------------------

/**
 * 将本地旧数据迁移到云端
 * 建议在设置页提供一个按钮手动触发，或者在应用启动时检测并自动触发
 */
export const migrateLocalToCloud = async () => {
  const localEntries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
  if (localEntries.length === 0) {
    console.log('No local data to migrate.');
    return { success: true, count: 0 };
  }

  const db = Taro.cloud.database();
  const collection = db.collection(DB_COLLECTION);
  let successCount = 0;

  Taro.showLoading({ title: '数据同步中...' });

  for (const entry of localEntries) {
    try {
      // 检查云端是否已存在该记录 (通过 id 匹配)
      const checkRes = await collection.where({
        id: entry.id
      }).get();

      if (checkRes.data.length === 0) {
        // 云端不存在，添加
        const { _id, _openid, ...addData } = entry; // 移除可能冲突的系统字段
        await collection.add({
          data: addData
        });
        successCount++;
      }
    } catch (error) {
      console.error(`Failed to migrate entry ${entry.id}:`, error);
    }
  }

  Taro.hideLoading();
  Taro.showToast({
    title: `成功同步 ${successCount} 条记录`,
    icon: 'success'
  });

  return { success: true, count: successCount };
};

// -----------------------------------------------------------------------------
// 4. 用户资料管理 (头像、昵称)
// -----------------------------------------------------------------------------

/**
 * 从云端获取用户资料
 */
export const fetchUserProfileFromCloud = async () => {
  try {
    const db = Taro.cloud.database();
    const openid = getOpenId();
    if (!openid) return null;
    
    // 使用 openid 作为查询条件，避免全表扫描
    const res = await db.collection('users').where({
      openid: openid
    }).limit(1).get();
    
    if (res.data.length > 0) {
      return res.data[0];
    }
    return null;
  } catch (e) {
    console.error('Failed to get user profile', e);
    return null;
  }
};

/**
 * 保存用户资料到云端
 */
export const saveUserProfileToCloud = async (profile) => {
  try {
    const db = Taro.cloud.database();
    const openid = getOpenId();
    if (!openid) return false;
    
    // 使用 openid 作为查询条件，避免全表扫描
    const res = await db.collection('users').where({
      openid: openid
    }).limit(1).get();
    
    if (res.data.length > 0) {
      await db.collection('users').doc(res.data[0]._id).update({
        data: {
          ...profile,
          updateTime: db.serverDate()
        }
      });
    } else {
      await db.collection('users').add({
        data: {
          ...profile,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    }
    
    return true;
  } catch (e) {
    console.error('Failed to save user profile', e);
    return false;
  }
};

export const uploadAvatar = async (tempFilePath) => {
  try {
    const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    const res = await Taro.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
    });
    return res.fileID;
  } catch (e) {
    console.error('Failed to upload avatar', e);
    return null;
  }
};

// 云开发状态检查函数
export const checkCloudStatus = async (): Promise<{ available: boolean; error?: string; details?: any }> => {
  if (!Taro.cloud) {
    console.error('[云开发] 云开发功能不可用');
    return { 
      available: false, 
      error: '云开发功能未启用，请检查小程序配置',
      details: { type: 'cloud_not_available' }
    };
  }
  
  try {
    // 测试云函数
    const testRes = await Taro.cloud.callFunction({
      name: 'login',
      data: {}
    });
    console.log('[云开发] 云函数测试通过:', testRes);
    
    // 测试数据库
    const db = Taro.cloud.database();
    const dbTest = await db.collection('entries').limit(1).get();
    console.log('[云开发] 数据库测试通过:', dbTest);
    
    return { 
      available: true,
      details: { 
        cloudFunction: true, 
        database: true,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error: any) {
    console.error('[云开发] 功能测试失败:', error);
    
    let errorMessage = '云开发服务异常';
    let errorType = 'unknown';
    
    if (error.errCode) {
      switch (error.errCode) {
        case -404011:
          errorMessage = '云函数不存在，请检查云函数部署状态';
          errorType = 'function_not_found';
          break;
        case -501000:
          errorMessage = '数据库连接失败，请检查网络连接';
          errorType = 'database_connection_failed';
          break;
        case -401003:
          errorMessage = '云开发环境配置错误，请检查环境ID';
          errorType = 'env_config_error';
          break;
        default:
          errorMessage = `云开发服务异常 (错误码: ${error.errCode})`;
          errorType = 'cloud_service_error';
      }
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return { 
      available: false, 
      error: errorMessage,
      details: { 
        type: errorType,
        errCode: error.errCode,
        message: error.message
      }
    };
  }
};

// 重试机制函数
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[重试] 第 ${attempt + 1} 次尝试失败:`, error);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
};

// 带重试的数据获取
export const getEntriesWithRetry = async (maxRetries: number = 2) => {
  return retryOperation(() => getEntries(), maxRetries);
};

// 带重试的数据保存
export const saveEntryWithRetry = async (entry: any, maxRetries: number = 2) => {
  return retryOperation(() => saveEntry(entry), maxRetries);
};

// -----------------------------------------------------------------------------
// 5. 订阅与容量管理
// -----------------------------------------------------------------------------

/**
 * 订阅配额配置
 */
export const SUBSCRIPTION_CONFIG = {
  // 免费版配额
  FREE: {
    maxEntriesPerMonth: 30,  // 每月最多 30 条深潜记录
    passwordLock: false,     // 不支持密码锁
    cloudBackup: false       // 不保证数据不丢失
  },
  // Pro 版配额
  PRO: {
    maxEntriesPerMonth: 99999,  // 无限记录
    passwordLock: true,         // 支持 3 位数字密码锁
    cloudBackup: true           // 云备份，换设备不丢失
  }
};

/**
 * 获取用户订阅状态
 */
export const getUserSubscription = async (): Promise<{
  isPro: boolean;
  proExpiry?: number;
  currentPeriodStart: number;
  entriesThisMonth: number;
}> => {
  const openid = getOpenId();
  if (!openid) {
    throw new Error('用户未登录');
  }

  try {
    const db = Taro.cloud.database();
    const userRes = await db.collection('users').where({
      openid: openid
    }).limit(1).get();

    if (userRes.data.length === 0) {
      // 用户不存在，返回免费版
      return {
        isPro: false,
        currentPeriodStart: Date.now(),
        entriesThisMonth: 0
      };
    }

    const userData = userRes.data[0];
    const isPro = userData.isPro || false;
    const proExpiry = userData.proExpiry || 0;
    
    // 检查 Pro 是否过期
    const now = Date.now();
    const effectiveIsPro = isPro && proExpiry > now;

    // 计算本月已用条目数
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const entriesRes = await db.collection('entries').where({
      openid: openid,
      createTime: db.command.gte(startOfMonth.getTime())
    }).count();

    return {
      isPro: effectiveIsPro,
      proExpiry: effectiveIsPro ? proExpiry : undefined,
      currentPeriodStart: startOfMonth.getTime(),
      entriesThisMonth: entriesRes.count
    };
  } catch (error) {
    console.error('[getUserSubscription] 获取订阅状态失败:', error);
    // 出错时返回免费版
    return {
      isPro: false,
      currentPeriodStart: Date.now(),
      entriesThisMonth: 0
    };
  }
};

/**
 * 检查用户是否有足够的配额
 */
export const checkQuota = async (): Promise<{
  canProceed: boolean;
  quotaType: 'entries' | null;
  current: number;
  limit: number;
  isPro: boolean;
}> => {
  const subscription = await getUserSubscription();
  const quota = subscription.isPro ? SUBSCRIPTION_CONFIG.PRO : SUBSCRIPTION_CONFIG.FREE;

  // 检查条目配额
  if (subscription.entriesThisMonth >= quota.maxEntriesPerMonth) {
    return {
      canProceed: false,
      quotaType: 'entries',
      current: subscription.entriesThisMonth,
      limit: quota.maxEntriesPerMonth,
      isPro: subscription.isPro
    };
  }

  return {
    canProceed: true,
    quotaType: null,
    current: 0,
    limit: 0,
    isPro: subscription.isPro
  };
};

/**
 * 显示配额升级提示
 */
export const showQuotaUpgradeModal = (quotaType: 'entries', current: number, limit: number) => {
  Taro.showModal({
    title: '本月额度提醒',
    content: `您本月已完成${current}次深潜，免费额度（${limit}次）已用完。升级 Pro 解锁无限记录，持续探索内心世界。`,
    confirmText: '了解 Pro',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm) {
        // 跳转到 Pro 订阅页面
        Taro.navigateTo({
          url: '/pages/pro/index'
        });
      }
    }
  });
};

/**
 * 升级用户为 Pro 会员
 */
export const upgradeToPro = async (durationMonths: number = 1): Promise<boolean> => {
  const openid = getOpenId();
  if (!openid) {
    throw new Error('用户未登录');
  }

  try {
    const db = Taro.cloud.database();
    const now = Date.now();
    const expiryTime = now + (durationMonths * 30 * 24 * 60 * 60 * 1000); // 按月计算

    // 查找用户
    const userRes = await db.collection('users').where({
      openid: openid
    }).limit(1).get();

    if (userRes.data.length === 0) {
      // 用户不存在，创建新用户记录
      await db.collection('users').add({
        data: {
          openid,
          isPro: true,
          proExpiry: expiryTime,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      });
    } else {
      // 更新现有用户
      const userId = userRes.data[0]._id;
      await db.collection('users').doc(userId).update({
        data: {
          isPro: true,
          proExpiry: expiryTime,
          updateTime: db.serverDate()
        }
      });
    }

    console.log(`[upgradeToPro] 用户 ${openid} 已升级为 Pro，过期时间：${new Date(expiryTime).toISOString()}`);
    return true;
  } catch (error) {
    console.error('[upgradeToPro] 升级失败:', error);
    return false;
  }
};

// -----------------------------------------------------------------------------
// 7. 密码锁管理
// -----------------------------------------------------------------------------

const PASSWORD_LOCK_KEY = 'password_lock_';

/**
 * 设置日记密码锁
 */
export const setEntryPassword = async (entryId: string, password: string): Promise<boolean> => {
  try {
    const key = PASSWORD_LOCK_KEY + entryId;
    Taro.setStorageSync(key, password);
    return true;
  } catch (error) {
    console.error('[setEntryPassword] 设置密码失败:', error);
    return false;
  }
};

/**
 * 验证日记密码
 */
export const verifyEntryPassword = async (entryId: string, password: string): Promise<boolean> => {
  try {
    const key = PASSWORD_LOCK_KEY + entryId;
    const storedPassword = Taro.getStorageSync(key);
    return storedPassword === password;
  } catch (error) {
    console.error('[verifyEntryPassword] 验证密码失败:', error);
    return false;
  }
};

/**
 * 检查日记是否有密码锁
 */
export const hasPasswordLock = (entryId: string): boolean => {
  try {
    const key = PASSWORD_LOCK_KEY + entryId;
    const password = Taro.getStorageSync(key);
    return !!password;
  } catch (error) {
    console.error('[hasPasswordLock] 检查密码锁失败:', error);
    return false;
  }
};

/**
 * 移除日记密码锁
 */
export const removeEntryPassword = async (entryId: string): Promise<boolean> => {
  try {
    const key = PASSWORD_LOCK_KEY + entryId;
    Taro.removeStorageSync(key);
    return true;
  } catch (error) {
    console.error('[removeEntryPassword] 移除密码失败:', error);
    return false;
  }
};

// -----------------------------------------------------------------------------
// 8. 用户注销与数据删除
// -----------------------------------------------------------------------------

/**
 * 用户注销 - 删除所有数据（本地 + 云端）
 * 警告：此操作不可恢复！
 */
export const deleteUserAccount = async (): Promise<{
  success: boolean;
  message: string;
  deletedEntries?: number;
  deletedUser?: boolean;
}> => {
  const openid = getOpenId();
  if (!openid) {
    return {
      success: false,
      message: '用户未登录'
    };
  }

  try {
    const db = Taro.cloud.database();

    // 1. 删除云端所有日记
    console.log('[deleteUserAccount] 开始删除云端日记...');
    let deletedEntriesCount = 0;
    try {
      // 分批删除日记（每次最多 1000 条）
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const entriesRes = await db.collection('entries')
          .where({ _openid: openid })
          .limit(batchSize)
          .get();
        
        if (entriesRes.data.length === 0) {
          hasMore = false;
          break;
        }
        
        // 批量删除
        const deletePromises = entriesRes.data.map(entry => 
          db.collection('entries').doc(entry._id).remove()
        );
        await Promise.all(deletePromises);
        
        deletedEntriesCount += entriesRes.data.length;
        console.log(`[deleteUserAccount] 已删除 ${deletedEntriesCount} 条日记`);
      }
      
      console.log(`[deleteUserAccount] 云端日记删除完成，共删除 ${deletedEntriesCount} 条`);
    } catch (entriesError) {
      console.error('[deleteUserAccount] 删除日记失败:', entriesError);
      // 继续删除用户数据
    }

    // 2. 删除云端用户记录
    let deletedUser = false;
    try {
      console.log('[deleteUserAccount] 开始删除用户记录...');
      const userRes = await db.collection('users')
        .where({ _openid: openid })
        .get();
      
      if (userRes.data.length > 0) {
        await db.collection('users').doc(userRes.data[0]._id).remove();
        deletedUser = true;
        console.log('[deleteUserAccount] 用户记录已删除');
      }
    } catch (userError) {
      console.error('[deleteUserAccount] 删除用户记录失败:', userError);
    }

    // 3. 清除本地存储
    console.log('[deleteUserAccount] 清除本地存储...');
    Taro.removeStorageSync(STORAGE_KEYS.OPENID);
    Taro.removeStorageSync(STORAGE_KEYS.USER_PROFILE);
    Taro.removeStorageSync(STORAGE_KEYS.ENTRIES);
    Taro.removeStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP);
    
    // 清除所有密码锁
    const keys = Taro.getStorageInfoSync().keys;
    keys.forEach(key => {
      if (key.startsWith(PASSWORD_LOCK_KEY)) {
        Taro.removeStorageSync(key);
      }
    });
    
    console.log('[deleteUserAccount] 本地存储已清除');

    return {
      success: true,
      message: '账号已注销，所有数据已删除',
      deletedEntries: deletedEntriesCount,
      deletedUser
    };
  } catch (error) {
    console.error('[deleteUserAccount] 注销失败:', error);
    return {
      success: false,
      message: error.message || '注销失败，请稍后重试'
    };
  }
};

// -----------------------------------------------------------------------------
// 6. 数据同步策略优化
// -----------------------------------------------------------------------------

// 冲突解决策略
export const resolveConflict = (localEntry: any, cloudEntry: any): any => {
  // 优先使用较新的数据
  const localTime = localEntry.updateTime || localEntry.createTime;
  const cloudTime = cloudEntry.updateTime || cloudEntry.createTime;
  
  if (localTime > cloudTime) {
    console.log('[数据同步] 使用本地数据，本地数据较新');
    return { ...cloudEntry, ...localEntry, _id: cloudEntry._id };
  } else {
    console.log('[数据同步] 使用云端数据，云端数据较新');
    return { ...localEntry, ...cloudEntry, id: cloudEntry._id };
  }
};

// 智能数据同步
export const syncEntries = async (): Promise<{ success: boolean; synced: number; errors: number }> => {
  try {
    console.log('[数据同步] 开始智能同步');
    
    // 获取本地数据
    const localEntries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    
    // 获取云端数据（按用户筛选，避免全表扫描）
    const db = Taro.cloud.database();
    const openid = getOpenId();
    let cloudEntries: any[] = [];
    
    if (openid) {
      const cloudRes = await db.collection(DB_COLLECTION)
        .where({
          // 使用自定义字段存储 openid，避免系统字段冲突
          openid: openid
        })
        .orderBy('updateTime', 'desc')
        .get();
      cloudEntries = cloudRes.data;
    } else {
      console.warn('[数据同步] 未获取到 openid，跳过云端数据获取');
    }
    
    let synced = 0;
    let errors = 0;
    
    // 创建映射表
    const localMap = new Map(localEntries.map(entry => [entry.id || entry._id, entry]));
    const cloudMap = new Map(cloudEntries.map(entry => [entry._id, entry]));
    
    // 同步策略：双向同步
    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
    const mergedEntries: any[] = [];
    
    for (const id of allIds) {
      const localEntry = localMap.get(id);
      const cloudEntry = cloudMap.get(id);
      
      try {
        if (localEntry && cloudEntry) {
          // 冲突解决
          const resolvedEntry = resolveConflict(localEntry, cloudEntry);
          mergedEntries.push(resolvedEntry);
          
          // 如果数据不一致，更新到云端
          if (JSON.stringify(localEntry) !== JSON.stringify(cloudEntry)) {
            await saveEntry(resolvedEntry);
            synced++;
          }
        } else if (localEntry && !cloudEntry) {
          // 本地有，云端没有 -> 上传到云端
          await saveEntry(localEntry);
          mergedEntries.push(localEntry);
          synced++;
        } else if (!localEntry && cloudEntry) {
          // 云端有，本地没有 -> 下载到本地
          mergedEntries.push(cloudEntry);
          synced++;
        }
      } catch (error) {
        console.error(`[数据同步] 同步记录 ${id} 失败:`, error);
        errors++;
        
        // 失败时保留现有数据
        if (localEntry) mergedEntries.push(localEntry);
        else if (cloudEntry) mergedEntries.push(cloudEntry);
      }
    }
    
    // 更新本地存储
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, mergedEntries.sort((a, b) => 
      (b.updateTime || b.createTime) - (a.updateTime || a.createTime)
    ));
    
    console.log(`[数据同步] 同步完成: 成功 ${synced} 条，失败 ${errors} 条`);
    
    return { success: errors === 0, synced, errors };
  } catch (error) {
    console.error('[数据同步] 同步过程失败:', error);
    return { success: false, synced: 0, errors: 1 };
  }
};

// 增量同步（仅同步最近更改的数据）
export const incrementalSync = async (since: number = Date.now() - 24 * 60 * 60 * 1000): Promise<{ success: boolean; updated: number }> => {
  try {
    console.log('[增量同步] 开始同步最近更改的数据');
    
    const db = Taro.cloud.database();
    const localEntries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    
    // 获取云端最近更新的数据
    const cloudRes = await db.collection(DB_COLLECTION)
      .where({
        updateTime: db.command.gte(since)
      })
      .orderBy('updateTime', 'desc')
      .get();
    
    const updatedEntries = cloudRes.data;
    let updated = 0;
    
    // 合并更新
    const localMap = new Map(localEntries.map(entry => [entry.id || entry._id, entry]));
    
    for (const cloudEntry of updatedEntries) {
      const localEntry = localMap.get(cloudEntry._id);
      
      if (!localEntry || (cloudEntry.updateTime > (localEntry.updateTime || 0))) {
        // 更新本地数据
        const index = localEntries.findIndex(e => (e.id || e._id) === cloudEntry._id);
        if (index >= 0) {
          localEntries[index] = { ...localEntries[index], ...cloudEntry };
        } else {
          localEntries.unshift(cloudEntry);
        }
        updated++;
      }
    }
    
    // 保存更新后的数据
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, localEntries);
    
    console.log(`[增量同步] 完成: 更新了 ${updated} 条记录`);
    return { success: true, updated };
  } catch (error) {
    console.error('[增量同步] 失败:', error);
    return { success: false, updated: 0 };
  }
};

// 自动同步触发器
export const autoSync = async () => {
  try {
    // 检查网络状态
    const networkInfo = await Taro.getNetworkType();
    if (networkInfo.networkType === 'none') {
      console.log('[自动同步] 网络不可用，跳过同步');
      return { success: true, skipped: true };
    }
    
    // 检查上次同步时间
    const lastSync = Taro.getStorageSync('LAST_SYNC_TIME') || 0;
    const now = Date.now();
    
    // 如果距离上次同步超过5分钟，执行增量同步
    if (now - lastSync > 5 * 60 * 1000) {
      const result = await incrementalSync(lastSync);
      if (result.success) {
        Taro.setStorageSync('LAST_SYNC_TIME', now);
      }
      return result;
    }
    
    return { success: true, skipped: true };
  } catch (error) {
    console.error('[自动同步] 失败:', error);
    return { success: false, error: error.message };
  }
};

// 改进登录函数
export const login = async () => {
  // 先检查云开发状态
  const status = await checkCloudStatus();
  if (!status.available) {
    Taro.showModal({
      title: '云开发不可用',
      content: status.error || '请检查网络连接',
      showCancel: false,
      confirmText: '确定'
    });
    throw new Error('云开发不可用');
  }
  
  try {
    console.log('[登录] 开始云登录');
    const res = await Taro.cloud.callFunction({
      name: 'login',
      data: {}
    });
    
    const openid = res.result.openid;
    setOpenId(openid);
    console.log('[登录] 登录成功，openid:', openid);
    
    Taro.showToast({ 
      title: '登录成功', 
      icon: 'success',
      duration: 1500
    });
    
    return openid;
  } catch (error: any) {
    console.error('[登录] 登录失败:', error);
    Taro.showModal({
      title: '登录失败',
      content: error.message || '请检查网络连接',
      showCancel: false,
      confirmText: '确定'
    });
    throw error;
  }
};

