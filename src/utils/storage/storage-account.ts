import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from './constants';
import { getUsersCollection, getDb } from './storage-db';
import { getOpenId, clearLoginData } from './storage-login';

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
  if (!openid) return { success: false, message: '用户未登录' };

  try {
    const db = getDb();

    // 1. 删除云端所有日记
    let deletedEntriesCount = 0;
    try {
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const entriesRes = await db.collection('entries')
          .where({ _openid: openid })
          .limit(batchSize)
          .get();

        if (entriesRes.data.length === 0) { hasMore = false; break; }

        const deletePromises = entriesRes.data.map(entry =>
          db.collection('entries').doc(entry._id).remove(),
        );
        await Promise.all(deletePromises);
        deletedEntriesCount += entriesRes.data.length;
        console.log(`[deleteUserAccount] 已删除 ${deletedEntriesCount} 条日记`);
      }
      console.log(`[deleteUserAccount] 云端日记删除完成，共 ${deletedEntriesCount} 条`);
    } catch (entriesError) {
      console.error('[deleteUserAccount] 删除日记失败:', entriesError);
    }

    // 2. 删除云端用户记录
    let deletedUser = false;
    try {
      const userRes = await db.collection('users').where({ _openid: openid }).get();
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

    const keys = Taro.getStorageInfoSync().keys;
    keys.forEach(key => {
      if (key.startsWith(STORAGE_KEYS.PASSWORD_LOCK_PREFIX)) {
        Taro.removeStorageSync(key);
      }
    });

    return {
      success: true,
      message: '账号已注销，所有数据已删除',
      deletedEntries: deletedEntriesCount,
      deletedUser,
    };
  } catch (error: any) {
    console.error('[deleteUserAccount] 注销失败:', error);
    return { success: false, message: error.message || '注销失败，请稍后重试' };
  }
};
