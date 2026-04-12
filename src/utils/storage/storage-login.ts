import Taro from '@tarojs/taro';
import { STORAGE_KEYS } from './constants';

// ---------------------------------------------------------------------------
// OpenID
// ---------------------------------------------------------------------------

export const getOpenId = () => Taro.getStorageSync(STORAGE_KEYS.OPENID);

export const setOpenId = (openid: string) => {
  Taro.setStorageSync(STORAGE_KEYS.OPENID, openid);
  Taro.setStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP, Date.now());
};

// ---------------------------------------------------------------------------
// 本地用户资料（无云端依赖，可直接放这里避免循环）
// ---------------------------------------------------------------------------

export const getUserProfile = () => Taro.getStorageSync(STORAGE_KEYS.USER_PROFILE);

// ---------------------------------------------------------------------------
// 登录状态检查
// ---------------------------------------------------------------------------

export const checkLoginStatus = async (): Promise<boolean> => {
  const openid = getOpenId();
  const loginTimestamp = Taro.getStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP);

  if (!openid) return false;

  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - loginTimestamp > sevenDays) {
    clearLoginData();
    return false;
  }

  try {
    await Taro.cloud.callFunction({ name: 'checkSession', timeout: 5000 });
    return true;
  } catch {
    clearLoginData();
    return false;
  }
};

export const clearLoginData = () => {
  Taro.removeStorageSync(STORAGE_KEYS.OPENID);
  Taro.removeStorageSync(STORAGE_KEYS.USER_PROFILE);
  Taro.removeStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP);
};

export const getLoginInfo = () => ({
  openid: getOpenId(),
  userProfile: getUserProfile(),
  loginTimestamp: Taro.getStorageSync(STORAGE_KEYS.LOGIN_TIMESTAMP),
  isLoggedIn: !!getOpenId(),
});
