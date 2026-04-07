import React, { useState, useEffect } from 'react';
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { uploadAvatar, saveUserProfile } from '../utils/storage';
import './ModernLoginModal.scss';

interface ModernLoginModalProps {
  visible: boolean;
  userProfile?: any;
  onClose: () => void;
  onProfileUpdate: (profile: any) => void;
}

const ModernLoginModal: React.FC<ModernLoginModalProps> = ({
  visible,
  userProfile,
  onClose,
  onProfileUpdate
}) => {
  const [tempAvatarUrl, setTempAvatarUrl] = useState('');
  const [tempNickName, setTempNickName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempAvatarUrl(userProfile?.avatarUrl || '');
      setTempNickName(userProfile?.nickName || '道痕行者');
    }
  }, [visible, userProfile]);

  const handleChooseAvatar = async (e: any) => {
    const { avatarUrl } = e.detail;
    setTempAvatarUrl(avatarUrl);
  };

  const handleSaveProfile = async () => {
    console.log('[handleSaveProfile] 当前头像:', tempAvatarUrl);
    console.log('[handleSaveProfile] 当前昵称:', tempNickName, '(长度:', tempNickName?.length, ')');
    
    if (!tempAvatarUrl && !userProfile?.avatarUrl) {
      Taro.showToast({ title: '请选择头像', icon: 'none' });
      return;
    }
    
    const hasNickName = tempNickName && tempNickName.trim().length > 0;
    const hasExistingNickName = userProfile?.nickName && userProfile.nickName.trim().length > 0;
    
    if (!hasNickName && !hasExistingNickName) {
      Taro.showModal({
        title: '提示',
        content: '您还没有设置昵称，将使用默认昵称"道痕行者"，您可以在稍后修改。',
        showCancel: false,
        confirmText: '好的'
      });
    }
    
    const finalNickName = (hasNickName ? tempNickName.trim() : (userProfile?.nickName || '道痕行者'));
    const finalAvatarUrl = tempAvatarUrl || userProfile?.avatarUrl || '';
    
    console.log('[handleSaveProfile] 最终头像:', finalAvatarUrl);
    console.log('[handleSaveProfile] 最终昵称:', finalNickName);
    
    setIsSaving(true);
    Taro.showLoading({ title: '保存中...' });
    
    try {
      let uploadAvatarUrl = finalAvatarUrl;
      
      if (finalAvatarUrl.startsWith('http://tmp/') || finalAvatarUrl.startsWith('wxfile://')) {
        const fileID = await uploadAvatar(finalAvatarUrl);
        if (fileID) {
          uploadAvatarUrl = fileID;
        }
      }
      
      const profile = { 
        avatarUrl: uploadAvatarUrl, 
        nickName: finalNickName 
      };
      
      console.log('[handleSaveProfile] 准备保存的资料:', profile);
      
      const success = await saveUserProfile(profile);
      
      Taro.hideLoading();
      
      if (success) {
        Taro.showToast({ title: '保存成功', icon: 'success' });
        onProfileUpdate(profile);
        setTimeout(() => onClose(), 500);
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } catch (error: any) {
      Taro.hideLoading();
      console.error('保存用户资料失败:', error);
      
      if (error.message?.includes('权限')) {
        Taro.showModal({
          title: '权限错误',
          content: error.message,
          showCancel: false
        });
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <View className='modern-login-mask' onClick={onClose}>
      <View className='modern-login-content' onClick={e => e.stopPropagation()}>
        {/* 顶部渐变背景 */}
        <View className='login-header-gradient'>
          <View className='glow-circle glow-1'></View>
          <View className='glow-circle glow-2'></View>
        </View>

        {/* 关闭按钮 */}
        <View className='close-btn' onClick={onClose}>
          <Text className='close-icon'>✕</Text>
        </View>

        {/* 内容区域 */}
        <View className='login-body'>
          {/* Logo 和标题 */}
          <View className='brand-section'>
            <View className='logo-wrapper'>
              <View className='logo-icon'>
                <Text className='logo-text'>道</Text>
              </View>
            </View>
            <Text className='main-title'>欢迎使用道痕</Text>
            <Text className='sub-title'>记录思想的光芒</Text>
          </View>

          {/* 头像选择 */}
          <View className='avatar-section'>
            <Text className='section-label'>头像</Text>
            <View className='avatar-container'>
              <Button 
                className='avatar-btn' 
                openType='chooseAvatar' 
                onChooseAvatar={handleChooseAvatar}
              >
                {tempAvatarUrl ? (
                  <Image className='avatar-image' src={tempAvatarUrl} mode='aspectFill' />
                ) : (
                  <View className='avatar-placeholder'>
                    <Text className='camera-icon'>📷</Text>
                    <Text className='placeholder-text'>点击选择头像</Text>
                  </View>
                )}
              </Button>
            </View>
          </View>

          {/* 昵称输入 */}
          <View className='nickname-section'>
            <View className='nickname-label-row'>
              <Text className='section-label'>昵称</Text>
              {tempNickName && tempNickName.length > 0 && (
                <View 
                  className='clear-btn'
                  onClick={() => setTempNickName('')}
                >
                  <Text className='clear-text'>清空</Text>
                  <Text className='clear-icon'>✕</Text>
                </View>
              )}
            </View>
            <View className='input-container'>
              <View className='input-wrapper'>
                <Text className='input-prefix'>👤</Text>
                <Input
                  className='nickname-input'
                  type='text'
                  placeholder='给自己起个温暖的名字'
                  placeholderClass='input-placeholder'
                  value={tempNickName || ''}
                  onInput={(e) => {
                    const value = e.detail.value || '';
                    setTempNickName(value);
                  }}
                  onBlur={(e) => {
                    const value = e.detail.value || '';
                    setTempNickName(value);
                  }}
                  maxlength={20}
                  confirmType='done'
                  cursor={-1}
                />
                {tempNickName && tempNickName.length > 0 && (
                  <View 
                    className='delete-btn'
                    onClick={() => setTempNickName(tempNickName.slice(0, -1))}
                  >
                    <Text className='delete-icon'>⌫</Text>
                  </View>
                )}
              </View>
            </View>
            <Text className='input-tip'>支持中文、英文、数字，最多 20 个字符</Text>
          </View>

          {/* 保存按钮 */}
          <View className='action-section'>
            <Button 
              className='save-btn' 
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <View className='loading-state'>
                  <Text className='spinner'>⟳</Text>
                  <Text>保存中...</Text>
                </View>
              ) : (
                <Text>开始使用道痕</Text>
              )}
            </Button>
            <Text className='helper-text'>完善资料后即可使用所有功能</Text>
          </View>
        </View>

        {/* 底部装饰 */}
        <View className='login-footer'>
          <View className='footer-divider'></View>
          <Text className='footer-text'>道痕 · 记录思想的光芒</Text>
        </View>
      </View>
    </View>
  );
};

export default ModernLoginModal;
