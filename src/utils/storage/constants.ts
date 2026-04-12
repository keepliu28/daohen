import Taro from '@tarojs/taro';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export const DB_COLLECTION = 'entries';
export const DB_USERS_COLLECTION = 'users';

export const STORAGE_KEYS = {
  OPENID: 'openid',
  USER_PROFILE: 'user_profile',
  ENTRIES: 'DAOHEN_ENTRIES',
  LOGIN_TIMESTAMP: 'login_timestamp',
  LAST_SYNC_TIME: 'LAST_SYNC_TIME',
  PASSWORD_LOCK_PREFIX: 'password_lock_',
} as const;

export const SUBSCRIPTION_CONFIG = {
  FREE: {
    maxEntriesPerMonth: 30,
    passwordLock: false,
    cloudBackup: false,
  },
  PRO: {
    maxEntriesPerMonth: 99999,
    passwordLock: true,
    cloudBackup: true,
  },
} as const;
