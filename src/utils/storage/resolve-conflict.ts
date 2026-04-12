// ---------------------------------------------------------------------------
// resolveConflict — 纯函数，无 Taro 依赖，可在 Node.js 测试环境运行
// ---------------------------------------------------------------------------

export const resolveConflict = (localEntry: any, cloudEntry: any): any => {
  const localTime = localEntry.updateTime || localEntry.createTime;
  const cloudTime = cloudEntry.updateTime || cloudEntry.createTime;
  if (localTime > cloudTime) {
    console.log('[数据同步] 使用本地数据（较新）');
    return { ...cloudEntry, ...localEntry, _id: cloudEntry._id };
  }
  console.log('[数据同步] 使用云端数据（较新）');
  return { ...localEntry, ...cloudEntry, id: cloudEntry._id };
};
