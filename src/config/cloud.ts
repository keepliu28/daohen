import Taro from '@tarojs/taro';

// 云开发环境配置
export interface CloudConfig {
  env: string;
  traceUser: boolean;
}

// 开发环境配置
export const devConfig: CloudConfig = {
  env: process.env.TARO_ENV === 'weapp' ? 'n1-daohen-9ga3v5k246792d59' : 'cloud1-5g4q6c3v9b8a2d1e',
  traceUser: true
};

// 生产环境配置
export const prodConfig: CloudConfig = {
  env: process.env.TARO_ENV === 'weapp' ? 'n1-daohen-9ga3v5k246792d59' : 'cloud1-5g4q6c3v9b8a2d1e',
  traceUser: true
};

// 根据环境获取配置
export const getCloudConfig = (): CloudConfig => {
  if (process.env.NODE_ENV === 'development') {
    return devConfig;
  }
  return prodConfig;
};

// 云开发状态检查
export const checkCloudAvailability = async (): Promise<{ available: boolean; error?: string }> => {
  if (typeof Taro === 'undefined' || typeof Taro.cloud === 'undefined') {
    return { available: false, error: '云开发功能未启用' };
  }

  try {
    const config = getCloudConfig();
    Taro.cloud.init(config);
    
    // 测试云函数
    const testRes = await Taro.cloud.callFunction({
      name: 'login',
      data: {}
    });
    
    // 测试数据库
    const db = Taro.cloud.database();
    const dbTest = await db.collection('entries').limit(1).get();
    
    return { available: true };
  } catch (error: any) {
    return { 
      available: false, 
      error: error.message || '云开发初始化失败' 
    };
  }
};