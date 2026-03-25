import Taro from '@tarojs/taro';

const DB_COLLECTION = 'entries';

// -----------------------------------------------------------------------------
// 1. 登录与用户管理
// -----------------------------------------------------------------------------

// 统一的存储键名常量
const STORAGE_KEYS = {
  OPENID: 'openid',
  USER_PROFILE: 'user_profile',
  ENTRIES: 'DAOHEN_ENTRIES'
};

/**
 * 获取当前用户的 OpenID
 */
export const getOpenId = () => {
  return Taro.getStorageSync(STORAGE_KEYS.OPENID);
};

/**
 * 设置当前用户的 OpenID
 */
export const setOpenId = (openid: string) => {
  Taro.setStorageSync(STORAGE_KEYS.OPENID, openid);
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
  const db = Taro.cloud.database();
  const collection = db.collection(DB_COLLECTION);
  
  try {
    // 检查是否已存在 (通过 id 或 _id)
    const queryId = entry._id || entry.id;
    
    if (queryId) {
      // 尝试在云端查找
      const checkRes = await collection.where({
        _id: queryId
      }).get();
      
      if (checkRes.data.length > 0) {
        // 更新
        const { _id, _openid, ...updateData } = entry;
        updateData.updateTime = new Date().getTime();
        
        await collection.doc(queryId).update({
          data: updateData
        });
      } else {
        // 新增
        entry.createTime = entry.createTime || new Date().getTime();
        entry.updateTime = entry.updateTime || new Date().getTime();
        const addRes = await collection.add({
          data: entry
        });
        entry._id = addRes._id;
        entry.id = addRes._id; // 保持兼容
      }
    } else {
      // 新增 (没有 id)
      entry.createTime = new Date().getTime();
      entry.updateTime = new Date().getTime();
      const addRes = await collection.add({
        data: entry
      });
      entry._id = addRes._id;
      entry.id = addRes._id;
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
    // 降级：仅保存到本地
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
    return newEntries;
  }
};

/**
 * 删除日记
 */
export const deleteEntryById = async (id) => {
  try {
    const db = Taro.cloud.database();
    await db.collection(DB_COLLECTION).doc(id).remove();
    
    // 更新本地缓存
    const entries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    
    return newEntries;
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

export const getUserProfile = async () => {
  try {
    const db = Taro.cloud.database();
    const openid = getOpenId();
    if (!openid) return null;
    
    // 使用 openid 作为查询条件，避免全表扫描
    const res = await db.collection('users').where({
      _openid: openid
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

export const saveUserProfile = async (profile) => {
  try {
    const db = Taro.cloud.database();
    const openid = getOpenId();
    if (!openid) return false;
    
    // 使用 openid 作为查询条件，避免全表扫描
    const res = await db.collection('users').where({
      _openid: openid
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
          _openid: openid,
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
// 5. 数据同步策略优化
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
        .where({ _openid: openid })
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

