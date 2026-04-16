/**
 * 获取云函数 HTTP 触发地址的工具脚本
 * 
 * 使用方法：
 * 1. 在微信开发者工具中打开此文件
 * 2. 右键 → "在开发者工具中运行"
 * 3. 查看控制台输出的完整 URL
 */

const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

// 获取当前云环境信息
async function getCloudFunctionUrl() {
  try {
    const cloudBaseInfo = cloud.getCloudContext();
    
    // 获取环境 ID
    const envId = cloud.getWXContext().ENV_ID || cloudBaseInfo.envId;
    
    // 获取区域信息
    const regionMap = {
      'cn-guangzhou': 'ap-guangzhou',
      'cn-shanghai': 'ap-shanghai',
      'cn-beijing': 'ap-beijing',
      'ap-singapore': 'ap-singapore',
    };
    
    // 从环境变量读取区域
    const region = process.env.TCB_REGION || 'ap-shanghai';
    
    // 构建完整的 HTTP 触发 URL
    const httpUrl = `https://${envId}.env.${region}.tcapi.run/payment-notify`;
    
    console.log('========================================');
    console.log('📍 payment-notify 云函数 HTTP 触发地址');
    console.log('========================================');
    console.log('');
    console.log('完整 URL:');
    console.log(httpUrl);
    console.log('');
    console.log('========================================');
    console.log('📋 使用说明:');
    console.log('1. 复制上面的 URL');
    console.log('2. 填入 payment/index.js 的 NOTIFY_URL');
    console.log('3. 重新部署 payment 云函数');
    console.log('========================================');
    
    return {
      success: true,
      url: httpUrl,
      envId: envId,
      region: region
    };
    
  } catch (error) {
    console.error('❌ 获取 URL 失败:', error);
    console.error('');
    console.error('请尝试以下方法:');
    console.error('1. 确保 payment-notify 已部署成功');
    console.error('2. 确保已创建 HTTP 触发器');
    console.error('3. 在云开发控制台查看触发器详情');
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 导出给云函数调用
exports.main = async (event, context) => {
  return await getCloudFunctionUrl();
};

// 如果是直接运行，立即执行
if (require.main === module) {
  getCloudFunctionUrl();
}
