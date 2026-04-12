import Taro from '@tarojs/taro';
import { STORAGE_KEYS, DB_COLLECTION } from './constants';
import { getEntriesCollection, getDb } from './storage-db';
import { getOpenId } from './storage-login';
import { updateUserEntryCount } from './storage-user';
import { checkQuota, showQuotaUpgradeModal } from './storage-subscription';
import { saveEntry as cloudSave, getEntries as cloudGet } from './storage-cloud';

// ---------------------------------------------------------------------------
// 获取日记
// ---------------------------------------------------------------------------

export const getEntries = async (limit = 20, offset = 0) => {
  try {
    const res = await getEntriesCollection()
      .orderBy('createTime', 'desc')
      .limit(limit)
      .skip(offset)
      .get();

    return res.data.map(item => {
      if (!item.id && item._id) item.id = item._id;
      return item;
    });
  } catch (error) {
    console.error('[getEntries] 云端获取失败:', error);
    return [];
  }
};

// ---------------------------------------------------------------------------
// 保存日记
// ---------------------------------------------------------------------------

export const saveEntry = async (entry: any) => {
  const openid = getOpenId();
  if (!openid) throw new Error('用户未登录，请先登录后再保存日记');

  const collection = getEntriesCollection();

  try {
    const queryId = entry._id || entry.id;
    let isNewEntry = false;

    if (queryId) {
      const checkRes = await collection.where({ _id: queryId }).get();
      if (checkRes.data.length > 0) {
        const { _id, _openid, ...updateData } = entry;
        updateData.updateTime = new Date().getTime();
        await collection.doc(queryId).update({ data: updateData });
        console.log('[saveEntry] 日记已更新');
      } else {
        isNewEntry = true;
      }
    } else {
      isNewEntry = true;
    }

    if (isNewEntry) {
      const quotaCheck = await checkQuota();
      if (!quotaCheck.canProceed) {
        showQuotaUpgradeModal(quotaCheck.quotaType!, quotaCheck.current, quotaCheck.limit);
        throw new Error(`配额不足：${quotaCheck.quotaType} 已达上限`);
      }

      entry.createTime = entry.createTime || new Date().getTime();
      entry.updateTime = entry.updateTime || new Date().getTime();
      const addRes = await collection.add({ data: entry });
      entry._id = addRes._id;
      entry.id = addRes._id;
      await updateUserEntryCount(openid, 1);
      console.log('[saveEntry] 新增日记，用户计数 +1');
    }

    // 更新本地缓存
    const entries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const existingIndex = entries.findIndex(e => (e.id === entry.id || e._id === entry._id));
    const newEntries = existingIndex >= 0
      ? entries.map((e, i) => i === existingIndex ? entry : e)
      : [entry, ...entries];
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    return newEntries;

  } catch (error: any) {
    if (error.errCode === -502003) {
      throw new Error('数据库权限被拒绝');
    }
    if (error.message === '用户未登录，请先登录后再保存日记') throw error;

    // 降级到本地保存
    console.warn('[saveEntry] 云端保存失败，降级到本地');
    const entries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const existingIndex = entries.findIndex(e => e.id === entry.id);
    const newEntries = existingIndex >= 0
      ? entries.map((e, i) => i === existingIndex ? entry : e)
      : [entry, ...entries];
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    return { entries: newEntries, isFallback: true, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// 删除日记
// ---------------------------------------------------------------------------

export const deleteEntryById = async (id: string) => {
  try {
    const db = getDb();
    await db.collection(DB_COLLECTION).doc(id).get();
    await db.collection(DB_COLLECTION).doc(id).remove();

    const openid = getOpenId();
    if (openid) await updateUserEntryCount(openid, -1);

    const entries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    return newEntries;
  } catch (error) {
    console.error('[deleteEntryById] 云端删除失败，降级到本地删除');
    const entries: any[] = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
    const newEntries = entries.filter(e => e.id !== id && e._id !== id);
    Taro.setStorageSync(STORAGE_KEYS.ENTRIES, newEntries);
    return newEntries;
  }
};
