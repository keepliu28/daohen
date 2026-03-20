import Taro from '@tarojs/taro';

const STORAGE_KEY = 'DAOHEN_ENTRIES';
const DB_COLLECTION = 'entries';

// -----------------------------------------------------------------------------
// 1. 登录与用户管理
// -----------------------------------------------------------------------------

/**
 * 调用云函数获取用户 OpenID
 */
export const login = async () => {
  try {
    const res = await Taro.cloud.callFunction({
      name: 'login',
      data: {}
    });
    const openid = res.result.openid;
    Taro.setStorageSync('USER_OPENID', openid);
    return openid;
  } catch (error) {
    console.error('Login failed:', error);
    return null;
  }
};

/**
 * 获取当前用户的 OpenID
 */
export const getOpenId = () => {
  return Taro.getStorageSync('USER_OPENID');
};

// -----------------------------------------------------------------------------
// 2. 数据库操作 (云端优先，本地作为缓存/降级)
// -----------------------------------------------------------------------------

/**
 * 获取所有日记 (从云端获取)
 */
export const getEntries = async () => {
  try {
    const db = Taro.cloud.database();
    const res = await db.collection(DB_COLLECTION).orderBy('createTime', 'desc').get();
    
    // 将云端数据同步到本地缓存
    const entries = res.data.map(item => {
      // 兼容旧的 id 字段
      if (!item.id && item._id) {
        item.id = item._id;
      }
      return item;
    });
    Taro.setStorageSync(STORAGE_KEY, entries);
    return entries;
  } catch (error) {
    console.error('Failed to get entries from cloud, falling back to local:', error);
    return Taro.getStorageSync(STORAGE_KEY) || [];
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
    const entries = Taro.getStorageSync(STORAGE_KEY) || [];
    const existingIndex = entries.findIndex(e => (e.id === entry.id || e._id === entry._id));
    
    let newEntries;
    if (existingIndex >= 0) {
      newEntries = [...entries];
      newEntries[existingIndex] = entry;
    } else {
      newEntries = [entry, ...entries];
    }
    Taro.setStorageSync(STORAGE_KEY, newEntries);
    
    return newEntries;
  } catch (error) {
    console.error('Failed to save entry to cloud:', error);
    // 降级：仅保存到本地
    const entries = Taro.getStorageSync(STORAGE_KEY) || [];
    const existingIndex = entries.findIndex(e => e.id === entry.id);
    let newEntries;
    if (existingIndex >= 0) {
      newEntries = [...entries];
      newEntries[existingIndex] = entry;
    } else {
      newEntries = [entry, ...entries];
    }
    Taro.setStorageSync(STORAGE_KEY, newEntries);
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
    const entries = Taro.getStorageSync(STORAGE_KEY) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEY, newEntries);
    
    return newEntries;
  } catch (error) {
    console.error('Failed to delete entry from cloud:', error);
    // 降级：仅从本地删除
    const entries = Taro.getStorageSync(STORAGE_KEY) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEY, newEntries);
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
  const localEntries = Taro.getStorageSync(STORAGE_KEY) || [];
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
