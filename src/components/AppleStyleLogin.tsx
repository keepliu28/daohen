import React, { useState } from 'react';
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { setOpenId, saveUserProfile } from '../utils/storage';
import './AppleStyleLogin.scss';

interface AppleStyleLoginProps {
  visible: boolean;
  onSuccess: (userInfo: any) => void;
  onClose: () => void;
}

const AppleStyleLogin: React.FC<AppleStyleLoginProps> = ({ visible, onClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [pendingUserInfo, setPendingUserInfo] = useState<any>(null);

  if (!visible) return null;

  // 处理微信授权按钮点击
  const handleGetUserInfo = async (e: any) => {
    if (isLoading) return;
    
    setIsLoading(true);
    Taro.showLoading({ title: '获取信息中...' });

    try {
      const { userInfo } = e.detail;
      
      if (!userInfo) {
        Taro.hideLoading();
        Taro.showToast({ title: '您已取消授权', icon: 'none' });
        return;
      }

      Taro.hideLoading();
      
      // 显示头像昵称选择界面，让用户确认
      setPendingUserInfo({
        ...userInfo,
        nickName: '' // 清空昵称，让用户输入
      });

    } catch (error: any) {
      Taro.hideLoading();
      console.error('获取用户信息失败:', error);
      Taro.showToast({ title: '获取失败，请重试', icon: 'none' });
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

  // 跳过完善资料
  const handleSkipProfile = () => {
    setPendingUserInfo(null);
    onClose();
  };

  // 保存用户资料并完成登录
  const handleSaveProfile = async () => {
    if (!pendingUserInfo?.nickName) {
      Taro.showToast({ title: '请设置昵称', icon: 'none' });
      return;
    }

    setIsLoading(true);
    Taro.showLoading({ title: '保存中...' });

    try {
      // 获取登录凭证
      const { code } = await Taro.login();

      // 调用云函数获取 openid
      const cloudRes = await Taro.cloud.callFunction({
        name: 'login',
        data: {
          code: code,
          userInfo: pendingUserInfo
        }
      });

      const openid = cloudRes.result.openid;

      console.log('[AppleStyleLogin] 获取到 openid:', openid);

      // 先保存 openid 到本地存储，这样 saveUserProfile 才能获取到
      setOpenId(openid);
      console.log('[AppleStyleLogin] openid 已保存到本地存储');

      // 上传头像到云存储（如果是临时文件）
      let finalAvatarUrl = pendingUserInfo.avatarUrl;
      if (pendingUserInfo.avatarUrl && (pendingUserInfo.avatarUrl.startsWith('http://tmp/') || pendingUserInfo.avatarUrl.startsWith('wxfile://'))) {
        console.log('[AppleStyleLogin] 开始上传头像...');
        const uploadRes = await Taro.cloud.uploadFile({
          cloudPath: `avatars/${openid}_${Date.now()}.png`,
          filePath: pendingUserInfo.avatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
        console.log('[AppleStyleLogin] 头像上传成功，fileID:', finalAvatarUrl);
      }

      // 保存用户信息到数据库
      const userProfile = {
        avatarUrl: finalAvatarUrl || '',
        nickName: pendingUserInfo.nickName,
        gender: pendingUserInfo.gender || 0,
        country: pendingUserInfo.country || '',
        province: pendingUserInfo.province || '',
        city: pendingUserInfo.city || '',
        openid: openid,
        createTime: Date.now(),
        updateTime: Date.now()
      };

      console.log('[AppleStyleLogin] 开始保存用户信息到数据库...');
      try {
        await saveUserProfile(userProfile);
        console.log('[AppleStyleLogin] 用户信息保存成功');
      } catch (saveError) {
        console.error('[AppleStyleLogin] 保存用户信息失败:', saveError);
        // 不阻断登录流程，因为本地已经保存了
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
      console.error('登录失败:', error);
      
      // 明确提示权限错误
      if (error.message?.includes('权限')) {
        Taro.showModal({
          title: '权限错误',
          content: error.message,
          showCancel: false
        });
      } else {
        Taro.showToast({ title: '登录失败，请重试', icon: 'none' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 如果没有选择头像昵称，显示微信授权按钮
  if (!pendingUserInfo) {
    return (
      <View className='apple-login-mask' onClick={onClose}>
        <View className='apple-login-content' onClick={e => e.stopPropagation()}>
          {/* 关闭按钮 */}
          <Button className='close-btn' onClick={onClose}>
            <Text className='close-icon'>×</Text>
          </Button>

          {/* Logo 和标题 */}
          <View className='login-header'>
            <View className='brand-icon'>
              <Text className='brand-text'>道</Text>
            </View>
            <Text className='login-title'>欢迎使用道痕</Text>
            <Text className='login-subtitle'>记录成长的每一步</Text>
          </View>

          {/* 微信一键登录按钮 */}
          <View className='login-section'>
            <Button 
              className='wechat-login-btn'
              openType='getUserInfo'
              onGetUserInfo={handleGetUserInfo}
              disabled={isLoading}
            >
              <View className='btn-content'>
                <Text className='wechat-icon'>💚</Text>
                <Text className='btn-text'>{isLoading ? '获取中...' : '微信一键登录'}</Text>
              </View>
            </Button>
            <Text className='login-tip'>使用微信账号快速登录</Text>
          </View>

          {/* 底部信息 */}
          <View className='login-footer'>
            <Text className='footer-text'>道痕 · 记录思想的光芒</Text>
          </View>
        </View>
      </View>
    );
  }

  // 显示头像昵称选择界面
  return (
    <View className='apple-login-mask' onClick={onClose}>
      <View className='apple-login-content' onClick={e => e.stopPropagation()}>
        {/* 关闭按钮 */}
        <Button className='close-btn' onClick={onClose}>
          <Text className='close-icon'>×</Text>
        </Button>

        {/* Logo 和标题 */}
        <View className='login-header'>
          <View className='brand-icon'>
            <Text className='brand-text'>道</Text>
          </View>
          <Text className='login-title'>完善个人资料</Text>
          <Text className='login-subtitle'>自定义您的头像和昵称</Text>
        </View>

        {/* 头像昵称选择表单 */}
        <View className='profile-section'>
          {/* 头像选择 */}
          <View className='form-group'>
            <Text className='form-label'>头像</Text>
            <Button 
              className='avatar-btn' 
              openType='chooseAvatar' 
              onChooseAvatar={handleChooseAvatar}
            >
              {pendingUserInfo.avatarUrl ? (
                <Image 
                  className='avatar-image' 
                  src={pendingUserInfo.avatarUrl} 
                  mode='aspectFill'
                />
              ) : (
                <View className='avatar-placeholder'>
                  <Text className='avatar-icon'>📷</Text>
                  <Text className='avatar-text'>选择头像</Text>
                </View>
              )}
            </Button>
          </View>

          {/* 昵称输入 */}
          <View className='form-group'>
            <Text className='form-label'>昵称</Text>
            <View className='input-container'>
              <Input
                className='nickname-input'
                type='nickname'
                placeholder='请输入昵称'
                placeholderClass='input-placeholder'
                value={pendingUserInfo.nickName}
                onInput={handleNickNameInput}
                maxlength={20}
              />
            </View>
          </View>

          {/* 操作按钮 */}
          <View className='action-buttons'>
            <Button 
              className='save-btn primary' 
              onClick={handleSaveProfile}
              disabled={isLoading || !pendingUserInfo.nickName}
            >
              {isLoading ? (
                <View className='btn-loading'>
                  <Text className='loading-spinner'>⌛</Text>
                  <Text>保存中...</Text>
                </View>
              ) : (
                <Text>开始使用道痕</Text>
              )}
            </Button>
            
            <Button 
              className='skip-btn secondary'
              onClick={handleSkipProfile}
            >
              <Text>跳过</Text>
            </Button>
          </View>
        </View>

        {/* 底部信息 */}
        <View className='login-footer'>
          <Text className='footer-text'>道痕 · 记录思想的光芒</Text>
        </View>
      </View>
    </View>
  );
};

export default AppleStyleLogin;