import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import './index.scss';

export default function DiagnosePay() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useDidShow(() => {
    // 页面显示时自动提示
    Taro.showModal({
      title: '支付诊断工具',
      content: '点击"开始诊断"按钮，将检测微信支付配置是否正确',
      showCancel: false,
    });
  });

  const runDiagnose = async () => {
    setLoading(true);
    setResult(null);

    try {
      console.log('🔍 开始诊断微信支付配置...');

      const res = await Taro.cloud.callFunction({
        name: 'diagnose-pay',
        data: {},
      });

      console.log('📊 诊断结果:', res.result);
      setResult(res.result);

      if (res.result.success) {
        Taro.showModal({
          title: '✅ 诊断成功',
          content: '微信支付配置完全正确！可以正常使用支付功能。',
          showCancel: false,
        });
      } else {
        Taro.showModal({
          title: '❌ 发现问题',
          content: `错误代码：${res.result.errorCode || 'UNKNOWN'}\n\n${res.result.errorMessage || res.result.error}\n\n请根据提示前往商户平台配置！`,
          showCancel: false,
          confirmText: '我知道了',
        });
      }
    } catch (error) {
      console.error('❌ 诊断失败:', error);
      setResult({
        success: false,
        error: error.errMsg || error.message,
      });

      Taro.showModal({
        title: '诊断失败',
        content: error.errMsg || error.message,
        showCancel: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className='diagnose-container'>
      <View className='header'>
        <Text className='title'>🔍 微信支付配置诊断</Text>
        <Text className='subtitle'>检测支付授权目录、商户号绑定等配置</Text>
      </View>

      <View className='content'>
        <Button
          type='primary'
          size='default'
          loading={loading}
          onClick={runDiagnose}
          disabled={loading}
        >
          {loading ? '诊断中...' : '开始诊断'}
        </Button>

        {result && (
          <View className='result'>
            <View className={`status ${result.success ? 'success' : 'error'}`}>
              <Text>{result.success ? '✅ 配置正确' : '❌ 配置错误'}</Text>
            </View>

            {result.success ? (
              <View className='details success-details'>
                <Text>商户号：1744187597 ✅</Text>
                <Text>AppID：wx4098138fe5a33e1c ✅</Text>
                <Text>支付授权目录：已配置 ✅</Text>
                <Text>商户号绑定：正常 ✅</Text>
              </View>
            ) : (
              <View className='details error-details'>
                <Text>错误代码：{result.errorCode || 'UNKNOWN'}</Text>
                <Text>错误信息：</Text>
                <Text className='error-msg'>{result.errorMessage || result.error}</Text>
                
                {result.errorMessage?.includes('access denied') && (
                  <View className='solution'>
                    <Text className='solution-title'>💡 解决方案：</Text>
                    <Text>1. 登录 https://pay.weixin.qq.com</Text>
                    <Text>2. 进入 产品中心 → 开发配置</Text>
                    <Text>3. 找到 JSAPI 支付 → 支付授权目录</Text>
                    <Text>4. 点击"添加"，输入：</Text>
                    <Text className='url'>https://servicewechat.com/wx4098138fe5a33e1c/</Text>
                    <Text>5. 保存后等待 1-2 分钟</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <View className='footer'>
        <Text>诊断完成后，如果配置正确即可正常使用支付功能</Text>
      </View>
    </View>
  );
}
