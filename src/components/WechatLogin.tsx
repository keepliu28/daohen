import React from 'react';
import { View, Text, Button, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { login, setOpenId, getUserProfile, saveUserProfile } from '../utils/storage';
import LoginModal from './LoginModal';
import './WechatLogin.scss';

interface WechatLoginProps {
  visible: boolean;
  onSuccess: (userInfo: any) => void;
  onClose: () => void;
}

const WechatLogin: React.FC<WechatLoginProps> = ({ visible, onSuccess, onClose }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [step, setStep] = React.useState<'login' | 'profile'>('login');
  const [userInfo, setUserInfo] = React.useState<any>(null);

  // 微信登录
  const handleWechatLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      // 检查微信登录是否可用
      const res = await Taro.checkSession();
      console.log('[微信登录] 会话状态:', res);
      
      // 获取用户信息
      const userRes = await Taro.getUserProfile({
        desc: '用于完善会员资料',
        lang: 'zh_CN'
      });
      
      console.log('[微信登录] 用户信息:', userRes);
      
      // 获取微信登录凭证
      const loginRes = await Taro.login();
      console.log('[微信登录] 登录凭证:', loginRes);
      
      // 调用云函数进行登录
      const cloudRes = await Taro.cloud.callFunction({
        name: 'login',
        data: {
          code: loginRes.code,
          userInfo: userRes.userInfo
        }
      });
      
      console.log('[微信登录] 云函数返回:', cloudRes);
      
      // 保存用户信息
      const userData = {
        ...userRes.userInfo,
        openid: cloudRes.result.openid,
        unionid: cloudRes.result.unionid,
        loginTime: new Date().getTime()
      };
      
      setUserInfo(userData);
      setOpenId(cloudRes.result.openid);
      
      // 检查是否需要完善资料
      const existingProfile = await getUserProfile();
      if (existingProfile && existingProfile.nickName && existingProfile.avatarUrl) {
        // 已有完整资料，直接登录成功
        onSuccess(userData);
        Taro.showToast({ title: '登录成功', icon: 'success' });
      } else {
        // 需要完善资料
        setStep('profile');
      }
      
    } catch (error: any) {
      console.error('[微信登录] 登录失败:', error);
      
      let errorMessage = '登录失败，请重试';
      if (error.errMsg?.includes('auth deny')) {
        errorMessage = '您拒绝了授权，无法获取用户信息';
      } else if (error.errMsg?.includes('network')) {
        errorMessage = '网络异常，请检查网络连接';
      }
      
      Taro.showModal({
        title: '登录失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '确定'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 快速登录（使用云函数自动获取openid）
  const handleQuickLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    
    try {
      const openid = await login();
      
      // 检查用户资料
      const profile = await getUserProfile();
      
      if (profile) {
        onSuccess({ ...profile, openid });
        Taro.showToast({ title: '登录成功', icon: 'success' });
      } else {
        // 需要完善资料
        setStep('profile');
      }
      
    } catch (error: any) {
      console.error('[快速登录] 登录失败:', error);
      Taro.showModal({
        title: '登录失败',
        content: error.message || '请检查网络连接',
        showCancel: false,
        confirmText: '确定'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 保存用户资料
  const handleSaveProfile = async (profile: any) => {
    try {
      const success = await saveUserProfile(profile);
      if (success) {
        onSuccess({ ...userInfo, ...profile });
        Taro.showToast({ title: '资料保存成功', icon: 'success' });
      }
    } catch (error) {
      console.error('[保存资料] 失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  };

  if (!visible) return null;

  return (
    <View className="wechat-login-mask" onClick={onClose}>
      <View className="wechat-login-content" onClick={e => e.stopPropagation()}>
        <View className="wechat-login-header">
          <Text className="wechat-login-title">
            {step === 'login' ? '欢迎使用道痕' : '完善资料'}
          </Text>
          <Text className="wechat-login-close" onClick={onClose}>✕</Text>
        </View>
        
        <View className="wechat-login-body">
          {step === 'login' ? (
            <>
              <View className="login-illustration">
                <Text className="illustration-icon">📝</Text>
                <Text className="illustration-text">记录每一刻的成长</Text>
              </View>
              
              <View className="login-options">
                <Button 
                  className="login-btn wechat-btn"
                  onClick={handleWechatLogin}
                  disabled={isLoading}
                >
                  <Text className="btn-icon">👤</Text>
                  <Text className="btn-text">
                    {isLoading ? '登录中...' : '微信一键登录'}
                  </Text>
                </Button>
                
                <Button 
                  className="login-btn quick-btn"
                  onClick={handleQuickLogin}
                  disabled={isLoading}
                >
                  <Text className="btn-icon">⚡</Text>
                  <Text className="btn-text">
                    {isLoading ? '登录中...' : '快速体验'}
                  </Text>
                </Button>
              </View>
              
              <View className="login-tips">
                <Text className="tips-text">
                  • 微信登录可同步数据到云端
                </Text>
                <Text className="tips-text">
                  • 快速体验仅保存到本地
                </Text>
              </View>
            </>
          ) : (
            <View className="profile-step">
              <Text className="profile-title">请完善您的资料</Text>
              
              <LoginModal
                visible={true}
                userProfile={userInfo}
                onClose={() => setStep('login')}
                onProfileUpdate={handleSaveProfile}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default WechatLogin;