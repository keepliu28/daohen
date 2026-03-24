import React, { useState, useEffect, useRef } from 'react';
import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './VirtualList.scss';

interface VirtualListProps {
  data: any[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: any, index: number) => React.ReactNode;
  keyExtractor: (item: any, index: number) => string;
  bufferSize?: number;
}

const VirtualList: React.FC<VirtualListProps> = ({
  data,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  bufferSize = 5
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算可见区域
  useEffect(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - bufferSize);
    const endIndex = Math.min(
      data.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + bufferSize
    );

    setVisibleRange({ start: startIndex, end: endIndex });
  }, [scrollTop, containerHeight, itemHeight, data.length, bufferSize]);

  // 处理滚动
  const handleScroll = (event: any) => {
    const scrollTop = event.detail.scrollTop;
    setScrollTop(scrollTop);
  };

  // 计算总高度
  const totalHeight = data.length * itemHeight;
  
  // 计算偏移量
  const offsetY = visibleRange.start * itemHeight;
  
  // 可见的数据项
  const visibleData = data.slice(visibleRange.start, visibleRange.end + 1);

  return (
    <View 
      className="virtual-list-container"
      style={{ height: `${containerHeight}px` }}
      onScroll={handleScroll}
      scrollY
    >
      <View 
        className="virtual-list-wrapper"
        style={{ height: `${totalHeight}px` }}
      >
        <View 
          className="virtual-list-content"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          {visibleData.map((item, index) => {
            const actualIndex = visibleRange.start + index;
            return (
              <View 
                key={keyExtractor(item, actualIndex)}
                className="virtual-list-item"
                style={{ height: `${itemHeight}px` }}
              >
                {renderItem(item, actualIndex)}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default VirtualList;