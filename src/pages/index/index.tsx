import { useState, useEffect, useRef } from 'react'
import { View, Text, Textarea, ScrollView, Input, Picker, MovableArea, MovableView, Image, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getEntries, saveEntry, deleteEntryById, getUserProfile, saveUserProfile, uploadAvatar, autoSync, getUserSubscription, hasPasswordLock, setEntryPassword, verifyEntryPassword, removeEntryPassword } from '../../utils/storage'
import { debounce, throttle, paginateData, PerformanceMonitor } from '../../utils/performance'
import LoginModal from '../../components/LoginModal'
import WechatLogin from '../../components/WechatLogin'
import OfficialWechatLogin from '../../components/OfficialWechatLogin'
import ModernLoginModal from '../../components/ModernLoginModal'
import AppleStyleLogin from '../../components/AppleStyleLogin'
import VirtualList from '../../components/VirtualList'
import LazyImage from '../../components/LazyImage'
import ApplePasscodeModal from '../../components/ApplePasscodeModal'
import { solar2lunar } from '../../utils/lunar'
import './index.scss'

const MOODS = [
  { id: 'happy', icon: '😊', label: '喜悦', color: '#FBBF24' },
  { id: 'neutral', icon: '😐', label: '平静', color: '#9CA3AF' },
  { id: 'sad', icon: '😔', label: '沮丧', color: '#60A5FA' },
  { id: 'angry', icon: '💢', label: '愤怒', color: '#EF4444' },
  { id: 'tired', icon: '😫', label: '疲惫', color: '#6366F1' },
  { id: 'anxious', icon: '😰', label: '焦虑', color: '#F59E0B' },
  { id: 'shame', icon: '😳', label: '羞愧', color: '#A78BFA' }
]

const STEPS = [
  { id: 'fact', label: '事实', icon: '📝', placeholder: '发生了什么？（客观描述）', examples: [
    '今天[时间]，在[地点]，[谁]做了[什么事]',
    '我原本计划[做某事]，但实际发生了[某事]',
    '我看到/听到[具体客观事实]，没有加任何个人评判',
    '当[触发事件]发生时，我正处于[什么状态]'
  ] },
  { id: 'reaction', label: '反应', icon: '⚡', placeholder: '那一刻你的第一反应是？', examples: [
    '那一刻，我感到[情绪，如愤怒/委屈/焦虑]',
    '我的身体反应是[心跳加速/手心出汗/大脑空白]',
    '我脑海里闪过的第一个念头是[具体想法]',
    '我下意识的动作是[逃避/反驳/沉默]'
  ] },
  { id: 'greed', label: '贪', icon: '🍎', placeholder: '你当时想要得到什么？', examples: [
    '我其实非常渴望得到[认可/关注/控制权/安全感]',
    '我希望事情能完全按照[我的预期]发展',
    '我想要证明[我是对的/我有价值/我比别人强]',
    '我期待对方能[主动道歉/理解我/满足我的需求]'
  ] },
  { id: 'fear_step', label: '惧', icon: '🌊', placeholder: '你害怕失去什么？', examples: [
    '我害怕失去[面子/关系/机会/金钱/地位]',
    '我担心别人会觉得我[不够好/无能/自私/软弱]',
    '我恐惧面对[失败/冲突/被拒绝/不确定性]',
    '我害怕一旦[某种情况发生]，我就会[某种糟糕后果]'
  ] },
  { id: 'excuse', label: '障', icon: '🌫️', placeholder: '你为自己找了什么借口？', examples: [
    '我告诉自己，这都是因为[外部环境/别人的错]',
    '我找借口说，我现在[太累/没时间/没准备好]',
    '我认为，如果[某条件满足]，我就不会这样了',
    '我试图合理化：[大家都这样/这很正常/没办法]'
  ] },
  { id: 'stone', label: '石', icon: '💎', placeholder: '提炼核心：这块“石头”是什么？', examples: [
    '我发现自己总是陷入[某种固定模式/循环]',
    '我的核心执念是[必须完美/不能输/需要被爱]',
    '我习惯用[某种行为]来掩饰内心的[某种脆弱]',
    '我把自我价值建立在了[外界评价/物质/成就]上'
  ] },
  { id: 'choice', label: '选', icon: '⚖️', placeholder: '如果明天遇到同样的事我应该怎么选？', examples: [
    '下次再遇到，我会先[深呼吸/暂停]，然后[具体行动]',
    '我选择放下[某种执念]，接受[某种现实]',
    '我会把注意力集中在[我能改变的事情]上，而不是[不可控的]',
    '我决定主动[沟通/道歉/承担责任]，表达真实的[感受/需求]'
  ] }
]

const PAGE_LIMIT = 10; // 每页加载 10 条数据

