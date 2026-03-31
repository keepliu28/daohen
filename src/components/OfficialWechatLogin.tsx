import React, { useState } from 'react';
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { setOpenId, saveUserProfile } from '../utils/storage';
import './OfficialWechatLogin.scss';

interface OfficialWechatLoginProps {
  visible: boolean;
  onSuccess: (userInfo: any) => void;
  onClose: () => void;
}

const OfficialWechatLogin: React.FC<OfficialWechatLoginProps> = ({ visible, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUserInfo, setPendingUserInfo] = useState<any>(null);

  if (!visible) return null;

  // 统一的错误处理函数
  const handleLoginError = (error: any, operation: string) => {
    console.error(`${operation}失败:`, error);
    
    // 根据错误类型提供不同的用户提示
    if (error.errCode === -502003) {
      Taro.showModal({
        title: '权限错误',
        content: '数据库权限不足，请联系管理员检查权限配置',
        showCancel: false
      });
    } else if (error.errMsg?.includes('network') || error.errMsg?.includes('timeout')) {
      Taro.showModal({
        title: '网络异常',
        content: '网络连接不稳定，请检查网络设置后重试',
        showCancel: false
      });
    } else if (error.errMsg?.includes('auth')) {
      Taro.showModal({
        title: '授权失败',
        content: '微信授权失败，请重新授权',
        showCancel: false
      });
    } else if (error.errMsg?.includes('cloud')) {
      Taro.showModal({
        title: '云服务异常',
        content: '云服务暂时不可用，请稍后重试',
        showCancel: false
      });
    } else {
      Taro.showToast({ 
        title: `${operation}失败，请重试`,
        icon: 'none',
        duration: 2000
      });
    }
  };

  // 处理微信授权按钮点击
  const handleGetUserInfo = async (e: any) => {
    if (isLoading) return;
    
    setIsLoading(true);
    Taro.showLoading({ 
      title: '获取信息中...',
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

      Taro.hideLoading();
      
      // 显示头像昵称选择界面，让用户确认
      setPendingUserInfo(userInfo);

    } catch (error: any) {
      Taro.hideLoading();
      console.error('获取用户信息失败:', error);
      handleLoginError(error, '获取用户信息');
    } finally {
      setIsLoading(false);
    }
  };

  // 处理头像选择
  const handleChooseAvatar = async (e: any) => {
    const { avatarUrl } = e.detail;
    if (pendingUserInfo) {
      setPendingUserInfo({
        ...pendingUserInfo,
        avatarUrl: avatarUrl
      });
    }
  };

  // 处理昵称输入
  const handleNickNameInput = (e: any) => {
    if (pendingUserInfo) {
      setPendingUserInfo({
        ...pendingUserInfo,
        nickName: e.detail.value
      });
    }
  };

  // 保存用户资料并完成登录
  const handleSaveProfile = async () => {
    if (!pendingUserInfo?.avatarUrl || !pendingUserInfo?.nickName) {
      Taro.showToast({ 
        title: '请完善头像和昵称', 
        icon: 'none',
        duration: 2000
      });
      return;
    }

    setIsLoading(true);
    Taro.showLoading({ 
      title: '保存中...',
      mask: true
    });

    try {
      // 获取登录凭证
      const { code } = await Taro.login();

      // 调用云函数获取 openid（添加超时处理）
      const cloudRes = await Taro.cloud.callFunction({
        name: 'login',
        data: {
          code: code,
          userInfo: pendingUserInfo
        },
        timeout: 10000
      });

      const openid = cloudRes.result.openid;

      // 先保存 openid 到本地存储，这样 saveUserProfile 才能获取到
      setOpenId(openid);
      console.log('[OfficialWechatLogin] openid 已保存到本地存储');

      // 上传头像到云存储（如果是临时文件）
      let finalAvatarUrl = pendingUserInfo.avatarUrl;
      if (pendingUserInfo.avatarUrl.startsWith('http://tmp/') || pendingUserInfo.avatarUrl.startsWith('wxfile://')) {
        Taro.showLoading({ 
          title: '上传头像中...',
          mask: true
        });
        
        const uploadRes = await Taro.cloud.uploadFile({
          cloudPath: `avatars/${openid}_${Date.now()}.png`,
          filePath: pendingUserInfo.avatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      // 保存用户信息到数据库
      const userProfile = {
        avatarUrl: finalAvatarUrl,
        nickName: pendingUserInfo.nickName,
        gender: pendingUserInfo.gender,
        country: pendingUserInfo.country,
        province: pendingUserInfo.province,
        city: pendingUserInfo.city,
        openid: openid,
        createTime: Date.now(),
        updateTime: Date.now()
      };

      console.log('[OfficialWechatLogin] 开始保存用户信息到数据库...');
      try {
        await saveUserProfile(userProfile);
        console.log('[OfficialWechatLogin] 用户信息保存成功');
      } catch (saveError) {
        console.error('[OfficialWechatLogin] 保存用户信息失败:', saveError);
      }

      Taro.hideLoading();
      Taro.showToast({ 
        title: '登录成功', 
        icon: 'success',
        duration: 1500
      });

      setPendingUserInfo(null);

      // 登录成功回调
      setTimeout(() => {
        onSuccess({
          ...pendingUserInfo,
          openid: openid
        });
      }, 1500);

    } catch (error: any) {
      Taro.hideLoading();
      handleLoginError(error, '登录');
    } finally {
      setIsLoading(false);
    }
  };

  // 如果没有选择头像昵称，显示微信授权按钮
  if (!pendingUserInfo) {
    return (
      <View className='official-login-fullscreen'>
        {/* 背景装饰 */}
        <View className='login-background'>
          <View className='bg-circle bg-circle-1'></View>
          <View className='bg-circle bg-circle-2'></View>
          <View className='bg-circle bg-circle-3'></View>
        </View>

        {/* 主内容区域 */}
        <View className='official-login-content-full'>
          {/* Logo 和标题 */}
          <View className='login-header-full'>
            <View className='brand-logo-container'>
              <View className='brand-logo'>
                <Text className='brand-logo-text'>道</Text>
              </View>
            </View>
            <Text className='login-main-title'>欢迎使用道痕</Text>
            <Text className='login-main-subtitle'>记录成长的每一步</Text>
          </View>

          {/* 微信一键登录按钮 */}
          <View className='login-action-full'>
            <Button 
              className='wechat-login-btn-full'
              openType='getUserInfo'
              onGetUserInfo={handleGetUserInfo}
              disabled={isLoading}
            >
              <View className='btn-content-full'>
                <Text className='btn-icon-full'>💚</Text>
                <Text>{isLoading ? '获取中...' : '微信一键登录'}</Text>
              </View>
            </Button>
            <Text className='login-tip-full'>使用微信账号快速登录</Text>
          </View>

          {/* 底部信息 */}
          <View className='login-footer-full'>
            <Text className='footer-text-full'>道痕 · 记录思想的光芒</Text>
          </View>
        </View>
      </View>
    );
  }

  // 显示头像昵称选择界面（全屏）
  return (
    <View className='official-login-fullscreen'>
      {/* 背景装饰 */}
      <View className='login-background'>
        <View className='bg-circle bg-circle-1'></View>
        <View className='bg-circle bg-circle-2'></View>
        <View className='bg-circle bg-circle-3'></View>
      </View>

      {/* 主内容区域 */}
      <View className='official-login-content-full'>
        {/* Logo 和标题 */}
        <View className='login-header-full'>
          <View className='brand-logo-container'>
            <View className='brand-logo'>
              <Text className='brand-logo-text'>道</Text>
            </View>
          </View>
          <Text className='login-main-title'>完善个人资料</Text>
          <Text className='login-main-subtitle'>自定义您的头像和昵称</Text>
        </View>

        {/* 表单区域 */}
        <View className='profile-form-full'>
          {/* 头像选择 - 圆形设计 */}
          <View className='avatar-section-full'>
            <Text className='section-label-full'>选择头像</Text>
            <Button 
              className='avatar-btn-circle' 
              openType='chooseAvatar' 
              onChooseAvatar={handleChooseAvatar}
            >
              {pendingUserInfo.avatarUrl ? (
                <Image 
                  className='avatar-image-circle' 
                  src={pendingUserInfo.avatarUrl} 
                  mode='aspectFill'
                />
              ) : (
                <View className='avatar-circle-placeholder'>
                  <Text className='avatar-circle-icon'>📷</Text>
                  <Text className='avatar-circle-text'>点击选择</Text>
                </View>
              )}
            </Button>
          </View>

          {/* 昵称输入 */}
          <View className='nickname-section-full'>
            <Text className='section-label-full'>设置昵称</Text>
            <View className='input-wrapper-full'>
              <Text className='input-icon-full'>👤</Text>
              <Input
                className='nickname-input-full'
                type='nickname'
                placeholder='请输入昵称'
                placeholderClass='input-placeholder-full'
                value={pendingUserInfo.nickName}
                onInput={handleNickNameInput}
                maxlength={20}
              />
            </View>
          </View>

          {/* 操作按钮 */}
          <View className='action-section-full'>
            <Button 
              className='save-btn-full' 
              onClick={handleSaveProfile}
              disabled={isLoading || !pendingUserInfo.nickName}
            >
              {isLoading ? (
                <View className='btn-loading-full'>
                  <Text className='loading-spinner-full'>⌛</Text>
                  <Text>保存中...</Text>
                </View>
              ) : (
                <Text>开始使用道痕</Text>
              )}
            </Button>
            <Text className='login-tip-full'>完善资料后即可使用所有功能</Text>
          </View>
        </View>

        {/* 底部信息 */}
        <View className='login-footer-full'>
          <Text className='footer-text-full'>道痕 · 记录思想的光芒</Text>
        </View>
      </View>
    </View>
  );
};

export default OfficialWechatLogin;