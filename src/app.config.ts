export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/pro/index',
    'pages/mood-memories/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#020617',
    navigationBarTitleText: '道痕',
    navigationBarTextStyle: 'white'
  },
  lazyCodeLoading: 'requiredComponents'
})