export default function Index() {
  const [view, setView] = useState('home')
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [entries, setEntries] = useState<any[]>([])
  const [isDiving, setIsDiving] = useState(false)
  const [currentStep, setCurrentStep] = useState(-1)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [formData, setFormData] = useState<any>({ mood: 'neutral', customMood: '', tags: '', fact: '', reaction: '', greed: '', fear_step: '', excuse: '', stone: '', choice: '' })
  const [isCustomMood, setIsCustomMood] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [historyTags, setHistoryTags] = useState<string[]>([])
  const [selectedMoodFilter, setSelectedMoodFilter] = useState<string | null>(null)
  const [detailMood, setDetailMood] = useState<string | null>(null)
  const [spherePositions, setSpherePositions] = useState<Record<string, any>>({})
  const [viewMonth, setViewMonth] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 })
  const [calendarMode, setCalendarMode] = useState<'month' | 'year'>('month')
  const [selectedDate, setSelectedDate] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() })

  const [sysInfo, setSysInfo] = useState({ windowWidth: 375, windowHeight: 812 })
  const [userProfile, setUserProfile] = useState<any>(null)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showWechatLogin, setShowWechatLogin] = useState(false)
  const [showOfficialLogin, setShowOfficialLogin] = useState(false)
  const [tempAvatarUrl, setTempAvatarUrl] = useState("")
  const [tempNickName, setTempNickName] = useState("")
  
  // 密码锁相关状态
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordModalType, setPasswordModalType] = useState<'set' | 'verify'>('set')
  const [pendingLockAction, setPendingLockAction] = useState<'lock' | 'unlock' | null>(null)
  
  // 性能优化状态
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreData, setHasMoreData] = useState(true)

  const fetchEntries = async (currentOffset: number, currentEntries: any[]) => {
    if (!hasMore) return; // 没有更多数据时不再请求

    const newEntries = await getEntries(PAGE_LIMIT, currentOffset);
    if (newEntries.length < PAGE_LIMIT) {
      setHasMore(false);
    }
    const updatedEntries = [...currentEntries, ...newEntries];
    setEntries(updatedEntries);
    setOffset(currentOffset + newEntries.length);

    const tags = Array.from(new Set(updatedEntries.flatMap((e: any) => e.tags ? e.tags.split(/[#\s,，]+/).filter(Boolean) : []))).slice(0, 10);
    setHistoryTags(tags as string[]);

    // 同步计算 spherePositions（移除 Worker 依赖）
    const positions = calculateSpherePositionsSync(updatedEntries, sysInfo.windowWidth, sysInfo.windowHeight * 0.65);
    setSpherePositions(positions);
  };

  // 同步计算球体位置（替代 Worker）
  const calculateSpherePositionsSync = (entries: any[], containerW: number, containerH: number) => {
    const aggregatedMoods = getAggregatedMoods(entries);
    const positions: { [key: string]: { x: number; y: number; size: number } } = {};
    
    if (aggregatedMoods.length === 0) return positions;
    
    const centerX = containerW / 2;
    const centerY = containerH / 2;
    const maxRadius = Math.min(containerW, containerH) * 0.3;
    
    aggregatedMoods.forEach((mood, index) => {
      const angle = (index / aggregatedMoods.length) * 2 * Math.PI;
      const radius = maxRadius * (0.5 + Math.random() * 0.5);
      
      positions[mood.id] = {
        x: centerX + radius * Math.cos(angle) - 50,
        y: centerY + radius * Math.sin(angle) - 50,
        size: 80 + (mood.count * 5)
      };
    });
    
    return positions;
  };

  useDidShow(() => {
    const perfMonitor = PerformanceMonitor.getInstance();
    perfMonitor.startMeasure('app_show');
    
    const info = Taro.getSystemInfoSync();
    setSysInfo(info);

    Taro.onKeyboardHeightChange(res => {
      setKeyboardHeight(res.height);
    });

    // 自动同步数据
    autoSync().then(result => {
      if (result.success && !result.skipped) {
        console.log('[自动同步] 同步完成');
      }
    });

    // 检查用户资料（同步调用）
    const profile = getUserProfile();
    if (profile) {
      setUserProfile(profile);
    } else {
      // 如果没有用户资料，显示官方微信登录（统一使用官方组件）
      setShowOfficialLogin(true);
    }

    // 使用防抖加载数据
    const loadData = debounce(async () => {
      // 首次加载数据
      if (entries.length === 0 && hasMore) {
        await fetchEntries(0, entries); // Pass current entries for initial load
      }
      perfMonitor.endMeasure('app_show');
    }, 300);
    
    loadData();
  });
  const triggerVibrate = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    Taro.vibrateShort({ type })
  }

  const resetForm = () => {
    setFormData({ mood: 'neutral', customMood: '', tags: '', fact: '', reaction: '', greed: '', fear_step: '', excuse: '', stone: '', choice: '' })
    setCurrentStep(-1)
    setIsDiving(false)
    setIsCustomMood(false)
  }

  const handleStart = async () => {
    // 检查用户是否登录
    const openid = Taro.getStorageSync('openid');
    if (!openid) {
      Taro.showModal({
        title: '提示',
        content: '请先登录再开始深潜',
        confirmText: '去登录',
        confirmColor: '#07C160',
        success: (res) => {
          if (res.confirm) {
            // 打开登录界面
            setShowOfficialLogin(true);
            triggerVibrate('light');
          }
        }
      });
      return;
    }
    
    if (isCustomMood && !formData.customMood.trim()) {
      Taro.showToast({ title: '请输入心情', icon: 'none' })
      return
    }
    
    // 自动生成初始草稿
    const newEntry = { ...formData, id: formData.id || Date.now().toString(), createdAt: formData.createdAt || new Date().toISOString() }
    setFormData(newEntry)
    const updated = await saveEntry(newEntry)
    setEntries(updated)
    
    setIsDiving(true)
    setCurrentStep(0)
    triggerVibrate('medium')
  }

  const handleNext = async () => {
    if (!formData[STEPS[currentStep].id]?.trim()) return
    
    // 每做完一步，自动静默保存草稿
    const newEntry = { ...formData, id: formData.id || Date.now().toString(), createdAt: formData.createdAt || new Date().toISOString() }
    setFormData(newEntry)
    const updated = await saveEntry(newEntry)
    setEntries(updated)
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
      triggerVibrate('light')
    } else {
      handleSave()
    }
  }

  const handleSaveDraft = async () => {
    const newEntry = { ...formData, id: formData.id || Date.now().toString(), createdAt: formData.createdAt || new Date().toISOString() }
    const updated = await saveEntry(newEntry)
    setEntries(updated)
    setView('home')
    resetForm()
    Taro.showToast({ title: '已存为草稿', icon: 'none' })
    triggerVibrate('light')
  }

  const handleChooseAvatar = async (e: any) => {
    const { avatarUrl } = e.detail
    setTempAvatarUrl(avatarUrl)
  }

  // 获取聚合心情数据（包含标准心情和自定义心情）
  const getAggregatedMoods = (entries: any[]) => {
    const moodCounts: { [key: string]: number } = {};
    const moodCustomData: { [key: string]: { icon?: string; label?: string; color?: string } } = {};
    
    // 统计所有心情（包括自定义）
    entries.forEach(entry => {
      if (entry.mood) {
        // 如果是自定义心情，使用实际的标签作为 key
        const moodKey = entry.mood === 'custom' 
          ? `custom_${entry.moodLabel || entry.customMood || 'unknown'}` 
          : entry.mood;
        
        moodCounts[moodKey] = (moodCounts[moodKey] || 0) + 1;
        
        // 保存自定义心情的元数据
        if (entry.mood === 'custom' && entry.moodEmoji) {
          moodCustomData[moodKey] = {
            icon: entry.moodEmoji,
            label: entry.moodLabel || entry.customMood,
            color: entry.moodColor || '#9CA3AF'
          };
        }
      }
    });

    // 构建结果：先标准心情，再自定义心情
    let result = MOODS.map(mood => ({
      id: mood.id,
      icon: mood.icon,
      label: mood.label,
      color: mood.color,
      count: moodCounts[mood.id] || 0
    })).filter(mood => mood.count > 0);
    
    // 添加自定义心情
    Object.keys(moodCounts).forEach(moodKey => {
      // 如果不是标准心情，则添加自定义心情
      if (!MOODS.find(m => m.id === moodKey) && moodKey.startsWith('custom_')) {
        const customData = moodCustomData[moodKey] || {};
        // 从 key 中提取实际的心情名称
        const actualLabel = moodKey.replace('custom_', '');
        
        result.push({
          id: moodKey,
          icon: '🎨',  // 统一使用调色板图标
          label: actualLabel,
          color: customData.color || '#9CA3AF',
          count: moodCounts[moodKey]
        });
      }
    });
    
    // 按数量排序
    result.sort((a, b) => b.count - a.count);
    
    return result;
  };

  // 微信登录成功处理
  const handleWechatLoginSuccess = (userInfo: any) => {
    // 自动使用微信的头像和昵称
    const profile = {
      avatarUrl: userInfo.avatarUrl || '',
      nickName: userInfo.nickName || '',
      ...userInfo
    };
    setUserProfile(profile);
    setShowWechatLogin(false);
    Taro.showToast({ title: '登录成功', icon: 'success' });
  };

  // 官方微信登录成功处理
  const handleOfficialLoginSuccess = (userInfo: any) => {
    setUserProfile(userInfo);
    setShowOfficialLogin(false);
    Taro.showToast({ title: '登录成功', icon: 'success' });
    // 刷新数据
    if (entries.length === 0 && hasMore) {
      fetchEntries(0, []);
    }
  };

  // 加载更多数据
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreData) return;
    
    setIsLoadingMore(true);
    
    try {
      const nextPage = currentPage + 1;
      const paginated = paginateData(entries, nextPage, pageSize);
      
      if (paginated.data.length > 0) {
        setCurrentPage(nextPage);
        setHasMoreData(paginated.hasMore);
      }
    } catch (error) {
      console.error('[加载更多] 失败:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!tempAvatarUrl || !tempNickName) {
      Taro.showToast({ title: '请完善头像和昵称', icon: 'none' })
      return
    }
    Taro.showLoading({ title: '保存中...' })
    try {
      let finalAvatarUrl = tempAvatarUrl
      if (tempAvatarUrl.startsWith('http://tmp/') || tempAvatarUrl.startsWith('wxfile://')) {
        const fileID = await uploadAvatar(tempAvatarUrl)
        if (fileID) finalAvatarUrl = fileID
      }
      const profile = { avatarUrl: finalAvatarUrl, nickName: tempNickName }
      const success = await saveUserProfile(profile)
      if (success) {
        setUserProfile(profile)
        setShowLoginModal(false)
        Taro.showToast({ title: '保存成功', icon: 'success' })
      } else {
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    } catch (e) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }
  const handleSave = async () => {
    const newEntry = { ...formData, id: formData.id || Date.now().toString(), createdAt: formData.createdAt || new Date().toISOString() }
    const updated = await saveEntry(newEntry)
    setEntries(updated)
    setView('home')
    resetForm()
    Taro.showToast({ title: '道痕已存', icon: 'success' })
    triggerVibrate('heavy')
  }

  const handleTagClick = (tag: string) => {
    const currentTags = formData.tags.split(/[#\s,，]+/).filter(Boolean)
    if (!currentTags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags ? `${formData.tags} #${tag}` : `#${tag}` })
      triggerVibrate('light')
    }
  }

  const handleBack = () => {
    triggerVibrate('light')
    if (view === 'mood-detail') setView('mood')
    else setView('home')
  }

  const handleMoodView = async () => {
    triggerVibrate('light')
    // 检查 Pro 权限
    const subscription = await getUserSubscription()
    if (subscription.isPro) {
      // Pro 用户，跳转到心情印记页面
      Taro.navigateTo({
        url: '/pages/mood-memories/index'
      })
    } else {
      // 非 Pro 用户，显示升级提示
      Taro.showModal({
        title: 'Pro 功能',
        content: '心情印记是 Pro 会员专属功能，升级后可探索情绪背后的真实需求与成长轨迹。',
        confirmText: '了解 Pro',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: '/pages/pro/index' })
          }
        }
      })
    }
  }

  const handleBottomMoodView = async () => {
    triggerVibrate('light')
    // 检查 Pro 权限
    const subscription = await getUserSubscription()
    if (subscription.isPro) {
      // Pro 用户，跳转到心情印记页面
      Taro.navigateTo({
        url: '/pages/mood-memories/index'
      })
    } else {
      // 非 Pro 用户，显示升级提示
      Taro.showModal({
        title: 'Pro 功能',
        content: '心情印记是 Pro 会员专属功能，升级后可探索情绪背后的真实需求与成长轨迹。',
        confirmText: '了解 Pro',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            Taro.navigateTo({ url: '/pages/pro/index' })
          }
        }
      })
    }
  }

  const handleEdit = () => {
    if (selectedEntry.isLocked) {
      Taro.showToast({ title: '请先解锁', icon: 'none' });
      triggerVibrate('light');
      return;
    }
    setFormData(selectedEntry);
    const nextStep = STEPS.findIndex(s => !selectedEntry[s.id]);
    setCurrentStep(nextStep !== -1 ? nextStep : 0);
    setIsDiving(true);
    setView('new');
    triggerVibrate('medium');
  }

  const handleToggleLock = async () => {
    triggerVibrate('light');
    
    // 检查用户是否订阅 Pro
    const subscription = await getUserSubscription();
    
    if (!selectedEntry.isLocked) {
      // 上锁操作
      if (!subscription.isPro) {
        // 非 Pro 用户，提示升级
        Taro.showModal({
          title: 'Pro 功能',
          content: '3 位数字密码锁是 Pro 会员专属功能，升级后可保护您的私密记录。',
          confirmText: '了解 Pro',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              Taro.navigateTo({ url: '/pages/pro/index' });
            }
          }
        });
        return;
      }
      
      // Pro 用户，显示密码设置框
      setPasswordModalType('set');
      setPendingLockAction('lock');
      setShowPasswordModal(true);
    } else {
      // 解锁操作
      const hasLock = hasPasswordLock(selectedEntry.id);
      if (hasLock) {
        // 需要验证密码
        setPasswordModalType('verify');
        setPendingLockAction('unlock');
        setShowPasswordModal(true);
      } else {
        // 没有密码，直接解锁
        const updatedEntry = { ...selectedEntry, isLocked: false };
        const updatedList = await saveEntry(updatedEntry);
        setSelectedEntry(updatedEntry);
        setEntries(updatedList);
        triggerVibrate('light');
        Taro.showToast({ title: '已解锁', icon: 'success' });
      }
    }
  }

  const handlePasswordConfirm = async (password: string) => {
    if (!selectedEntry) return;
    
    if (passwordModalType === 'set') {
      // 设置密码
      const success = await setEntryPassword(selectedEntry.id, password);
      if (success) {
        // 设置密码后上锁
        const updatedEntry = { ...selectedEntry, isLocked: true };
        const updatedList = await saveEntry(updatedEntry);
        setSelectedEntry(updatedEntry);
        setEntries(updatedList);
        setShowPasswordModal(false);
        setPendingLockAction(null);
        triggerVibrate('medium');
        Taro.showToast({ title: '已上锁', icon: 'success' });
      } else {
        Taro.showToast({ title: '设置失败，请重试', icon: 'none' });
      }
    } else if (passwordModalType === 'verify') {
      // 验证密码
      const verified = await verifyEntryPassword(selectedEntry.id, password);
      if (verified) {
        if (pendingLockAction === 'unlock') {
          // 解锁
          const updatedEntry = { ...selectedEntry, isLocked: false };
          const updatedList = await saveEntry(updatedEntry);
          setSelectedEntry(updatedEntry);
          setEntries(updatedList);
          triggerVibrate('light');
          Taro.showToast({ title: '已解锁', icon: 'success' });
        }
        setShowPasswordModal(false);
        setPendingLockAction(null);
      } else {
        Taro.showToast({ title: '密码错误', icon: 'none' });
      }
    }
  }

  const handleDelete = () => {
    if (selectedEntry.isLocked) {
      Taro.showToast({ title: '请先解锁', icon: 'none' });
      triggerVibrate('light');
      return;
    }
    Taro.showModal({
      title: '删除道痕',
      content: '确定要删除这条记录吗？此操作不可恢复。',
      confirmColor: '#FF3B30',
      success: async function (res) {
        if (res.confirm) {
          const updatedList = await deleteEntryById(selectedEntry.id);
          setEntries(updatedList);
          setView('home');
          setSelectedEntry(null);
          triggerVibrate('medium');
          Taro.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }

  const renderList = () => {
    let filtered = entries
    if (isSearchMode && searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      filtered = entries.filter(e => e.fact?.toLowerCase().includes(kw) || e.stone?.toLowerCase().includes(kw) || e.tags?.toLowerCase().includes(kw))
    } else if (view === 'home') {
      const todayStr = new Date().toDateString()
      filtered = entries.filter(e => (new Date(e.createdAt).toDateString() === todayStr) || (!e.stone || !e.choice))
    } else if (view === 'calendar') {
      filtered = entries.filter(e => {
        const d = new Date(e.createdAt)
        return d.getFullYear() === selectedDate.year && (d.getMonth() + 1) === selectedDate.month && d.getDate() === selectedDate.day
      })
    } else if (view === 'mood' || view === 'mood-detail') {
      const targetMood = view === 'mood' ? selectedMoodFilter : detailMood
      if (targetMood) {
        filtered = entries.filter(e => targetMood.startsWith('custom_') ? (e.mood === 'custom' && e.customMood === targetMood.replace('custom_', '')) : (e.mood === targetMood))
      }
    }

    return (
      <View className='entry-list'>
        {filtered.sort((a, b) => Number(b.id) - Number(a.id)).map(entry => {
          const isDraft = !entry.stone || !entry.choice;
          return (
            <View key={entry.id} className='entry-card animate-fade-in' onClick={() => { setSelectedEntry(entry); setView('detail'); triggerVibrate('light'); }}>
              <View className='entry-card-header'>
                <View className='title-group'>
                  <Text className='entry-card-title'>
                    {entry.isLocked ? '🔒 ' : ''}
                    {isDraft ? '无名之石' : (entry.stone || '无名之石')}
                  </Text>
                  <View className='meta-group'>
                    {isDraft && <Text className='status-tag draft'>📝 草稿</Text>}
                    <Text className='entry-card-time'>{new Date(entry.createdAt).getMonth() + 1}月{new Date(entry.createdAt).getDate()}日</Text>

                  </View>
                </View>
              </View>
              <View className='entry-card-body'>
                <Text className={`entry-card-fact ${entry.isLocked ? 'locked-text' : ''}`}>
                  {entry.isLocked ? '内容已上锁，点击查看' : entry.fact}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  const firstDay = new Date(viewMonth.year, viewMonth.month - 1, 1).getDay()
  const daysInMonth = new Date(viewMonth.year, viewMonth.month, 0).getDate()
  const calendarCells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const daysWithEntries = new Set(entries.filter(e => { const d = new Date(e.createdAt); return d.getFullYear() === viewMonth.year && (d.getMonth() + 1) === viewMonth.month; }).map(e => new Date(e.createdAt).getDate()))
  const monthsWithEntries = new Set(entries.filter(e => new Date(e.createdAt).getFullYear() === viewMonth.year).map(e => new Date(e.createdAt).getMonth() + 1))

  return (
    <View className='app-container'>
      {/* 侧边栏抽屉 */}
      <View className={`drawer-overlay ${isDrawerOpen ? 'show' : ''}`} onClick={() => setIsDrawerOpen(false)} />
      <View className={`drawer-content ${isDrawerOpen ? 'show' : ''}`}>
        <View className='drawer-profile'><View className='avatar-circle'><Text>🧑</Text></View><Text className='profile-name'>道痕行者</Text></View>
        <View className='drawer-menu'>
          <View className='menu-item' onClick={() => { setView('home'); setIsDrawerOpen(false); triggerVibrate('light'); }}><Text>🏠 首页</Text></View>
          <View className='menu-item' onClick={() => { setView('calendar'); setIsDrawerOpen(false); triggerVibrate('light'); }}><Text>📅 日历</Text></View>
        </View>
      </View>

      {/* 顶部导航 */}
      {(view === 'home' || view === 'calendar' || view === 'mood' || view === 'mood-detail') && (
        <View className='top-header'>
          {!isSearchMode ? (
            <><View className='user-avatar-btn' onClick={() => { 
              if (userProfile) {
                setShowLoginModal(true); 
                triggerVibrate('light'); 
              } else {
                // 未登录时使用官方微信登录
                setShowOfficialLogin(true);
                triggerVibrate('light');
              }
            }}>{userProfile ? <Image src={userProfile.avatarUrl} className='avatar-img' /> : <View className='avatar-placeholder'>👤</View>}</View>
              <View className='right-icons'>
                <View className='icon-btn pro-icon-btn' onClick={() => { Taro.navigateTo({ url: '/pages/pro/index' }); triggerVibrate('light'); }}>
                  <Text>⭐</Text>
                </View>
                <View className='icon-btn' onClick={handleMoodView}><Text>🔮</Text></View>
                <View className='icon-btn' onClick={() => { setIsSearchMode(true); triggerVibrate('light'); }}><Text>🔍</Text></View>
              </View></>
          ) : (
            <View className='search-bar-container animate-fade-in'><View className='search-input-wrapper'><Text className='search-icon'>🔍</Text><Input className='search-input-main' placeholder='搜索道痕...' value={searchKeyword} onInput={(e) => setSearchKeyword(e.detail.value)} autoFocus /></View><Text className='search-cancel-btn' onClick={() => { setIsSearchMode(false); setSearchKeyword(''); triggerVibrate('light'); }}>取消</Text></View>
          )}
        </View>
      )}

      {isDiving && (
        <View className='write-header' style={{ display: 'none' }}></View>
      )}

      <ScrollView scrollY className='content-scroll'>
        {view === 'home' && (
          <View className='view-container animate-fade-in'>
             <View className='giant-date-section'><Text className='giant-day'>{new Date().getDate()}</Text><Text className='sub-date'>{new Date().getMonth() + 1}月 | 今天</Text></View>
             {renderList()}
          </View>
        )}

        {view === 'mood' && (
          <View className='view-container animate-fade-in no-padding'>
            <View className='mood-view-header'><Text className='mood-view-title'>心情印记</Text></View>
            <MovableArea className='mood-sphere-container'>
              {getAggregatedMoods(entries).sort((a, b) => b.count - a.count).map((mood, i) => {
                const pos = spherePositions[mood.id] || { x: 0, y: 0, size: 100 }
                return (
                  <MovableView 
                    key={mood.id} 
                    className='mood-sphere-wrapper' 
                    x={pos.x} 
                    y={pos.y} 
                    direction='all' 
                    animation={false}
                    style={{ width: `${pos.size}px`, height: `${pos.size}px`, zIndex: 100 - i }}
                  >
                    <View 
                      className='mood-sphere' 
                      style={{ animationDelay: `${i * 0.2}s`, background: mood.color }} 
                      onClick={() => { setDetailMood(mood.id); setView('mood-detail'); triggerVibrate('medium'); }}
                    >
                      <Text className='mood-sphere-icon' style={{ fontSize: `${pos.size * 0.3}px` }}>{mood.icon}</Text>
                      <Text className='mood-sphere-label' style={{ fontSize: `${Math.max(12, pos.size * 0.12)}px` }}>{mood.label}</Text>
                      <Text className='mood-sphere-count' style={{ fontSize: `${Math.max(10, pos.size * 0.1)}px` }}>{mood.count} 条</Text>
                    </View>
                  </MovableView>
                )
              })}
            </MovableArea>
          </View>
        )}

        {view === 'calendar' && (
          <View className='view-container animate-fade-in'>
             <View className='calendar-section'>
               <View className='calendar-header'>
                 <Text onClick={() => setViewMonth({ ...viewMonth, month: viewMonth.month === 1 ? 12 : viewMonth.month - 1, year: viewMonth.month === 1 ? viewMonth.year - 1 : viewMonth.year })}>◀</Text>
                 <Text className='calendar-title' onClick={() => setCalendarMode(calendarMode === 'month' ? 'year' : 'month')}>{calendarMode === 'month' ? `${viewMonth.year}年${viewMonth.month}月` : `${viewMonth.year}年`}</Text>
                 <Text onClick={() => setViewMonth({ ...viewMonth, month: viewMonth.month === 12 ? 1 : viewMonth.month + 1, year: viewMonth.month === 12 ? viewMonth.year + 1 : viewMonth.year })}>▶</Text>
               </View>
               {calendarMode === 'month' ? (
                 <><View className='calendar-week-header'>{['日', '一', '二', '三', '四', '五', '六'].map(day => (<Text key={day} className='week-day'>{day}</Text>))}</View><View className='calendar-grid'>
                   {calendarCells.map((day, i) => day ? (
                     <View key={day} className={`calendar-day ${day === selectedDate.day && viewMonth.month === selectedDate.month ? 'selected' : ''}`} onClick={() => { setSelectedDate({ ...selectedDate, day, month: viewMonth.month, year: viewMonth.year }); triggerVibrate('light'); }}>
                       <Text className='day-num'>{day}</Text>
                       {(() => {
                         const lunar = solar2lunar(viewMonth.year, viewMonth.month, day)
                         const festival = lunar.dayText === '初一' ? lunar.monthText : lunar.dayText
                         return <Text className='day-lunar'>{festival}</Text>
                       })()}
                       {daysWithEntries.has(day) && <View className='entry-dot' />}
                     </View>
                   ) : <View key={i} className='calendar-day empty' />)}
                 </View></>
               ) : (
                 <View className='year-grid'>
                   {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                     <View key={m} className={`month-cell ${m === viewMonth.month ? 'current-month' : ''}`} onClick={() => { setViewMonth({ ...viewMonth, month: m }); setCalendarMode('month'); triggerVibrate('medium'); }}>
                       <Text>{m}月</Text>
                       {monthsWithEntries.has(m) && <View className='month-entry-dot' />}
                     </View>
                   ))}
                 </View>
               )}
             </View>
             {renderList()}
          </View>
        )}

        {view === 'new' && (
          <View className='view-container animate-fade-in'>
            {currentStep === -1 ? (
              <View className='wizard-start-v2'>
                <View className='new-header-v2'><Text className='main-title-v2'>记录此刻</Text><Text className='sub-title-v2'>捕捉当下的道痕，开启深潜之旅</Text></View>
                <View className='main-card-v2'>
                  <Text className='section-label'>当前心情</Text>
                  <View className='mood-grid-v2'>
                    {MOODS.map(m => (
                      <View key={m.id} className={`mood-item-v2 ${formData.mood === m.id && !isCustomMood ? 'selected' : ''}`} onClick={() => { setFormData({...formData, mood: m.id}); setIsCustomMood(false); triggerVibrate('light'); }}>
                        <View className='mood-icon-bg' style={formData.mood === m.id && !isCustomMood ? { background: m.color, boxShadow: `0 8px 20px ${m.color}40` } : {}}><Text>{m.icon}</Text></View>
                        <Text className='mood-label-v2' style={formData.mood === m.id && !isCustomMood ? { color: m.color } : {}}>{m.label}</Text>
                      </View>
                    ))}
                    <View className={`mood-item-v2 ${isCustomMood ? 'selected' : ''}`} onClick={() => { setIsCustomMood(true); setFormData({...formData, mood: 'custom'}); triggerVibrate('light'); }}>
                      <View className='mood-icon-bg' style={isCustomMood ? { background: '#1C1C1E', boxShadow: '0 8px 20px rgba(0,0,0,0.2)' } : {}}><Text>✨</Text></View>
                      <Text className='mood-label-v2' style={isCustomMood ? { color: '#1C1C1E' } : {}}>自定义</Text>
                    </View>
                  </View>
                  {isCustomMood && <Input className='custom-mood-input-v2' placeholder='输入此刻的心情...' value={formData.customMood} onInput={(e) => setFormData({...formData, customMood: e.detail.value})} />}
                  <View className='tag-input-wrapper-v2'><Text className='tag-icon-v2'>#</Text><Input className='tag-input-v2' placeholder='添加标签 (可选)' value={formData.tags} onInput={(e) => setFormData({...formData, tags: e.detail.value})} /></View>
                  {historyTags.length > 0 && (
                    <View className='history-tags-container'><Text className='history-label'>常用：</Text><ScrollView scrollX className='history-tags-scroll'>{historyTags.map(tag => (<Text key={tag} className='history-tag-pill' onClick={() => handleTagClick(tag)}>{tag}</Text>))}</ScrollView></View>
                  )}
                </View>
                <View className='action-group-v2'><View className='start-btn-v2' onClick={handleStart}><Text>开始深潜</Text></View></View>
              </View>
            ) : (
              <View className='diving-container-v3' style={{ bottom: keyboardHeight > 0 ? keyboardHeight + 'px' : '0px' }}>
                {/* 顶部进度条 */}
                <View className='diving-progress-bar'>
                  {STEPS.map((_, idx) => (
                    <View key={idx} className={`progress-segment ${idx <= currentStep ? 'active' : ''}`} />
                  ))}
                </View>
                
                {/* 沉浸式头部 */}
                <View className='diving-header-v3'>
                  {currentStep > 0 ? (
                    <Text className='w-btn-cancel' onClick={() => { setCurrentStep(currentStep - 1); triggerVibrate('light'); }}>❮ 上一步</Text>
                  ) : (
                    <Text className='w-btn-cancel' onClick={handleSaveDraft}>退出</Text>
                  )}
                  <Text className='w-step-count'>{currentStep + 1} / {STEPS.length}</Text>
                  <Text className='w-btn-done' onClick={handleSaveDraft}>存草稿</Text>
                </View>

                {/* 核心输入区 */}
                <View className='diving-body-v3'>
                  <View className='diving-title-row'>
                    <Text className='diving-huge-title'>{STEPS[currentStep].label}</Text>
                    <Text className='diving-subtitle-inline'>（{STEPS[currentStep].placeholder}）</Text>
                  </View>
                  
                  {/* 灵感启发卡片 */}
                  {STEPS[currentStep].examples && STEPS[currentStep].examples.length > 0 && keyboardHeight === 0 && (
                    <View className='inspiration-section animate-slide-up'>
                      <Text className='inspiration-label'>💡 灵感启发</Text>
                      <ScrollView scrollX className='inspiration-scroll'>
                        {STEPS[currentStep].examples.map((ex, i) => (
                          <View key={i} className='inspiration-chip' onClick={() => { setFormData({...formData, [STEPS[currentStep].id]: ex}); triggerVibrate('light'); }}>
                            <Text>{ex}</Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <Textarea 
                    className='diving-textarea-v3' 
                    placeholder='在此输入...' 
                    placeholderClass='diving-placeholder'
                    value={formData[STEPS[currentStep].id]} 
                    onInput={(e) => setFormData({...formData, [STEPS[currentStep].id]: e.detail.value})} 
                    onFocus={(e) => setKeyboardHeight(e.detail.height || 0)}
                    onBlur={() => setKeyboardHeight(0)}
                    autoFocus 
                    maxlength={-1}
                    cursorSpacing={20}
                    adjustPosition={false}
                    showConfirmBar={false}
                  />
                </View>

                {/* 底部悬浮操作 */}
                <View className='diving-footer-v3' style={{ paddingBottom: keyboardHeight > 0 ? "12px" : "" }}>
                  <View className={`next-fab-v3 ${formData[STEPS[currentStep].id]?.trim() ? 'active' : ''}`} onClick={handleNext}>
                    <Text>{currentStep === STEPS.length - 1 ? '完成深潜' : '下一步'}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {view === 'detail' && selectedEntry && (
          <View className='view-container animate-fade-in'>
            <View className='detail-header'><Text className='detail-title'>道痕详情</Text></View>
            <View className='detail-card'>
              <View className='detail-card-title'>
                {selectedEntry.isLocked ? '🔒 ' : ''}
                {selectedEntry.stone || '无名之石'}
              </View>
              <View className='detail-card-fact'>{selectedEntry.fact}</View>
              {STEPS.slice(1).map(step => selectedEntry[step.id] && (
                <View key={step.id} className='detail-step-item'><Text className='d-step-label'>{step.label}</Text><Text>{selectedEntry[step.id]}</Text></View>
              ))}
            </View>
            
            {/* 详情页操作栏 */}
            <View className='detail-actions-bar'>
              <View className={`action-btn ${selectedEntry.isLocked ? 'disabled' : ''}`} onClick={handleEdit}>
                <Text className='action-icon'>✏️</Text>
                <Text className='action-text'>{(!selectedEntry.stone || !selectedEntry.choice) ? '继续深潜' : '编辑'}</Text>
              </View>
              <View className='action-btn' onClick={handleToggleLock}>
                <Text className='action-icon'>{selectedEntry.isLocked ? '🔓' : '🔒'}</Text>
                <Text className='action-text'>{selectedEntry.isLocked ? '解锁' : '上锁'}</Text>
              </View>
              <View className={`action-btn delete ${selectedEntry.isLocked ? 'disabled' : ''}`} onClick={handleDelete}>
                <Text className='action-icon'>🗑️</Text>
                <Text className='action-text'>删除</Text>
              </View>
            </View>
          </View>
        )}

        {view === 'mood-detail' && detailMood && (
          <View className='view-container animate-fade-in'>
            <View className='detail-header'><Text className='detail-title'>心情记录</Text></View>
            {renderList()}
          </View>
        )}
      </ScrollView>

      {/* 全局底部导航栏 */}
      {!isDiving && (
        <View className='pill-nav-wrapper animate-slide-up'>
          <View className='pill-nav'>
            {view === 'home' ? (
              <View className='nav-icon-btn' onClick={() => { setView('calendar'); triggerVibrate('light'); }}><Text>📅</Text></View>
            ) : (
              <View className='nav-icon-btn' onClick={handleBack}><Text>❮</Text></View>
            )}
            
            <View className='nav-icon-btn add-btn' onClick={() => { setView('new'); resetForm(); triggerVibrate('medium'); }}><Text>+</Text></View>
            
            {view === 'home' ? (
              <View className='nav-icon-btn' onClick={handleBottomMoodView}><Text>🔮</Text></View>
            ) : (
              <View className='nav-icon-btn' onClick={() => { setView('home'); triggerVibrate('light'); }}><Text>🏠</Text></View>
            )}
          </View>
        </View>
      )}

      {/* 全局模态框组件 */}
      {showLoginModal && (
        <OfficialWechatLogin
          visible={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={(profile) => {
            setUserProfile(profile);
            setShowLoginModal(false);
            Taro.showToast({ title: '登录成功', icon: 'success' });
          }}
        />
      )}

      {showWechatLogin && (
        <WechatLogin
          visible={showWechatLogin}
          onSuccess={handleWechatLoginSuccess}
          onClose={() => setShowWechatLogin(false)}
        />
      )}

      {/* 官方微信登录组件 */}
      <OfficialWechatLogin
        visible={showOfficialLogin}
        onSuccess={handleOfficialLoginSuccess}
        onClose={() => setShowOfficialLogin(false)}
      />

      {/* 密码锁弹窗 - 苹果风格 */}
      <ApplePasscodeModal
        visible={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingLockAction(null);
        }}
        onConfirm={handlePasswordConfirm}
        title={passwordModalType === 'set' ? '设置密码' : '输入密码'}
        isPasswordSet={passwordModalType === 'verify'}
      />
    </View>
  )
}
