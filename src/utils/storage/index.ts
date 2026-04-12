// ---------------------------------------------------------------------------
// storage/index.ts — 统一导出入口
// 旧 storage.ts 已拆分至此模块，API 完全兼容，原导入路径不变
// ---------------------------------------------------------------------------

// 常量
export { DB_COLLECTION, DB_USERS_COLLECTION, STORAGE_KEYS, SUBSCRIPTION_CONFIG } from './constants';

// 登录 / OpenID
export { getOpenId, setOpenId, checkLoginStatus, clearLoginData, getLoginInfo, getUserProfile } from './storage-login';
export { login } from './storage-sync';
export { saveUserProfile } from './storage-user';

// 用户
export { saveUserProfile, fetchUserProfileFromCloud, saveUserProfileToCloud, uploadAvatar, updateUserEntryCount } from './storage-user';

// 日记
export { getEntries, saveEntry, deleteEntryById } from './storage-entry';
export { getEntriesWithRetry, saveEntryWithRetry } from './storage-sync';

// 同步
export { syncEntries, incrementalSync, autoSync, retryOperation, resolveConflict } from './storage-sync';
export { migrateLocalToCloud } from './storage-migrate';

// 订阅 / 配额
export { getUserSubscription, checkQuota, showQuotaUpgradeModal, upgradeToPro } from './storage-subscription';

// 密码锁
export { setEntryPassword, verifyEntryPassword, hasPasswordLock, removeEntryPassword } from './storage-password';

// 账号注销
export { deleteUserAccount } from './storage-account';

// 云状态
export { checkCloudStatus } from './storage-db';
