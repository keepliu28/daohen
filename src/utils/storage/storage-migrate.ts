import Taro from '@tarojs/taro';
import { STORAGE_KEYS, DB_COLLECTION } from './constants';
import { getEntriesCollection } from './storage-db';

/**
 * 将本地旧数据迁移到云端
 * 在设置页提供按钮手动触发，或应用启动时自动检测
 */
export const migrateLocalToCloud = async () => {
  const localEntries = Taro.getStorageSync(STORAGE_KEYS.ENTRIES) || [];
  if (localEntries.length === 0) {
    console.log('无本地数据需要迁移');
    return { success: true, count: 0 };
  }

  const collection = getEntriesCollection();
  let successCount = 0;

  Taro.showLoading({ title: '数据同步中...' });

  for (const entry of localEntries) {
    try {
      const checkRes = await collection.where({ id: entry.id }).get();
      if (checkRes.data.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _id, _openid, ...addData } = entry;
        await collection.add({ data: addData });
        successCount++;
      }
    } catch (error) {
      console.error(`迁移记录 ${entry.id} 失败:`, error);
    }
  }

  Taro.hideLoading();
  Taro.showToast({ title: `成功同步 ${successCount} 条`, icon: 'success' });

  return { success: true, count: successCount };
};
