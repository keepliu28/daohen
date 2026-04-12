import Taro from '@tarojs/taro';
import { DB_COLLECTION, DB_USERS_COLLECTION } from './constants';

// ---------------------------------------------------------------------------
// 数据库连接
// ---------------------------------------------------------------------------

export const getDb = () => Taro.cloud.database();

export const getEntriesCollection = () => getDb().collection(DB_COLLECTION);

export const getUsersCollection = () => getDb().collection(DB_USERS_COLLECTION);

// ---------------------------------------------------------------------------
// 云开发状态检查
// ---------------------------------------------------------------------------

export const checkCloudStatus = async (): Promise<{
  available: boolean;
  error?: string;
  details?: any;
}> => {
  if (!Taro.cloud) {
    return { available: false, error: '云开发功能未启用', details: { type: 'cloud_not_available' } };
  }

  try {
    await Taro.cloud.callFunction({ name: 'login', data: {} });
    await getEntriesCollection().limit(1).get();
    return { available: true, details: { cloudFunction: true, database: true } };
  } catch (error: any) {
    let errorMessage = '云开发服务异常';
    let errorType = 'unknown';

    if (error.errCode) {
      switch (error.errCode) {
        case -404011:
          errorMessage = '云函数不存在，请检查云函数部署状态';
          errorType = 'function_not_found';
          break;
        case -501000:
          errorMessage = '数据库连接失败';
          errorType = 'database_connection_failed';
          break;
        case -401003:
          errorMessage = '环境配置错误，请检查环境ID';
          errorType = 'env_config_error';
          break;
        default:
          errorMessage = `云开发服务异常 (错误码: ${error.errCode})`;
          errorType = 'cloud_service_error';
      }
    } else {
      errorMessage = error.message || errorMessage;
    }

    return { available: false, error: errorMessage, details: { type: errorType, errCode: error.errCode } };
  }
};
