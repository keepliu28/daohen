import React from 'react';
import { View, Text, Button } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './ErrorBoundary.scss';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[错误边界] 捕获到错误:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // 记录错误日志
    this.logError(error, errorInfo);
  }

  logError(error: Error, errorInfo: any) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      componentStack: errorInfo.componentStack,
      systemInfo: Taro.getSystemInfoSync(),
      appVersion: process.env.TARO_APP_VERSION || 'unknown'
    };
    
    console.error('[错误日志]', errorLog);
    
    // 可以在这里将错误日志发送到服务器
    // this.sendErrorToServer(errorLog);
  }

  handleReload = () => {
    Taro.reLaunch({
      url: '/pages/index/index'
    });
  }

  handleGoHome = () => {
    Taro.switchTab({
      url: '/pages/index/index'
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className='error-boundary'>
          <View className='error-content'>
            <Text className='error-icon'>⚠️</Text>
            <Text className='error-title'>程序出现异常</Text>
            <Text className='error-message'>
              {this.state.error?.message || '未知错误'}
            </Text>
            
            <View className='error-actions'>
              <Button 
                className='error-btn primary' 
                onClick={this.handleReload}
              >
                重新加载
              </Button>
              <Button 
                className='error-btn secondary' 
                onClick={this.handleGoHome}
              >
                返回首页
              </Button>
            </View>
            
            {process.env.NODE_ENV === 'development' && (
              <View className='error-details'>
                <Text className='error-details-title'>错误详情 (开发模式):</Text>
                <Text className='error-stack'>
                  {this.state.error?.stack}
                </Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;