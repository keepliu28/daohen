import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { View, Button, Text } from '@tarojs/components'
import './index.scss'

/**
 * 支付测试页面 - 用于调试支付问题
 */
export default function TestPay() {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [cloudReady, setCloudReady] = useState(false)

  useEffect(() => {
    // 检查云开发是否就绪
    const checkCloud = async () => {
      try {
        if (Taro.cloud) {
          setCloudReady(true)
          addLog('✅ 云开发 SDK 已就绪')
        } else {
          addLog('⚠️ 云开发 SDK 未初始化，等待中...')
          setTimeout(checkCloud, 500)
        }
      } catch (error) {
        addLog(`❌ 云开发检查失败：${error}`)
      }
    }
    
    checkCloud()
  }, [])

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`])
  }

  const testPayment = async () => {
    // 再次检查云开发
    if (!Taro.cloud) {
      Taro.showModal({
        title: '云开发未就绪',
        content: '云开发 SDK 尚未初始化，请稍后再试',
        showCancel: false
      })
      return
    }

    setLoading(true)
    setLogs([])
    
    try {
      addLog('🚀 开始测试支付流程')
      
      // 1. 调用云函数创建订单
      addLog('📋 步骤 1: 调用云函数创建订单...')
      addLog(`Taro.cloud 对象：${!!Taro.cloud}`)
      
      const orderResult = await Taro.cloud.callFunction({
        name: 'payment',
        data: {
          action: 'createOrder',
          data: { planType: 'daily' }
        }
      })
      
      addLog('✅ 云函数返回结果')
      addLog(`订单数据：${JSON.stringify(orderResult.result)}`)
      
      const resultData = orderResult.result
      if (!resultData.success) {
        addLog(`❌ 创建订单失败：${resultData.error}`)
        setLoading(false)
        return
      }
      
      const { orderId, timeStamp, nonceStr, package: pkg, signType, paySign } = resultData.data
      addLog(`订单 ID: ${orderId}`)
      addLog(`timeStamp: ${timeStamp}`)
      addLog(`nonceStr: ${nonceStr}`)
      addLog(`package: ${pkg}`)
      addLog(`signType: ${signType}`)
      addLog(`paySign (前 50 字符): ${paySign?.substring(0, 50)}...`)
      
      // 2. 检查参数完整性
      addLog('🔍 步骤 2: 检查支付参数完整性...')
      if (!timeStamp || !nonceStr || !pkg || !paySign) {
        addLog('❌ 支付参数不完整！')
        addLog(`timeStamp: ${!!timeStamp}`)
        addLog(`nonceStr: ${!!nonceStr}`)
        addLog(`package: ${!!pkg}`)
        addLog(`paySign: ${!!paySign}`)
        setLoading(false)
        return
      }
      addLog('✅ 支付参数完整')
      
      // 3. 调用微信支付
      addLog('💳 步骤 3: 调用 Taro.requestPayment...')
      
      try {
        await Taro.requestPayment({
          timeStamp,
          nonceStr,
          package: pkg,
          signType,
          paySign,
          success: (res) => {
            addLog('✅ 支付成功！')
            addLog(`支付结果：${JSON.stringify(res)}`)
            Taro.showToast({
              title: '支付成功',
              icon: 'success'
            })
          },
          fail: (err: any) => {
            addLog('❌ 支付失败！')
            addLog(`错误消息：${err.errMsg}`)
            addLog(`错误代码：${err.errCode}`)
            addLog(`完整错误：${JSON.stringify(err)}`)
            
            Taro.showModal({
              title: '支付失败',
              content: err.errMsg,
              showCancel: false
            })
          }
        })
      } catch (error: any) {
        addLog(`❌ requestPayment 异常：${error.message}`)
      }
      
    } catch (error: any) {
      addLog(`❌ 系统异常：${error.message}`)
      addLog(`错误堆栈：${error.stack}`)
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
  }

  const copyLogs = () => {
    const logText = logs.join('\n')
    Taro.setClipboardData({
      data: logText,
      success: () => {
        Taro.showToast({
          title: '日志已复制',
          icon: 'success'
        })
      }
    })
  }

  return (
    <View className='test-pay-page'>
      <View className='header'>
        <Text className='title'>🧪 支付功能测试</Text>
        <Text className='subtitle'>用于调试 access denied 问题</Text>
      </View>

      {!cloudReady && (
        <View className='cloud-status waiting'>
          <Text>⏳ 云开发初始化中...</Text>
        </View>
      )}

      <View className='actions'>
        <Button 
          type='primary' 
          onClick={testPayment}
          disabled={loading || !cloudReady}
        >
          {loading ? '测试中...' : (!cloudReady ? '等待云开发...' : '开始测试支付')}
        </Button>
        
        <View className='action-buttons'>
          <Button onClick={clearLogs} size='small'>清空日志</Button>
          <Button onClick={copyLogs} size='small'>复制日志</Button>
        </View>
      </View>

      <View className='logs-container'>
        <Text className='logs-title'>📝 执行日志：</Text>
        {logs.length === 0 ? (
          <Text className='empty-tip'>点击"开始测试支付"查看完整流程</Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} className='log-item'>
              <Text className='log-text'>{log}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}
