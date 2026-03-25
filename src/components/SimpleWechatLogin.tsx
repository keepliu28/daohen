import React, { useState } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { setOpenId, saveUserProfile } from '../utils/storage';
import './SimpleWechatLogin.scss';

interface SimpleWechatLoginProps {
  visible: boolean;
  onSuccess: (userInfo: any) => void;
  onClose: () => void;
}

const SimpleWechatLogin: React.FC<SimpleWechatLoginProps> = ({ visible, onSuccess, onClose }) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!visible) return null;

  // 微信一键登录
  const handleWechatLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      Taro.showLoading({ title: '登录中...' });

      // 1. 获取用户信息（一键授权）
      const { userInfo } = await Taro.getUserProfile({
        desc: '用于完善用户资料',
        lang: 'zh_CN'
      });

      // 2. 获取登录凭证
      const { code } = await Taro.login();

      // 3. 调用云函数获取 openid
      const cloudRes = await Taro.cloud.callFunction({
        name: 'login',
        data: {
          code: code,
          userInfo: userInfo
        }
      });

      const openid = cloudRes.result.openid;

      // 4. 保存用户信息到云端
      const userProfile = {
        avatarUrl: userInfo.avatarUrl,
        nickName: userInfo.nickName,
        gender: userInfo.gender,
        country: userInfo.country,
        province: userInfo.province,
        city: userInfo.city,
        openid: openid,
        createTime: Date.now(),
        updateTime: Date.now()
      };

      await saveUserProfile(userProfile);
      setOpenId(openid);

      Taro.hideLoading();
      Taro.showToast({ 
        title: '登录成功', 
        icon: 'success',
        duration: 1500
      });

      // 5. 登录成功回调
      setTimeout(() => {
        onSuccess({
          ...userInfo,
          openid: openid
        });
      }, 1500);

    } catch (error: any) {
      Taro.hideLoading();
      console.error('[登录失败]:', error);
      
      let errorMsg = '登录失败，请重试';
      if (error.errMsg?.includes('auth deny')) {
        errorMsg = '您已取消授权';
      } else if (error.errMsg?.includes('fail')) {
        errorMsg = '网络异常，请检查网络';
      }

      Taro.showModal({
        title: '登录失败',
        content: errorMsg,
        showCancel: false,
        confirmText: '我知道了'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className='simple-login-mask' onClick={onClose}>
      <View className='simple-login-content' onClick={e => e.stopPropagation()}>
        {/* 顶部装饰 */}
        <View className='simple-login-header'>
          <View className='header-decoration'>
            <View className='decoration-dot'></View>
            <View className='decoration-dot'></View>
            <View className='decoration-dot'></View>
          </View>
        </View>

        {/* Logo 和标题 */}
        <View className='simple-login-body'>
          <View className='app-logo'>
            <View className='logo-icon'>道</View>
          </View>
          
          <Text className='app-title'>道痕</Text>
          <Text className='app-subtitle'>记录成长的每一步</Text>

          {/* 登录按钮 */}
          <View className='login-actions'>
            <Button 
              className='wechat-login-btn'
              onClick={handleWechatLogin}
              disabled={isLoading}
              loading={isLoading}
            >
              <View className='btn-content'>
                <Text className='wechat-icon'>💚</Text>
                <Text className='btn-text'>
                  {isLoading ? '登录中...' : '微信一键登录'}
                </Text>
              </View>
            </Button>

            <Text className='login-tips'>
              登录后即表示您同意《用户协议》和《隐私政策》
            </Text>
          </View>
        </View>

        {/* 底部装饰 */}
        <View className='simple-login-footer'>
          <Text className='footer-text'>安全 · 便捷 · 高效</Text>
        </View>
      </View>
    </View>
  );
};

export default SimpleWechatLogin;
