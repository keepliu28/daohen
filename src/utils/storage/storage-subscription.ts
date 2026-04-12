import Taro from '@tarojs/taro';
import { SUBSCRIPTION_CONFIG } from './constants';
import { getUsersCollection, getDb } from './storage-db';
import { getOpenId } from './storage-login';

// ---------------------------------------------------------------------------
// 订阅状态
// ---------------------------------------------------------------------------

export const getUserSubscription = async (): Promise<{
  isPro: boolean;
  proExpiry?: number;
  currentPeriodStart: number;
  entriesThisMonth: number;
}> => {
  const openid = getOpenId();
  if (!openid) throw new Error('用户未登录');

  try {
    const userRes = await getUsersCollection().where({ openid }).limit(1).get();

    if (userRes.data.length === 0) {
      return { isPro: false, currentPeriodStart: Date.now(), entriesThisMonth: 0 };
    }

    const userData = userRes.data[0];
    const isPro = userData.isPro || false;
    const proExpiry = userData.proExpiry || 0;
    const effectiveIsPro = isPro && proExpiry > Date.now();

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const entriesRes = await getDb().collection('entries').where({
      openid,
      createTime: getDb().command.gte(startOfMonth.getTime()),
    }).count();

    return {
      isPro: effectiveIsPro,
      proExpiry: effectiveIsPro ? proExpiry : undefined,
      currentPeriodStart: startOfMonth.getTime(),
      entriesThisMonth: entriesRes.count,
    };
  } catch (error) {
    console.error('[getUserSubscription] 失败:', error);
    return { isPro: false, currentPeriodStart: Date.now(), entriesThisMonth: 0 };
  }
};

// ---------------------------------------------------------------------------
// 配额检查
// ---------------------------------------------------------------------------

export const checkQuota = async (): Promise<{
  canProceed: boolean;
  quotaType: 'entries' | null;
  current: number;
  limit: number;
  isPro: boolean;
}> => {
  const subscription = await getUserSubscription();
  const quota = subscription.isPro ? SUBSCRIPTION_CONFIG.PRO : SUBSCRIPTION_CONFIG.FREE;

  if (subscription.entriesThisMonth >= quota.maxEntriesPerMonth) {
    return {
      canProceed: false,
      quotaType: 'entries',
      current: subscription.entriesThisMonth,
      limit: quota.maxEntriesPerMonth,
      isPro: subscription.isPro,
    };
  }

  return { canProceed: true, quotaType: null, current: 0, limit: 0, isPro: subscription.isPro };
};

export const showQuotaUpgradeModal = (quotaType: 'entries', current: number, limit: number) => {
  Taro.showModal({
    title: '本月额度提醒',
    content: `您本月已完成${current}次深潜，免费额度（${limit}次）已用完。升级 Pro 解锁无限记录。`,
    confirmText: '了解 Pro',
    cancelText: '稍后再说',
    success: (res) => {
      if (res.confirm) Taro.navigateTo({ url: '/pages/pro/index' });
    },
  });
};

// ---------------------------------------------------------------------------
// 升级 Pro
// ---------------------------------------------------------------------------

export const upgradeToPro = async (durationMonths = 1): Promise<boolean> => {
  const openid = getOpenId();
  if (!openid) throw new Error('用户未登录');

  try {
    const expiryTime = Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000;
    const userRes = await getUsersCollection().where({ openid }).limit(1).get();

    if (userRes.data.length === 0) {
      await getUsersCollection().add({
        data: {
          openid,
          isPro: true,
          proExpiry: expiryTime,
          createTime: getDb().serverDate(),
          updateTime: getDb().serverDate(),
        },
      });
    } else {
      await getUsersCollection().doc(userRes.data[0]._id).update({
        data: { isPro: true, proExpiry: expiryTime, updateTime: getDb().serverDate() },
      });
    }

    console.log(`[upgradeToPro] 用户 ${openid} 已升级 Pro`);
    return true;
  } catch (error) {
    console.error('[upgradeToPro] 升级失败:', error);
    return false;
  }
};
