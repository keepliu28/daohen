export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/profile/index',
    'pages/orders/index',
    'pages/pro/index',
    'pages/mood-memories/index',
    'pages/terms/index',
    'pages/privacy/index',
    'pages/diagnose/index',
    'pages/test-pay/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#020617',
    navigationBarTitleText: '道痕',
    navigationBarTextStyle: 'white'
  },
  lazyCodeLoading: 'requiredComponents'
})
