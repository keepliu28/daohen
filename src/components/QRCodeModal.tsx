import { useState } from 'react'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './QRCodeModal.scss'

interface QRCodeModalProps {
  visible: boolean
  onClose: () => void
}

export default function QRCodeModal({ visible, onClose }: QRCodeModalProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  if (!visible) return null

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    console.error('[QRCodeModal] 图片加载失败')
    Taro.showToast({ title: '图片加载失败', icon: 'none' })
  }

  const handleSaveToAlbum = async () => {
    try {
      Taro.showLoading({ title: '保存中...' })
      
      // 获取本地图片信息
      const qrcodeImagePath = require('../assets/images/qrcode-wechat-official.png')
      const fileInfo = await Taro.getImageInfo({
        src: qrcodeImagePath
      })
      
      // 保存到相册
      await Taro.saveImageToPhotosAlbum({
        filePath: fileInfo.path
      })
      
      Taro.hideLoading()
      Taro.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error: any) {
      Taro.hideLoading()
      
      if (error.errMsg && error.errMsg.includes('auth deny')) {
        // 用户拒绝授权，引导去设置页开启权限
        Taro.showModal({
          title: '需要相册权限',
          content: '请允许访问相册以保存二维码图片',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              Taro.openSetting()
            }
          }
        })
      } else {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    }
  }

  const handleLongPress = () => {
    Taro.showActionSheet({
      itemList: ['保存二维码到相册', '识别图中二维码'],
      success: (res) => {
        if (res.tapIndex === 0) {
          handleSaveToAlbum()
        } else if (res.tapIndex === 1) {
          // 跳转到微信扫一扫（小程序限制，这里用提示代替）
          Taro.showToast({ 
            title: '请长按图片识别二维码', 
            icon: 'none',
            duration: 2000
          })
        }
      }
    })
  }

  return (
    <View className='qrcode-mask' onClick={onClose}>
      <View className='qrcode-content' onClick={e => e.stopPropagation()}>
        {/* 标题区域 */}
        <View className='qrcode-header'>
          <Text className='qrcode-title'>关注公众号</Text>
          <Text className='qrcode-close' onClick={onClose}>✕</Text>
        </View>

        {/* 二维码展示区 */}
        <View className='qrcode-body'>
          <Text className='qrcode-subtitle'>
            扫码关注「道痕」公众号
          </Text>
          <Text className='qrcode-desc'>
            获取最新功能更新和使用技巧
          </Text>

          {/* 二维码图片 */}
          <View 
            className='qrcode-image-wrapper'
            onLongPress={handleLongPress}
          >
            {!imageLoaded && (
              <View className='image-loading'>
                <Text className='loading-text'>加载中...</Text>
              </View>
            )}
            
            <Image 
              src={require('../assets/images/qrcode-wechat-official.png')}
              className='qrcode-image'
              mode='aspectFit'
              onLoad={handleImageLoad}
              onError={handleImageError}
              showMenuByLongpress
            />

            {/* Logo 叠加层（可选） */}
            <View className='qrcode-logo-overlay'>
              <Text className='logo-text'>道痕</Text>
            </View>
          </View>

          {/* 操作提示 */}
          <Text className='qrcode-tip'>
            💡 长按二维码可保存到相册或识别
          </Text>
        </View>

        {/* 底部按钮 */}
        <View className='qrcode-footer'>
          <Button 
            className='save-btn'
            onClick={handleSaveToAlbum}
          >
            <Text className='btn-icon'>📥</Text>
            <Text>保存到相册</Text>
          </Button>
          
          <Button 
            className='close-btn'
            onClick={onClose}
          >
            关闭
          </Button>
        </View>
      </View>
    </View>
  )
}
