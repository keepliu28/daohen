import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from './constants';
import { getUsersCollection, getDb } from './storage-db';
import { getOpenId } from './storage-login';

// ---------------------------------------------------------------------------
// 保存用户资料（本地 + 云端）
// ---------------------------------------------------------------------------

export const saveUserProfile = async (profile: any): Promise<boolean> => {
  try {
    Taro.setStorageSync(STORAGE_KEYS.USER_PROFILE, profile);

    const openid = getOpenId();
    if (!openid) {
      console.error('[saveUserProfile] 未找到 openid');
      return false;
    }

    const usersCollection = getUsersCollection();

    try {
      const existingUser = await usersCollection.where({ _openid: openid }).limit(1).get();

      if (existingUser.data.length > 0) {
        await usersCollection.doc(existingUser.data[0]._id).update({
          data: { ...profile, updateTime: getDb().serverDate() },
        });
        console.log('用户信息已更新到云端');
      } else {
        const addResult = await usersCollection.add({
          data: { ...profile, openid, createTime: getDb().serverDate(), updateTime: getDb().serverDate() },
        });
        console.log('用户信息已新增到云端，_id:', addResult._id);
      }
      return true;
    } catch (dbError: any) {
      console.error('[saveUserProfile] 数据库操作失败:', dbError);
      if (dbError.errCode === -502003) {
        Taro.showModal({
          title: '权限错误',
          content: '数据库权限不足，请联系管理员',
          showCancel: false,
        });
      }
      throw dbError;
    }
  } catch (error) {
    console.error('[saveUserProfile] 保存失败:', error);
    Taro.setStorageSync(STORAGE_KEYS.USER_PROFILE, profile);
    return false;
  }
};

// ---------------------------------------------------------------------------
// 云端用户资料
// ---------------------------------------------------------------------------

export const fetchUserProfileFromCloud = async () => {
  try {
    const openid = getOpenId();
    if (!openid) return null;
    const res = await getUsersCollection().where({ openid }).limit(1).get();
    return res.data.length > 0 ? res.data[0] : null;
  } catch (e) {
    console.error('获取云端用户资料失败', e);
    return null;
  }
};

export const saveUserProfileToCloud = async (profile: any) => {
  try {
    const openid = getOpenId();
    if (!openid) return false;
    const res = await getUsersCollection().where({ openid }).limit(1).get();

    if (res.data.length > 0) {
      await getUsersCollection().doc(res.data[0]._id).update({
        data: { ...profile, updateTime: getDb().serverDate() },
      });
    } else {
      await getUsersCollection().add({
        data: { ...profile, createTime: getDb().serverDate(), updateTime: getDb().serverDate() },
      });
    }
    return true;
  } catch (e) {
    console.error('保存云端用户资料失败', e);
    return false;
  }
};

// ---------------------------------------------------------------------------
// 更新用户日记计数
// ---------------------------------------------------------------------------

export const updateUserEntryCount = async (openid: string, delta: number) => {
  try {
    const userRes = await getUsersCollection().where({ openid }).limit(1).get();

    if (userRes.data.length > 0) {
      const userId = userRes.data[0]._id;
      const currentCount = userRes.data[0].entryCount || 0;
      await getUsersCollection().doc(userId).update({
        data: {
          entryCount: currentCount + delta,
          updateTime: getDb().serverDate(),
        },
      });
      console.log(`[updateUserEntryCount] 计数: ${currentCount} → ${currentCount + delta}`);
    } else {
      await getUsersCollection().add({
        data: {
          openid,
          entryCount: delta > 0 ? delta : 0,
          createTime: getDb().serverDate(),
          updateTime: getDb().serverDate(),
        },
      });
    }
  } catch (error) {
    console.error('[updateUserEntryCount] 更新计数失败:', error);
  }
};

// ---------------------------------------------------------------------------
// 头像上传
// ---------------------------------------------------------------------------

export const uploadAvatar = async (tempFilePath: string) => {
  try {
    const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    const res = await Taro.cloud.uploadFile({ cloudPath, filePath: tempFilePath });
    return res.fileID;
  } catch (e) {
    console.error('头像上传失败', e);
    return null;
  }
};
