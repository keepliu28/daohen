import React from 'react';
import { View, Text, Button, Image, Input } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { uploadAvatar, saveUserProfile } from '../utils/storage';
import './LoginModal.scss';

interface LoginModalProps {
  visible: boolean;
  userProfile?: any;
  onClose: () => void;
  onProfileUpdate: (profile: any) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({
  visible,
  userProfile,
  onClose,
  onProfileUpdate
}) => {
  const [tempAvatarUrl, setTempAvatarUrl] = React.useState('');
  const [tempNickName, setTempNickName] = React.useState('');

  React.useEffect(() => {
    if (visible) {
      setTempAvatarUrl(userProfile?.avatarUrl || '');
      setTempNickName(userProfile?.nickName || '');
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
      
      if (success) {
        onProfileUpdate(profile);
        onClose();
        Taro.showToast({ 
          title: '保存成功', 
          icon: 'success',
          duration: 1500
        });
      } else {
        Taro.showToast({ 
          title: '保存失败', 
          icon: 'none' 
        });
      }
    } catch (error) {
      console.error('保存用户资料失败:', error);
      Taro.showToast({ 
        title: '保存失败', 
        icon: 'none' 
      });
    } finally {
      Taro.hideLoading();
    }
  };

  if (!visible) return null;

  return (
    <View className="login-modal-mask" onClick={onClose}>
      <View className="login-modal-content" onClick={e => e.stopPropagation()}>
        <View className="login-modal-header">
          <Text className="login-modal-title">完善个人资料</Text>
          <Text className="login-modal-close" onClick={onClose}>✕</Text>
        </View>
        
        <View className="login-modal-body">
          <Button 
            className="avatar-wrapper" 
            openType="chooseAvatar" 
            onChooseAvatar={handleChooseAvatar}
          >
            {tempAvatarUrl || userProfile?.avatarUrl ? (
              <Image 
                className="avatar-preview" 
                src={tempAvatarUrl || userProfile?.avatarUrl} 
              />
            ) : (
              <View className="avatar-placeholder-large">👤</View>
            )}
          </Button>
          
          <Text className="avatar-hint">点击选择头像</Text>
          
          <View className="nickname-wrapper">
            <Text className="nickname-label">昵称</Text>
            <Input 
              type="nickname" 
              className="nickname-input" 
              placeholder="请输入昵称" 
              value={tempNickName || userProfile?.nickName} 
              onInput={(e) => setTempNickName(e.detail.value)}
            />
          </View>
          
          <View className="save-profile-btn" onClick={handleSaveProfile}>
            <Text>保存</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default LoginModal;