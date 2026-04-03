import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Terms() {
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
    <View className='terms-container'>
      <View className='terms-header'>
        <Text className='terms-title'>使用条款</Text>
        <Text className='terms-subtitle'>Terms of Service</Text>
      </View>

      <ScrollView className='terms-content' scrollY>
        <View className='terms-section'>
          <Text className='section-title'>1. 服务说明</Text>
          <Text className='section-content'>
            道痕是一款基于心理学方法论的情绪记录工具，帮助用户通过结构化的方式记录和分析情绪。
          </Text>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>2. 账号注册</Text>
          <View className='list-item'>
            <Text className='list-text'>2.1 您需要使用微信账号登录本小程序。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>2.2 您承诺提供真实、准确的个人信息。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>2.3 您应妥善保管您的账号信息，不得将账号转借他人。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>3. 用户行为规范</Text>
          <View className='list-item'>
            <Text className='list-text'>3.1 您不得利用本服务制作、上传、传播任何违法违规内容。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>3.2 您应尊重知识产权，不得侵犯他人合法权益。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>3.3 您不得对本服务进行反向工程、反向编译等行为。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>4. Pro 会员服务</Text>
          <View className='list-item'>
            <Text className='list-text'>4.1 Pro 会员为付费服务，费用一经支付不予退还。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>4.2 Pro 会员有效期至您购买的截止日期。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>4.3 我们保留调整 Pro 会员权益和价格的权利。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>4.4 月度 Pro 价格为 ¥1.9/月，年度 Pro 价格为 ¥19.9/年。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>5. 数据安全</Text>
          <View className='list-item'>
            <Text className='list-text'>5.1 我们会采取合理的技术措施保护您的数据安全。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>5.2 免费版不保证换设备数据不丢失，Pro 会员提供云备份服务。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>5.3 您应定期备份重要数据，我们对数据丢失不承担责任。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>6. 账号注销</Text>
          <View className='list-item'>
            <Text className='list-text'>6.1 您可以随时申请注销账号。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>6.2 注销后，您的所有数据将被永久删除且不可恢复。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>6.3 注销前请确保已保存重要数据。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>7. 知识产权</Text>
          <View className='list-item'>
            <Text className='list-text'>7.1 本服务的所有内容（包括但不限于代码、界面设计、文字、图片）均受知识产权保护。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>7.2 未经我们书面许可，您不得复制、传播、修改本服务的任何内容。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>8. 免责声明</Text>
          <View className='list-item'>
            <Text className='list-text'>8.1 本服务仅供参考，不构成专业心理建议。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>8.2 如因不可抗力导致服务中断，我们不承担责任。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>8.3 您使用本服务的风险由您自行承担。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>9. 条款变更</Text>
          <View className='list-item'>
            <Text className='list-text'>9.1 我们有权随时修改本条款。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>9.2 修改后的条款将在小程序内公示。</Text>
          </View>
          <View className='list-item'>
            <Text className='list-text'>9.3 如您继续使用本服务，视为您接受修改后的条款。</Text>
          </View>
        </View>

        <View className='terms-section'>
          <Text className='section-title'>10. 联系我们</Text>
          <Text className='section-content'>
            如有任何问题或建议，请通过以下方式联系我们：
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
          </View>
        </View>

        <View className='terms-footer'>
          <Text className='update-date'>最后更新：2026 年 4 月</Text>
        </View>
      </ScrollView>
    </View>
  )
}
