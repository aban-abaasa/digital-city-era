import React, { useState, useEffect } from 'react';

const AnimatedCounter = ({ 
  value, 
  duration = 1000, 
  prefix = '', 
  suffix = '', 
  className = '' 
}) => {
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    let startTime = null;
    const startValue = currentValue;
    const endValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
    
    if (isNaN(endValue)) {
      setCurrentValue(0);
      return;
    }

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;
      
      setCurrentValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  const formatValue = (val) => {
    if (prefix === '$') {
      return val.toFixed(2);
    }
    if (suffix === '%') {
      return val.toFixed(1);
    }
    return Math.floor(val);
  };

  return (
    <span className={className}>
      {prefix}{formatValue(currentValue)}{suffix}
    </span>
  );
};

export default AnimatedCounter;



