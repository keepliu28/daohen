# 云开发数据库权限配置指南

## 🔍 问题描述
- **错误代码**：`-502003 database permission denied`
- **现象**：新建笔记时报错，云后端看不到存储记录
- **原因**：数据库集合权限未正确配置

## 🛠️ 配置步骤

### 步骤1：打开微信开发者工具
1. 在微信开发者工具中打开项目
2. 点击左侧菜单栏的"云开发"图标
3. 进入云开发控制台

### 步骤2：配置数据库权限
1. 在云开发控制台选择"数据库"
2. 找到以下两个集合，分别配置权限：

#### `entries` 集合（日记记录）
- **权限设置**："所有用户可读，仅创建者可写"
- **说明**：所有用户可以看到日记列表，但只能修改自己创建的日记

#### `users` 集合（用户资料）
- **权限设置**："所有用户可读，仅创建者可写"
- **说明**：用户资料公开可见，但只能修改自己的资料

### 步骤3：权限配置详情

#### 推荐权限配置
```json
{
  "read": "true",           // 所有用户可读
  "write": "auth.uid != null"  // 仅登录用户可写
}
```

#### 具体操作
1. 点击集合名称进入集合管理
2. 点击"权限设置"
3. 选择"自定义权限"
4. 按照上述配置设置权限

## 🔧 代码优化建议

### 1. 添加权限检查
在数据操作前检查用户登录状态：

```javascript
const saveEntryWithPermissionCheck = async (entry) => {
  const openid = getOpenId();
  if (!openid) {
    Taro.showToast({ title: '请先登录', icon: 'none' });
    return false;
  }
  
  // 确保数据包含 openid 字段
  const entryWithOpenid = {
    ...entry,
    openid: openid
  };
  
  return await saveEntry(entryWithOpenid);
};
```

### 2. 错误处理优化
```javascript
const handleSaveEntry = async (entry) => {
  try {
    const result = await saveEntryWithPermissionCheck(entry);
    if (result) {
      Taro.showToast({ title: '保存成功', icon: 'success' });
    }
  } catch (error) {
    if (error.errCode === -502003) {
      Taro.showModal({
        title: '权限错误',
        content: '请检查数据库权限配置',
        showCancel: false
      });
    } else {
      console.error('保存失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'none' });
    }
  }
};
```

## 📊 权限验证方法

### 1. 测试数据写入
```javascript
// 测试函数
const testDatabaseWrite = async () => {
  try {
    const testEntry = {
      content: '测试数据',
      createTime: new Date().toISOString(),
      openid: getOpenId()
    };
    
    const result = await saveEntry(testEntry);
    console.log('数据库写入测试:', result ? '成功' : '失败');
    return result;
  } catch (error) {
    console.error('数据库写入测试失败:', error);
    return false;
  }
};
```

### 2. 检查权限配置
- 登录云开发控制台
- 查看集合的权限设置
- 确认权限规则正确

## 🚀 立即操作指南

### 快速配置（推荐）
1. **打开微信开发者工具** → **云开发** → **数据库**
2. **找到 `entries` 集合** → **权限设置** → **自定义权限**
3. **设置权限规则**：
   - 读取权限：`true`
   - 写入权限：`auth.uid != null`
4. **同样配置 `users` 集合**

### 验证配置效果
1. 重新编译小程序
2. 登录后尝试新建笔记
3. 检查云开发控制台是否有数据记录

## ⚠️ 常见问题排查

### 问题1：权限配置后仍报错
**解决方案**：
- 检查集合名称是否正确
- 确认用户已登录（有 openid）
- 重启微信开发者工具

### 问题2：数据写入成功但看不到
**解决方案**：
- 检查数据查询条件是否正确
- 确认 openid 字段已正确设置
- 查看云开发控制台的数据列表

### 问题3：权限设置不生效
**解决方案**：
- 等待权限配置生效（可能需要几分钟）
- 清除小程序缓存重新登录
- 检查网络连接

## 📝 最佳实践

### 安全建议
1. **最小权限原则**：只授予必要的权限
2. **数据验证**：服务端验证数据格式
3. **敏感数据保护**：重要数据设置更严格的权限

### 性能优化
1. **索引创建**：为常用查询字段创建索引
2. **分页查询**：避免一次性加载大量数据
3. **缓存策略**：合理使用本地缓存

---

## 🔄 配置完成后的验证步骤

1. ✅ 配置数据库权限
2. ✅ 重新编译小程序
3. ✅ 登录小程序
4. ✅ 新建笔记测试
5. ✅ 检查云开发控制台数据

如果配置正确，您应该能在云开发控制台的 `entries` 集合中看到新建的笔记数据。