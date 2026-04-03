import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Privacy() {
  const [copying, setCopying] = useState(false)

  const handleCopyWechat = () => {
    setCopying(true)
    Taro.setClipboardData({
      data: 'kanshan28',
      success: () => {
        Taro.showToast({
          title: '已复制微信号',
          icon: 'success'
        })
      },
      complete: () => {
        setCopying(false)
      }
    })
  }

  return (
    <View className='privacy-container'>
      <View className='privacy-header'>
        <Text className='privacy-title'>隐私政策</Text>
        <Text className='privacy-subtitle'>Privacy Policy</Text>
      </View>

      <ScrollView className='privacy-content' scrollY>
        <View className='privacy-section'>
          <Text className='section-title'>1. 信息收集</Text>
          <View className='subsection'>
            <Text className='subsection-title'>1.1 我们收集的信息</Text>
            <View className='list-item'>
              <Text className='list-text'>• 微信账号信息（昵称、头像、openid）</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 您记录的情绪日记内容</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 使用时间和频率数据</Text>
            </View>
          </View>
          <View className='subsection'>
            <Text className='subsection-title'>1.2 我们不收集的信息</Text>
            <View className='list-item'>
              <Text className='list-text'>• 您的真实姓名</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 手机号码</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 身份证号等敏感信息</Text>
            </View>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>2. 信息使用</Text>
          <View className='subsection'>
            <Text className='subsection-title'>2.1 我们使用收集的信息用于：</Text>
            <View className='list-item'>
              <Text className='list-text'>• 提供情绪记录和分析服务</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 改善用户体验</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 数据备份和同步（Pro 会员）</Text>
            </View>
          </View>
          <View className='subsection'>
            <Text className='subsection-title'>2.2 我们不会：</Text>
            <View className='list-item'>
              <Text className='list-text'>• 向第三方出售您的个人信息</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 将您的信息用于营销推广</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 未经您同意向第三方披露您的信息</Text>
            </View>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>3. 数据存储</Text>
          <View className='subsection'>
            <Text className='subsection-title'>3.1 本地存储</Text>
            <View className='list-item'>
              <Text className='list-text'>• 免费版：数据仅存储在您的设备本地</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 换设备可能导致数据丢失</Text>
            </View>
          </View>
          <View className='subsection'>
            <Text className='subsection-title'>3.2 云端存储（Pro 会员）</Text>
            <View className='list-item'>
              <Text className='list-text'>• 数据加密存储在微信云服务器</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 支持跨设备同步</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 定期备份，防止数据丢失</Text>
            </View>
          </View>
          <View className='subsection'>
            <Text className='subsection-title'>3.3 存储期限</Text>
            <View className='list-item'>
              <Text className='list-text'>• 只要您使用本服务，我们会保存您的数据</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 账号注销后，所有数据立即永久删除</Text>
            </View>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>4. 数据安全</Text>
          <View className='subsection'>
            <Text className='subsection-title'>4.1 技术措施</Text>
            <View className='list-item'>
              <Text className='list-text'>• 使用微信云开发的加密存储</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 数据传输采用 HTTPS 加密</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 严格的访问控制</Text>
            </View>
          </View>
          <View className='subsection'>
            <Text className='subsection-title'>4.2 用户责任</Text>
            <View className='list-item'>
              <Text className='list-text'>• 请妥善保管您的微信账号</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 不要将账号借给他人使用</Text>
            </View>
            <View className='list-item'>
              <Text className='list-text'>• 发现账号异常请立即联系我们</Text>
            </View>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>5. 信息共享</Text>
          <View className='list-item'>
            <Text className='list-text'>5.1 我们不会与任何第三方共享您的个人信息，以下情况除外：</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>• 获得您的明确同意</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>• 根据法律法规要求</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>• 为保护我们的合法权益</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>5.2 匿名化数据：我们可能会使用匿名化的统计数据进行产品分析，这些数据无法识别您的个人身份。</Text>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>6. 您的权利</Text>
          <View className='list-item'>
            <Text className='list-text'>6.1 访问权：您可以随时查看您的所有数据</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>6.2 删除权：您可以删除任何一条日记，也可以注销账号删除所有数据</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>6.3 导出权：您可以随时导出您的数据（Pro 会员功能）</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>6.4 撤回同意：注销账号即视为您撤回所有授权</Text>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>7. 未成年人保护</Text>
          <View className='list-item'>
            <Text className='list-text'>7.1 本服务面向所有年龄段用户</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>7.2 建议未成年人在监护人指导下使用</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>7.3 我们不会故意收集未成年人的敏感信息</Text>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>8. 政策更新</Text>
          <View className='list-item'>
            <Text className='list-text'>8.1 我们可能会不时更新本隐私政策</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>8.2 更新后的政策将在小程序内公示</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>8.3 重大变更会通过弹窗等方式通知您</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>8.4 继续使用本服务视为您接受更新后的政策</Text>
          </View>
        </View>

        <View className='privacy-section'>
          <Text className='section-title'>9. 联系我们</Text>
          <Text className='section-content'>
            如您对本隐私政策有任何疑问或建议，请通过以下方式联系我们：
          </Text>
          <View className='contact-info'>
            <View className='contact-item'>
              <Text>微信号：kanshan28</Text>
              <Text className='copy-btn' onClick={handleCopyWechat}>
                {copying ? '复制中...' : '复制'}
              </Text>
            </View>
            <View className='contact-item'>
              <Text>邮箱：kanshan28@foxmail.com</Text>
            </View>
            <View className='contact-note'>
              <Text>我们会在 7 个工作日内回复您的咨询。</Text>
            </View>
          </View>
        </View>

        <View className='privacy-footer'>
          <Text className='update-date'>最后更新：2026 年 4 月</Text>
        </View>
      </ScrollView>
    </View>
  )
}
