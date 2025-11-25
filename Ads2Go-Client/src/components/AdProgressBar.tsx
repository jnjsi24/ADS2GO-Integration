import React, { useState, useEffect, useRef } from 'react';

interface AdProgressBarProps {
  adDuration: number; // Duration in seconds
  isPlaying?: boolean;
  className?: string;
  showStatus?: boolean;
  startTime?: string; // ISO string of when the ad actually started
  // Real-time WebSocket data (if available)
  realTimeData?: {
    currentTime: number;
    progress: number;
    state: 'playing' | 'paused' | 'buffering' | 'loading' | 'ended';
  };
}

const AdProgressBar: React.FC<AdProgressBarProps> = ({ 
  adDuration, 
  isPlaying = true, 
  className = "w-32",
  showStatus = true,
  startTime,
  realTimeData
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [lastKnownProgress, setLastKnownProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Format time helper
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Update last known progress when we have real-time data and it's not buffering
  useEffect(() => {
    if (realTimeData && realTimeData.state !== 'buffering' && realTimeData.state !== 'loading') {
      setLastKnownProgress(realTimeData.progress);
    }
  }, [realTimeData, lastKnownProgress]);

  // ✅ OPTIMIZED: Prefer local calculation using startTime when available
  // This reduces dependency on frequent WebSocket updates
  // Only use real-time data for state changes (paused/playing) and periodic sync
  const shouldUseLocalCalculation = startTime && !realTimeData;
  const displayCurrentTime = shouldUseLocalCalculation
    ? currentTime // Use local timer calculation
    : (realTimeData 
      ? (realTimeData.state === 'buffering' || realTimeData.state === 'loading' 
          ? 0 // ALWAYS 0 during buffering/loading
          : realTimeData.currentTime)
      : currentTime);
  
  // Use real-time state if available, otherwise use local state
  const displayState = realTimeData ? realTimeData.state : (isPlaying ? 'playing' : 'paused');

  // Start/stop progress tracking
  useEffect(() => {
    // ✅ OPTIMIZED: Use local timer when startTime is available, even if realTimeData exists
    // Real-time data is only used for state changes and periodic sync (every 5 seconds)
    // This allows smooth progress updates without frequent WebSocket messages
    
    // If we have startTime, prefer local calculation for smooth updates
    // Only sync with realTimeData periodically (when it arrives every 5 seconds)
    if (startTime) {
      // Sync currentTime from real-time data when it arrives (periodic sync)
      if (realTimeData && realTimeData.state !== 'buffering' && realTimeData.state !== 'loading') {
        // Update local timer to match server time (correct drift)
        const serverTime = realTimeData.currentTime;
        const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
        const drift = Math.abs(serverTime - elapsed);
        
        // If drift is significant (>1 second), resync
        if (drift > 1) {
          startTimeRef.current = Date.now() - (serverTime * 1000);
          setCurrentTime(serverTime);
        }
        
        // Update last known progress
        setLastKnownProgress(realTimeData.progress);
      }
      
      // Continue with local timer (don't return early)
    } else if (realTimeData) {
      // No startTime available, use real-time data only
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Update currentTime from real-time data immediately
      setCurrentTime(realTimeData.currentTime);
      
      // Also update lastKnownProgress immediately for buffering states
      if (realTimeData.state !== 'buffering' && realTimeData.state !== 'loading') {
        setLastKnownProgress(realTimeData.progress);
      }
      
      return;
    }

    // ✅ OPTIMIZED: Run local timer when startTime is available (preferred method)
    // This allows smooth progress updates without frequent WebSocket messages
    if (startTime) {
      // Initialize startTime reference if not set
      if (startTimeRef.current === 0) {
        startTimeRef.current = new Date(startTime).getTime();
        // If we have an initial currentTime, adjust startTime to match
        if (currentTime > 0) {
          startTimeRef.current = Date.now() - (currentTime * 1000);
        }
      }
      
      // Run timer based on state (playing/paused)
      if (displayState === 'playing' && !isPaused) {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
            setCurrentTime(Math.min(elapsed, adDuration)); // Cap at duration
            
            if (elapsed >= adDuration) {
              // Ad finished
              setCurrentTime(adDuration);
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            }
          }, 100); // Update every 100ms for smooth animation
        }
      } else {
        // Paused or not playing - stop timer but keep currentTime
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } else if (isPlaying && isActive && !isPaused) {
      // Fallback: No startTime available, use component mount time
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
  }, [isPlaying, isActive, isPaused, adDuration, currentTime, startTime, realTimeData]);

  // ✅ OPTIMIZED: Sync with real-time data periodically (every 5 seconds)
  // Don't disable local timer - use it for smooth updates, sync for drift correction
  useEffect(() => {
    if (realTimeData && startTime) {
      // We have startTime, so use local calculation with periodic sync
      // Only sync when not buffering/loading
      if (realTimeData.state !== 'buffering' && realTimeData.state !== 'loading') {
        // Calculate drift and resync if significant
        const serverTime = realTimeData.currentTime;
        const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
        const drift = Math.abs(serverTime - elapsed);
        
        // If drift is significant (>1 second), resync startTime
        if (drift > 1) {
          startTimeRef.current = Date.now() - (serverTime * 1000);
          setCurrentTime(serverTime);
        }
        
        setLastKnownProgress(realTimeData.progress);
      } else {
        // Buffering/loading - pause local timer
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCurrentTime(0);
      }
    } else if (realTimeData && !startTime) {
      // No startTime available, use real-time data only
      // Force stop any running timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Update state immediately from real-time data
      if (realTimeData.state === 'buffering' || realTimeData.state === 'loading') {
        setCurrentTime(0); // Force 0 during buffering/loading
      } else {
        setCurrentTime(realTimeData.currentTime);
      }
      
      if (realTimeData.state !== 'buffering' && realTimeData.state !== 'loading') {
        setLastKnownProgress(realTimeData.progress);
      }
    }
  }, [realTimeData, startTime]);

  // Optimize re-renders by memoizing expensive calculations
  const memoizedProgressPercentage = React.useMemo(() => {
    const result = realTimeData 
      ? (realTimeData.state === 'buffering' || realTimeData.state === 'loading' 
          ? 0 // Always show 0% during buffering/loading
          : Math.min(realTimeData.progress, 99.9)) // Cap at 99.9% to prevent premature completion
      : (adDuration > 0 ? Math.min((currentTime / adDuration) * 100, 99.9) : 0);
    
    return result;
  }, [realTimeData, currentTime, adDuration]);

  // Use memoized progress percentage for better performance with frequent updates
  const progressPercentage = memoizedProgressPercentage;

  // Auto-start when component mounts (only if no real-time data)
  useEffect(() => {
    if (!realTimeData) {
      setIsActive(true);
      // Use real start time if available, otherwise use current time
      if (startTime) {
        startTimeRef.current = new Date(startTime).getTime();
      } else {
        startTimeRef.current = Date.now();
      }
    } else {
      // When real-time data is available, don't auto-start local timer
      setIsActive(false);
    }
  }, [startTime, realTimeData]);

  // Reset when ad duration changes (only if no real-time data)
  useEffect(() => {
    if (!realTimeData) {
      setCurrentTime(0);
      // Use real start time if available, otherwise use current time
      if (startTime) {
        startTimeRef.current = new Date(startTime).getTime();
      } else {
        startTimeRef.current = Date.now();
      }
    } else {
      // When real-time data is available, don't reset local timer
      setCurrentTime(0);
    }
  }, [adDuration, startTime, realTimeData]);

  // Pause/resume based on isPlaying (only if no real-time data)
  useEffect(() => {
    if (!realTimeData) {
      setIsPaused(!isPlaying);
    } else {
      // When real-time data is available, don't use local pause state
      setIsPaused(false);
    }
  }, [isPlaying, realTimeData]);

  const getStatusText = () => {
    if (realTimeData) {
      switch (realTimeData.state) {
        case 'playing': return 'Playing';
        case 'paused': return 'Paused';
        case 'buffering': return 'Buffering...';
        case 'loading': return 'Loading...';
        case 'ended': return 'Completed';
        default: return 'Ready...';
      }
    }
    
    if (!isActive) return 'Ready to play';
    if (isPaused) return 'Paused';
    if (currentTime === 0) return 'Starting...';
    if (currentTime >= adDuration) return 'Completed';
    return 'Playing';
  };

  const getStatusColor = () => {
    if (realTimeData) {
      switch (realTimeData.state) {
        case 'playing': return 'text-blue-500';
        case 'paused': return 'text-yellow-500';
        case 'buffering': return 'text-orange-500';
        case 'loading': return 'text-purple-500';
        case 'ended': return 'text-green-500';
        default: return 'text-blue-500';
      }
    }
    
    if (!isActive) return 'text-gray-500';
    if (isPaused) return 'text-yellow-500';
    if (currentTime >= adDuration) return 'text-green-500';
    return 'text-blue-500';
  };

  const getProgressBarColor = () => {
    if (realTimeData) {
      switch (realTimeData.state) {
        case 'playing': return 'bg-blue-600';
        case 'paused': return 'bg-yellow-500';
        case 'buffering': return 'bg-gray-400'; // Gray for buffering
        case 'loading': return 'bg-gray-300'; // Light gray for loading
        case 'ended': return 'bg-green-500';
        default: return 'bg-gray-300'; // Default to gray for unknown states
      }
    }
    
    if (isPaused) return 'bg-yellow-500';
    if (currentTime >= adDuration) return 'bg-green-500';
    return 'bg-blue-600';
  };

  return (
    <div className={className}>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span className="font-mono">{formatTime(displayCurrentTime)}</span>
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
