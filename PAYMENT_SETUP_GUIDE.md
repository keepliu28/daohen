# 微信支付完整配置指南

> 本文档帮助你完成道痕Pro会员微信支付的**完整配置和部署流程**

---

## 📋 前置条件

在开始之前，请确保你已完成以下准备：

- ✅ 已有**微信小程序账号**（AppID: `wx4098138fe5a33e1c`）
- ✅ 已开通**微信云开发**环境
- ✅ 小程序已通过审核并发布（或至少已提交审核）
- ✅ 企业资质（个体户/公司） - **个人小程序无法接入微信支付**

---

## 🔧 第一步：申请微信支付商户号

### 1.1 访问商户平台

👉 **https://pay.weixin.qq.com**

使用管理员微信扫码登录

### 1.2 提交资料

需要准备的资料：
- 营业执照照片
- 法人身份证正反面
- 银行账户信息（对公账户）
- 小程序AppID关联

### 1.3 等待审核

⏱️ 审核时间：通常 **1-3 个工作日**

审核通过后你会收到：
- **商户号 (mch_id)**: 类似 `1234567890` 的10位数字
- **API密钥 (API_KEY)**: 32位字符串（需自行设置）

---

## 📝 第二步：获取API证书（重要！）

### 2.1 登录商户平台

进入 **账户中心 → API安全**

### 2.2 申请API证书

1. 点击「申请API证书」
2. 下载证书工具（`CertificateDownloadTool.exe`）
3. 运行工具生成证书请求文件
4. 上传请求文件到商户平台
5. 下载证书zip包（包含 `apiclient_key.pem` 和 `apiclient_cert.pem`）

### 2.3 记录关键信息

你需要保存以下信息：

```
商户号 (mch_id):          【从商户平台获取】
APIv3密钥 (api_key):      【在API安全页面设置，32位字符串】
证书序列号 (serial_no):    【在证书详情页查看】
商户私钥 (private_key):    【apiclient_key.pem 文件内容】
```

⚠️ **安全警告**：
- 私钥绝对不能泄露或提交到代码仓库！
- 建议使用环境变量存储敏感信息

---

## 💳 第三步：配置云函数环境变量

### 3.1 在微信开发者工具中操作

1. 打开 `cloudfunctions/payment` 文件夹
2. 右键 → **环境变量**
3. 添加以下环境变量：

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `WX_PAY_MCH_ID` | `1234567890` | 商户号 |
| `WX_PAY_API_KEY` | `your32charapikeyhere1234567890` | APIv3密钥 |
| `WX_PAY_SERIAL_NO` | `ABCDEF1234567890ABCDEF1234567890ABCDEF12` | 证书序列号 |
| `WX_PAY_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIE...` | 完整私钥内容（含换行符） |
| `WX_PAY_NOTIFY_URL` | `https://your-domain.com/api/payment/notify` | 支付回调地址 |

### 3.2 特殊处理：PRIVATE_KEY

私钥内容较长且包含换行符，建议：

**方法A：直接粘贴完整内容**
```
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAz7X...（中间省略）...==\n-----END RSA PRIVATE KEY-----
```

**方法B：使用Base64编码后解码**（更安全）

---

## 🗄️ 第四步：创建数据库集合

在**云开发控制台** → **数据库** 中创建以下集合：

### 4.1 订单表 (`orders`)

```javascript
// 集合名称：orders
// 权限设置：所有用户可读，仅创建者和管理员可写

{
  _id: "DH1700000000abc12345",        // 订单ID（自动生成）
  openid: "oXXXXX-xxxxxxxxxxxx",       // 用户openid
  planType: "yearly",                  // 方案类型: monthly | yearly
  durationMonths: 12,                  // 有效月数
  price: 1990,                         // 价格（单位：分）
  status: "pending",                   // 状态: pending → paid → failed
  createTime: Date,                    // 创建时间
  updateTime: Date,                    // 更新时间
  payTime: Date | null,                // 支付时间
  transactionId: "42000012342024010123456789",  // 微信支付交易号
  prepayId: "wx1234567890abcdef..."   // 预支付会话标识
}
```

**权限规则**：
```json
{
  "read": true,
  "write": false  // 仅云函数可写入
}
```

### 4.2 更新 users 表结构

确保 `users` 集合包含以下字段：

```javascript
{
  // ... 其他字段 ...
  isPro: false,                          // 是否Pro会员
  proExpiry: null,                       // Pro到期时间戳（毫秒）
  proActivatedAt: null,                  // Pro激活时间
  activatedByOrderId: null               // 激活订单ID（用于追溯）
}
```

---

## 🚀 第五步：部署云函数

### 5.1 安装依赖

在本地终端执行：

