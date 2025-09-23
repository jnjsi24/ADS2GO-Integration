import React, { useState, useEffect, useRef } from 'react';

interface AdProgressBarProps {
  adDuration: number; // Duration in seconds
  isPlaying?: boolean;
  className?: string;
  showStatus?: boolean;
}

const AdProgressBar: React.FC<AdProgressBarProps> = ({ 
  adDuration, 
  isPlaying = true, 
  className = "w-32",
  showStatus = true
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = adDuration > 0 ? (currentTime / adDuration) * 100 : 0;

  // Start/stop progress tracking
  useEffect(() => {
    if (isPlaying && isActive && !isPaused) {
      if (!intervalRef.current) {
        startTimeRef.current = Date.now() - (currentTime * 1000);
      }
      
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setCurrentTime(elapsed);
        
        if (elapsed >= adDuration) {
          // Ad finished, reset and restart
          setCurrentTime(0);
          startTimeRef.current = Date.now();
        }
      }, 100); // Update every 100ms for smoother animation
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isActive, isPaused, adDuration, currentTime]);

  // Auto-start when component mounts
  useEffect(() => {
    setIsActive(true);
    startTimeRef.current = Date.now();
  }, []);

  // Reset when ad duration changes
  useEffect(() => {
    setCurrentTime(0);
    startTimeRef.current = Date.now();
  }, [adDuration]);

  // Pause/resume based on isPlaying
  useEffect(() => {
    setIsPaused(!isPlaying);
  }, [isPlaying]);

  const getStatusText = () => {
    if (!isActive) return 'Ready to play';
    if (isPaused) return 'Paused';
    if (currentTime === 0) return 'Starting...';
    if (currentTime >= adDuration) return 'Completed';
    return 'Playing';
  };

  const getStatusColor = () => {
    if (!isActive) return 'text-gray-500';
    if (isPaused) return 'text-yellow-500';
    if (currentTime >= adDuration) return 'text-green-500';
    return 'text-blue-500';
  };

  const getProgressBarColor = () => {
    if (isPaused) return 'bg-yellow-500';
    if (currentTime >= adDuration) return 'bg-green-500';
    return 'bg-blue-600';
  };

  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-mono">{formatTime(currentTime)}</span>
        <span className="font-mono">{formatTime(adDuration)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-2 rounded-full transition-all duration-100 ${getProgressBarColor()}`}
          style={{ 
            width: `${Math.min(progressPercentage, 100)}%`,
            background: isPaused 
              ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
              : currentTime >= adDuration
                ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                : 'linear-gradient(90deg, #2563eb 0%, #3b82f6 100%)'
          }}
        >
          {/* Animated shimmer effect when playing */}
          {!isPaused && currentTime < adDuration && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
          )}
        </div>
      </div>
      {showStatus && (
        <div className={`text-xs mt-1 text-center font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      )}
    </div>
  );
};

export default AdProgressBar;
