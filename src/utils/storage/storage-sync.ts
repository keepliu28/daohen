import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from './constants';
import { getOpenId, setOpenId } from './storage-login';
import { getEntriesCollection, getDb, checkCloudStatus } from './storage-db';
import { saveEntry as localSaveEntry } from './storage-entry';
import { resolveConflict } from './resolve-conflict';

// re-export 供外部使用（如 syncEntries 内部逻辑）
export { resolveConflict } from './resolve-conflict';

// ---------------------------------------------------------------------------
// 全量双向同步
// ---------------------------------------------------------------------------

export const syncEntries = async () => {
  try {
    const localEntries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const openid = getOpenId();
    let cloudEntries: any[] = [];

    if (openid) {
      const cloudRes = await getEntriesCollection()
        .where({ openid })
        .orderBy('updateTime', 'desc')
        .get();
      cloudEntries = cloudRes.data;
    } else {
      console.warn('[数据同步] 未获取到 openid');
    }

    let synced = 0;
    let errors = 0;
    const localMap = new Map(localEntries.map(e => [e.id || e._id, e]));
    const cloudMap = new Map(cloudEntries.map(e => [e._id, e]));
    const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
    const mergedEntries: any[] = [];

    for (const id of allIds) {
      const localEntry = localMap.get(id);
      const cloudEntry = cloudMap.get(id);

      try {
        if (localEntry && cloudEntry) {
          const resolved = resolveConflict(localEntry, cloudEntry);
          mergedEntries.push(resolved);
          if (JSON.stringify(localEntry) !== JSON.stringify(cloudEntry)) {
            await localSaveEntry(resolved);
            synced++;
          }
        } else if (localEntry && !cloudEntry) {
          await localSaveEntry(localEntry);
          mergedEntries.push(localEntry);
          synced++;
        } else if (!localEntry && cloudEntry) {
          mergedEntries.push(cloudEntry);
          synced++;
        }
      } catch (err) {
        console.error(`[数据同步] 同步记录 ${id} 失败:`, err);
        errors++;
        if (localEntry) mergedEntries.push(localEntry);
        else if (cloudEntry) mergedEntries.push(cloudEntry);
      }
    }

    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, mergedEntries.sort(
      (a, b) => (b.updateTime || b.createTime) - (a.updateTime || a.createTime),
    ));

    console.log(`[数据同步] 完成: 成功 ${synced}，失败 ${errors}`);
    return { success: errors === 0, synced, errors };
  } catch (error) {
    console.error('[数据同步] 失败:', error);
    return { success: false, synced: 0, errors: 1 };
  }
};

// ---------------------------------------------------------------------------
// 增量同步
// ---------------------------------------------------------------------------

export const incrementalSync = async (since?: number) => {
  try {
    const sinceTime = since ?? Date.now() - 24 * 60 * 60 * 1000;
    const cloudRes = await getEntriesCollection()
      .where({ updateTime: getDb().command.gte(sinceTime) })
      .orderBy('updateTime', 'desc')
      .get();

    let updated = 0;
    const localEntries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const localMap = new Map(localEntries.map(e => [e.id || e._id, e]));

    for (const cloudEntry of cloudRes.data) {
      const localEntry = localMap.get(cloudEntry._id);
      if (!localEntry || (cloudEntry.updateTime > (localEntry.updateTime || 0))) {
        const index = localEntries.findIndex(e => (e.id || e._id) === cloudEntry._id);
        if (index >= 0) {
          localEntries[index] = { ...localEntries[index], ...cloudEntry };
        } else {
          localEntries.unshift(cloudEntry);
        }
        updated++;
      }
    }

    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, localEntries);
    console.log(`[增量同步] 完成: 更新了 ${updated} 条`);
    return { success: true, updated };
  } catch (error) {
    console.error('[增量同步] 失败:', error);
    return { success: false, updated: 0 };
  }
};

// ---------------------------------------------------------------------------
// 自动同步
// ---------------------------------------------------------------------------

export const autoSync = async () => {
  try {
    const networkInfo = await Taro.getNetworkType();
    if (networkInfo.networkType === 'none') {
      console.log('[自动同步] 网络不可用');
      return { success: true, skipped: true };
    }

    const lastSync = Taro.getStorageSync(STORAGE_KEYS.LAST_SYNC_TIME) || 0;
    if (Date.now() - lastSync > 5 * 60 * 1000) {
      const result = await incrementalSync(lastSync);
      if (result.success) {
        Taro.setStorageSync(STORAGE_KEYS.LAST_SYNC_TIME, Date.now());
      }
      return result;
    }

    return { success: true, skipped: true };
  } catch (error) {
    console.error('[自动同步] 失败:', error);
    return { success: false, error: (error as any).message };
  }
};

// ---------------------------------------------------------------------------
// 重试包装
// ---------------------------------------------------------------------------

export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> => {
  let lastError: any;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      console.warn(`[重试] 第 ${attempt + 1} 次失败:`, error);
      if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
};

export const login = async () => {
  const status = await checkCloudStatus();
  if (!status.available) {
    Taro.showModal({ title: '云开发不可用', content: status.error || '请检查网络连接', showCancel: false, confirmText: '确定' });
    throw new Error('云开发不可用');
  }

  try {
    const res = await Taro.cloud.callFunction({ name: 'login', data: {} });
    const openid = res.result.openid;
    setOpenId(openid);
    Taro.showToast({ title: '登录成功', icon: 'success', duration: 1500 });
    return openid;
  } catch (error: any) {
    console.error('[登录] 失败:', error);
    Taro.showModal({ title: '登录失败', content: error.message || '请检查网络连接', showCancel: false, confirmText: '确定' });
    throw error;
  }
};
