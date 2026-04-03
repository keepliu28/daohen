import React, { useState } from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { setOpenId, saveUserProfile } from '../utils/storage';
import './OfficialWechatLogin.scss';

interface OfficialWechatLoginProps {
  visible: boolean;
  onSuccess: (userInfo: any) => void;
  onClose: () => void;
}

const OfficialWechatLogin: React.FC<OfficialWechatLoginProps> = ({ visible, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!visible) return null;

  const handleLogin = async (e: any) => {
    if (isLoading) return;
    
    setIsLoading(true);
    Taro.showLoading({ 
      title: '登录中...',
      mask: true
    });

    try {
      const { userInfo } = e.detail;
      
      if (!userInfo) {
        Taro.hideLoading();
        Taro.showToast({ 
          title: '您已取消授权', 
          icon: 'none',
          duration: 2000
        });
        setIsLoading(false);
        return;
      }

      const loginUserInfo = {
        ...userInfo,
        avatarUrl: userInfo.avatarUrl || '',
        nickName: userInfo.nickName || ''
      };

      const { code } = await Taro.login();

      const cloudRes = await Taro.cloud.callFunction({
        name: 'login',
        data: {
          code: code,
          userInfo: loginUserInfo
        },
        timeout: 10000
      });

      const openid = cloudRes.result.openid;
      setOpenId(openid);

      let finalAvatarUrl = loginUserInfo.avatarUrl;
      if (loginUserInfo.avatarUrl.startsWith('http://tmp/') || loginUserInfo.avatarUrl.startsWith('wxfile://')) {
        const uploadRes = await Taro.cloud.uploadFile({
          cloudPath: `avatars/${openid}_${Date.now()}.png`,
          filePath: loginUserInfo.avatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const userProfile = {
        avatarUrl: finalAvatarUrl,
        nickName: loginUserInfo.nickName,
        gender: loginUserInfo.gender,
        country: loginUserInfo.country,
        province: loginUserInfo.province,
        city: loginUserInfo.city,
        openid: openid,
        createTime: Date.now(),
        updateTime: Date.now()
      };

      try {
        await saveUserProfile(userProfile);
      } catch (saveError) {
        console.error('[Login] 保存用户信息失败:', saveError);
      }

      Taro.hideLoading();
      Taro.showToast({ 
        title: '登录成功', 
        icon: 'success',
        duration: 1500
      });

      setTimeout(() => {
        onSuccess({
          ...loginUserInfo,
          openid: openid
        });
      }, 1500);

    } catch (error: any) {
      Taro.hideLoading();
      Taro.showToast({ 
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
      setIsLoading(false);
    }
  };

  const handleLater = () => {
    // 稍后设置 - 直接关闭登录界面
    onSuccess(null);
  };

  return (
    <View className='login-container'>
      {/* 内容区域 */}
      <View className='login-content'>
        {/* Logo 区域 - 放大居中 */}
        <View className='logo-section'>
          <View className='logo-dh'>
            <Text className='dh-text'>D</Text>
            <Text className='dh-text'>H</Text>
          </View>
          <Text className='logo-daohen'>Daohen</Text>
          <Text className='slogan'>深潜内心，安全记录</Text>
        </View>

        {/* 登录按钮区域 */}
        <View className='action-section'>
          <Button 
            className='wechat-login-btn'
            openType='getUserInfo'
            onGetUserInfo={handleLogin}
            disabled={isLoading}
          >
            <View className='btn-content'>
              <Text className='wechat-icon'>💚</Text>
              <Text>{isLoading ? '登录中...' : '微信登录'}</Text>
            </View>
          </Button>

          <View className='agreement-text'>
            <Text>登录即代表您同意我们的</Text>
            <Text className='link' onClick={() => Taro.navigateTo({ url: '/pages/privacy/index' })}>隐私政策</Text>
            <Text>和</Text>
            <Text className='link' onClick={() => Taro.navigateTo({ url: '/pages/terms/index' })}>服务协议</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default OfficialWechatLogin;
