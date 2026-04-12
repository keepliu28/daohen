import { describe, it, expect } from 'vitest';
import { STORAGE_KEYS, SUBSCRIPTION_CONFIG, DB_COLLECTION, DB_USERS_COLLECTION } from '../utils/storage/constants';
import { resolveConflict } from '../utils/storage/resolve-conflict';

describe('storage/constants', () => {
  it('should export DB_COLLECTION', () => {
    expect(DB_COLLECTION).toBe('entries');
  });

  it('should export DB_USERS_COLLECTION', () => {
    expect(DB_USERS_COLLECTION).toBe('users');
  });

  it('should export all STORAGE_KEYS', () => {
    expect(STORAGE_KEYS.OPENID).toBe('openid');
    expect(STORAGE_KEYS.USER_PROFILE).toBe('user_profile');
    expect(STORAGE_KEYS.ENTRIES).toBe('DAOHEN_ENTRIES');
    expect(STORAGE_KEYS.LOGIN_TIMESTAMP).toBe('login_timestamp');
    expect(STORAGE_KEYS.LAST_SYNC_TIME).toBe('LAST_SYNC_TIME');
    expect(STORAGE_KEYS.PASSWORD_LOCK_PREFIX).toBe('password_lock_');
  });

  it('should export SUBSCRIPTION_CONFIG with FREE and PRO tiers', () => {
    expect(SUBSCRIPTION_CONFIG.FREE.maxEntriesPerMonth).toBe(30);
    expect(SUBSCRIPTION_CONFIG.FREE.passwordLock).toBe(false);
    expect(SUBSCRIPTION_CONFIG.PRO.maxEntriesPerMonth).toBe(99999);
    expect(SUBSCRIPTION_CONFIG.PRO.passwordLock).toBe(true);
  });
});

describe('resolve-conflict', () => {
  it('should prefer local data when local is newer', () => {
    const local = { id: '1', text: 'local', updateTime: 2000, createTime: 1000 };
    const cloud = { id: '1', _id: '1', text: 'cloud', updateTime: 1000, createTime: 1000 };
    const result = resolveConflict(local, cloud);
    expect(result.text).toBe('local');
    expect(result._id).toBe('1');
  });

  it('should prefer cloud data when cloud is newer', () => {
    const local = { id: '1', text: 'local', updateTime: 1000, createTime: 1000 };
    const cloud = { id: '1', _id: '1', text: 'cloud', updateTime: 2000, createTime: 1000 };
    const result = resolveConflict(local, cloud);
    expect(result.text).toBe('cloud');
    expect(result.id).toBe('1');
  });

  it('should handle entries without updateTime', () => {
    const local = { id: '1', text: 'local', createTime: 2000 };
    const cloud = { id: '1', _id: '1', text: 'cloud', createTime: 1000 };
    const result = resolveConflict(local, cloud);
    expect(result.text).toBe('local');
  });
});
