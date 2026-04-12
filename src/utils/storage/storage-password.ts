import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from './constants';

// ---------------------------------------------------------------------------
// 密码锁
// ---------------------------------------------------------------------------

const getKey = (entryId: string) => `${STORAGE_KEYS.PASSWORD_LOCK_PREFIX}${entryId}`;

export const setEntryPassword = (entryId: string, password: string): boolean => {
  try {
    Taro.setStorageSync(getKey(entryId), password);
    return true;
  } catch (error) {
    console.error('[setEntryPassword] 失败:', error);
    return false;
  }
};

export const verifyEntryPassword = (entryId: string, password: string): boolean => {
  try {
    return Taro.getStorageSync(getKey(entryId)) === password;
  } catch (error) {
    console.error('[verifyEntryPassword] 失败:', error);
    return false;
  }
};

export const hasPasswordLock = (entryId: string): boolean => {
  try {
    return !!Taro.getStorageSync(getKey(entryId));
  } catch (error) {
    console.error('[hasPasswordLock] 失败:', error);
    return false;
  }
};

export const removeEntryPassword = (entryId: string): boolean => {
  try {
    Taro.removeStorageSync(getKey(entryId));
    return true;
  } catch (error) {
    console.error('[removeEntryPassword] 失败:', error);
    return false;
  }
};
