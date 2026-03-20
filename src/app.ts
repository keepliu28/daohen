import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import './app.css'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('App launched.')
    if (process.env.TARO_ENV === 'weapp') {
      Taro.cloud.init({
        // env: 'n1-daohen-9ga3v5k246792d59',
        env: (Taro.cloud as any).DYNAMIC_CURRENT_ENV, 
        traceUser: true,
      })
    }
  })

  // children 是将要会渲染的页面
  return children
}

export default App
