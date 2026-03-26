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
    if (!tempAvatarUrl || !tempNickName) {
      Taro.showToast({ title: '请完善头像和昵称', icon: 'none' });
      return;
    }
    
    setIsSaving(true);
    Taro.showLoading({ title: '保存中...' });
    
    try {
      let finalAvatarUrl = tempAvatarUrl;
      
      // 如果是临时文件，上传到云存储
      if (tempAvatarUrl.startsWith('http://tmp/') || tempAvatarUrl.startsWith('wxfile://')) {
        const fileID = await uploadAvatar(tempAvatarUrl);
        if (fileID) {
          finalAvatarUrl = fileID;
        }
      }
      
      const profile = { 
        avatarUrl: finalAvatarUrl, 
        nickName: tempNickName 
      };
      
      const success = await saveUserProfile(profile);
      
      Taro.hideLoading();
      
      if (success) {
        Taro.showToast({ title: '保存成功', icon: 'success' });
        onProfileUpdate(profile);
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
      }
    } catch (error: any) {
      Taro.hideLoading();
      console.error('保存用户资料失败:', error);
      
      // 明确提示权限错误
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
        {/* 顶部装饰背景 */}
        <View className='login-header-bg'>
          <View className='decoration-circle circle-1'></View>
          <View className='decoration-circle circle-2'></View>
          <View className='decoration-circle circle-3'></View>
        </View>

        {/* 标题区域 */}
        <View className='login-title-section'>
          <View className='app-icon-wrapper'>
            <View className='app-icon-bg'>
              <Text className='app-icon-text'>道</Text>
            </View>
          </View>
          <Text className='login-main-title'>欢迎使用道痕</Text>
          <Text className='login-sub-title'>记录成长的每一步</Text>
        </View>

        {/* 表单区域 */}
        <View className='login-form-section'>
          {/* 头像选择 */}
          <View className='avatar-section'>
            <Text className='field-label'>选择头像</Text>
            <Button 
              className='avatar-upload-btn' 
              openType='chooseAvatar' 
              onChooseAvatar={handleChooseAvatar}
            >
              {tempAvatarUrl ? (
                <Image className='avatar-preview' src={tempAvatarUrl} mode='aspectFill' />
              ) : (
                <View className='avatar-placeholder'>
                  <Text className='avatar-placeholder-icon'>📷</Text>
                  <Text className='avatar-placeholder-text'>点击选择</Text>
                </View>
              )}
            </Button>
          </View>

          {/* 昵称输入 */}
          <View className='nickname-section'>
            <Text className='field-label'>设置昵称</Text>
            <View className='nickname-input-wrapper'>
              <Text className='input-icon'>👤</Text>
              <Input
                className='nickname-input'
                type='nickname'
                placeholder='请输入您的昵称'
                placeholderClass='input-placeholder'
                value={tempNickName}
                onInput={(e) => setTempNickName(e.detail.value)}
                maxlength={20}
              />
            </View>
          </View>

          {/* 保存按钮 */}
          <View className='save-btn-section'>
            <Button 
              className='save-profile-btn' 
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <View className='btn-loading'>
                  <Text className='loading-spinner'>⌛</Text>
                  <Text>保存中...</Text>
                </View>
              ) : (
                <Text>开始使用道痕</Text>
              )}
            </Button>
            <Text className='login-tip'>完善资料后即可使用所有功能</Text>
          </View>
        </View>

        {/* 底部装饰 */}
        <View className='login-footer'>
          <View className='footer-line'></View>
          <Text className='footer-text'>道痕 · 记录思想的光芒</Text>
        </View>
      </View>
    </View>
  );
};

export default ModernLoginModal;
