import React, { useState, useRef, useEffect } from 'react';
import { View, Image, Text } from '@tarojs/components';

interface LazyImageProps {
  src: string;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: React.ReactNode;
  threshold?: number;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  className = '',
  width,
  height,
  placeholder,
  threshold = 100
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, [threshold]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    console.warn('[LazyImage] 图片加载失败:', src);
  };

  const defaultPlaceholder = (
    <View className="lazy-image-placeholder">
      <View className="placeholder-content">
        <Text>📷</Text>
      </View>
    </View>
  );

  return (
    <View 
      ref={imageRef}
      className={`lazy-image ${className} ${isLoaded ? 'loaded' : ''}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto'
      }}
    >
      {!isLoaded && (placeholder || defaultPlaceholder)}
      
      {isInView && (
        <Image
          src={src}
          alt={alt}
          className="lazy-image-real"
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}
    </View>
  );
};

export default LazyImage;