import Taro from '@tarojs/taro';

const STORAGE_KEY = 'DAOHEN_ENTRIES';

export const getEntries = () => {
  return Taro.getStorageSync(STORAGE_KEY) || [];
};

export const saveEntry = (entry) => {
  const entries = getEntries();
  const existingIndex = entries.findIndex(e => e.id === entry.id);
  
  let newEntries;
  if (existingIndex >= 0) {
    // 如果已存在，则更新覆盖
    newEntries = [...entries];
    newEntries[existingIndex] = entry;
  } else {
    // 如果不存在，则插入到最前面
    newEntries = [entry, ...entries];
  }
  
  Taro.setStorageSync(STORAGE_KEY, newEntries);
  return newEntries;
};

export const deleteEntryById = (id) => {
  const entries = getEntries();
  const newEntries = entries.filter(e => e.id !== id);
  Taro.setStorageSync(STORAGE_KEY, newEntries);
  return newEntries;
};