```bash
cd cloudfunctions/payment
npm install
```

### 5.2 上传部署

**方式A：微信开发者工具**
1. 在 `cloudfunctions/payment` 文件夹右键
2. 选择 **「上传并部署：云端安装依赖」**
3. 等待部署完成（约30秒）

**方式B：命令行（如果安装了tcb-tools）**
```bash
tcb fn deploy payment --env your-env-id
```

### 5.3 验证部署成功

在云开发控制台 → 云函数列表中应能看到 `payment` 函数

---

## 🎯 第六步：配置支付回调域名

### 6.1 设置合法域名

登录 [微信公众平台](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → 服务器域名

添加以下域名到 **request合法域名**：

```
https://api.mch.weixin.qq.com     （必须）
https://你的回调域名.com            （如果有自定义回调服务）
```

### 6.2 如果没有自己的服务器

**好消息！** 微信云开发支持**云函数接收支付回调**，无需自建服务器！

当前代码已经采用这种方式，回调处理逻辑在云函数内部完成。

---

## ✅ 第七步：测试支付流程

### 7.1 使用沙箱测试（推荐先测试）

微信支付提供**沙箱环境**用于测试：

1. 登录商户平台 → 产品中心 → 沙箱环境
2. 获取沙箱环境的测试参数
3. 修改云函数中的 `PAYMENT_CONFIG` 为沙箱配置

### 7.2 测试流程检查清单

- [ ] 点击「开通月度Pro」按钮
- [ ] 弹出微信支付确认框（显示金额 ¥1.90）
- [ ] 输入密码/指纹完成支付
- [ ] 显示「🎉 开通成功」提示
- [ ] 页面自动刷新显示「Pro会员」状态
- [ ] 检查数据库 `orders` 集合新增记录
- [ ] 检查数据库 `users` 集合 `isPro=true`

### 7.3 常见问题排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 「当前环境不支持支付」 | 在开发者工具中模拟器运行 | 必须在真机上测试 |
| 「商户号未配置」 | 环境变量未正确设置 | 检查第3步配置 |
| 「签名错误」 | API密钥或私钥错误 | 重新核对证书信息 |
| 「订单不存在」 | 数据库权限问题 | 检查orders集合权限 |

---

## 📦 第八步：正式上线

### 8.1 切换生产环境

修改云函数代码中的注释部分：

```javascript
// payment/index.js 第130行左右
// TODO: 这里需要实际调用微信支付API
// ↓↓↓ 替换为真实调用 ↓↓↓

const axios = require('axios')
const result = await axios.post(
  'https://api.mch.weixin.qq.com/v3/pay/transactions/jsapi',
  params,
  {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `WECHATPAY2-SHA256-RSA2048 ${generateAuthorization(params)}`
    }
  }
)
```

### 8.2 发布新版本

```bash
# 构建生产版本
npm run build:weapp

# 在微信开发者工具中点击「上传」
# 版本号填写：1.5.0（或更高）
# 描述：新增微信支付功能
```

### 8.3 提交审核

在微信公众平台提交审核时，注意：

- **类目选择**: 工具 > 效率 > 记事本
- **功能页面截图**: 包含Pro页面价格展示
- **备注说明**: 说明已接入微信支付V3，符合规范

---

## 🔒 安全注意事项

### ⚠️ 绝对不能做的事：

1. ❌ 将私钥、API密钥提交到 Git 仓库
2. ❌ 在前端代码中硬编码支付参数
3. ❌ 使用 HTTP 明文传输（必须是 HTTPS）
4. ❌ 忽略支付回调验证签名

### ✅ 推荐的安全实践：

1. ✅ 所有支付逻辑放在云函数中
2. ✅ 使用环境变量存储敏感信息
3. ✅ 定期更换 API 密钥
4. ✅ 监控异常订单和支付行为
5. ✅ 设置合理的退款政策并在页面展示

---

## 📞 技术支持

如果在配置过程中遇到问题：

1. **查看日志**: 云开发控制台 → 日志 → 选择payment函数
2. **官方文档**: https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
3. **社区求助**: 微信开放社区 - 微信支付板块
4. **联系我**: 微信号 kanshan28（项目作者）

---

## 📌 快速参考卡片

```
┌─────────────────────────────────────┐
│  道痕支付系统快速参考                 │
├─────────────────────────────────────┤
│  AppID:     wx4098138fe5a33e1c      │
│  商户号:     [待填写]                │
│  月度价格:   ¥1.9  (190分)           │
│  年度价格:   ¥19.9 (1990分)          │
│  回调方式:   云函数内处理              │
│  数据库:     orders + users           │
└─────────────────────────────────────┘
```

---

**最后更新时间**: 2026-04-13  
**适用版本**: v1.5.0+
