import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { getCloudConfig, checkCloudAvailability } from './config/cloud'
import './app.css'

function App({ children }: PropsWithChildren) {
  useLaunch(async () => {
    console.log('[系统] App 启动');
    
    if (process.env.TARO_ENV === 'weapp') {
      console.log('[云开发] 开始初始化');
      
      try {
        // 使用配置管理初始化云开发
        const config = getCloudConfig();
        Taro.cloud.init(config);
        console.log('[云开发] 初始化成功，环境:', config.env);
        
        // 等待云开发完全就绪
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('[云开发] 云开发 SDK 已就绪');
        
        Taro.showToast({ 
          title: '云开发连接成功', 
          icon: 'success',
          duration: 1500
        });
      } catch (error: any) {
        console.error('[云开发] 初始化失败:', error);
        Taro.showModal({
          title: '云开发初始化失败',
          content: error.message || '请检查网络连接',
          showCancel: false,
          confirmText: '确定'
        });
      }
    }
  });

  return children;
}

export default App;