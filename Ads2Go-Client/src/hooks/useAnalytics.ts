import { useState, useEffect, useCallback, useRef } from 'react';
import { analyticsService } from '../services/AnalyticsService';

type TimeRange = {
  startDate: Date;
  endDate: Date;
};

type UseAnalyticsOptions = {
  enabled?: boolean;
  refetchInterval?: number;
  cacheKey?: string;
};

export function useMaterialAnalytics(
  materialId: string | undefined,
  timeRange: TimeRange,
  options: UseAnalyticsOptions = {}
) {
  const { enabled = true, refetchInterval, cacheKey: customCacheKey } = options;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheKeyRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!materialId || !enabled) return;

    const newCacheKey = customCacheKey || `material_${materialId}_${timeRange.startDate.toISOString()}_${timeRange.endDate.toISOString()}`;
    
    // Only fetch if the cache key has changed
    if (newCacheKey === cacheKeyRef.current) return;
    
    cacheKeyRef.current = newCacheKey;
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyticsService.getMaterialAnalytics(
        materialId,
        timeRange.startDate,
        timeRange.endDate
      );
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching material analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [materialId, timeRange, enabled, customCacheKey]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval) return;
    
    const intervalId = setInterval(fetchData, refetchInterval);
    return () => clearInterval(intervalId);
  }, [fetchData, refetchInterval]);

  // Manual refetch function
  const refetch = useCallback(() => {
    if (cacheKeyRef.current) {
      analyticsService.clearCache(cacheKeyRef.current);
    }
    return fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

export function useAdAnalytics(
  adId: string | undefined,
  timeRange: TimeRange,
  options: UseAnalyticsOptions = {}
) {
  const { enabled = true, refetchInterval, cacheKey: customCacheKey } = options;
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheKeyRef = useRef<string>('');

  const fetchData = useCallback(async () => {
    if (!adId || !enabled) return;

    const newCacheKey = customCacheKey || `ad_${adId}_${timeRange.startDate.toISOString()}_${timeRange.endDate.toISOString()}`;
    
    // Only fetch if the cache key has changed
    if (newCacheKey === cacheKeyRef.current) return;
    
    cacheKeyRef.current = newCacheKey;
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyticsService.getAdAnalytics(
        adId,
        timeRange.startDate,
        timeRange.endDate
      );
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching ad analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [adId, timeRange, enabled, customCacheKey]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval) return;
    
    const intervalId = setInterval(fetchData, refetchInterval);
    return () => clearInterval(intervalId);
  }, [fetchData, refetchInterval]);

  // Manual refetch function
  const refetch = useCallback(() => {
    if (cacheKeyRef.current) {
      analyticsService.clearCache(cacheKeyRef.current);
    }
    return fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch,
  };
}

export function useRecordAnalyticsEvent() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const recordEvent = useCallback(async (eventType: string, eventData: Record<string, any>) => {
    setIsRecording(true);
    setError(null);

    try {
      await analyticsService.recordEvent(eventType, eventData);
      return { success: true };
    } catch (err) {
      setError(err as Error);
      console.error('Error recording analytics event:', err);
      return { success: false, error: err };
    } finally {
      setIsRecording(false);
    }
  }, []);

  return {
    recordEvent,
    isRecording,
    error,
  };
}
