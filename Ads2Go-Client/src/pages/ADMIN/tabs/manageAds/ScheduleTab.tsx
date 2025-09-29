import React, { useMemo, useState } from 'react';
import { Calendar, CalendarPlus, ChevronLeft, ChevronRight, Clock, Monitor, RefreshCw } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_ALL_ADS, type Ad } from '../../../../graphql/admin/ads';

interface ScheduleTabProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
}


const ScheduleTab: React.FC<ScheduleTabProps> = ({ statusFilter, onStatusChange }) => {
  const [scheduleView, setScheduleView] = useState<'month' | 'week' | 'day'>('month');
  const [cursorDate, setCursorDate] = useState<Date>(new Date());

  const [filterType, setFilterType] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState<string>("");


  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });


  const parseDate = (value?: string | null | any): Date | null => {
    if (!value) return null;
    
    // Handle different value types
    let dateValue = value;
    
    // If it's already a Date object, return it
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    
    // If it's an object, try to extract a date string
    if (typeof value === 'object' && value !== null) {
      if ((value as any).$date) dateValue = (value as any).$date;
      else if ((value as any).toString) dateValue = (value as any).toString();
      else return null;
    }
    
    if (typeof dateValue !== 'string') return null;
    
    // Try parsing the date
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) {
      console.warn('Failed to parse date:', dateValue, 'type:', typeof dateValue);
      return null;
    }
    
    return d;
  };

  const formatDateOnly = (value?: string | null): string => {
    const d = parseDate(value);
    return d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  };

  const formatDateTime = (value?: string | null): string => {
    const d = parseDate(value);
    return d
      ? d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'N/A';
  };

  const period = useMemo(() => {
    const start = new Date(cursorDate);
    const end = new Date(cursorDate);
    if (scheduleView === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (scheduleView === 'week') {
      const day = start.getDay();
      const diffToMonday = (day + 6) % 7; // Monday as start
      start.setDate(start.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [cursorDate, scheduleView]);

  const adsInPeriod: Ad[] = useMemo(() => {
    const list: Ad[] = data?.getAllAds ?? [];
    return list.filter((ad) => {
      const s = parseDate(ad.startTime) || parseDate(ad.createdAt);
      const e = parseDate(ad.endTime) || s;
      if (!s) return false;
      // Consider running if any overlap with period
      const start = s.getTime();
      const end = e ? e.getTime() : start;
      return end >= period.start.getTime() && start <= period.end.getTime();
    });
  }, [data, period.start, period.end]);

  const filteredAds = useMemo(() => {
    return adsInPeriod.filter(ad => 
      statusFilter === 'All Status' || ad.status.toLowerCase() === statusFilter.toLowerCase()
    );
  }, [adsInPeriod, statusFilter]);



  const groupedByMaterial = useMemo(() => {
    const source: Ad[] = filteredAds.length > 0 ? filteredAds : (data?.getAllAds ?? []);
    const map = new Map<string, Ad[]>();
    source.forEach((ad) => {
      const materialId = typeof ad.materialId === 'string' ? ad.materialId : (ad.materialId?.materialId || ad.materialId?.id || 'Unknown Material');
      const current = map.get(materialId) ?? [];
      current.push(ad);
      map.set(materialId, current);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAds, data]);

  const periodLabel = useMemo(() => {
    if (scheduleView === 'month') return cursorDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (scheduleView === 'week') return `${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`;
    return cursorDate.toLocaleDateString();
  }, [cursorDate, period.start, period.end, scheduleView]);

  const goPrev = () => {
    const next = new Date(cursorDate);
    if (scheduleView === 'month') next.setMonth(next.getMonth() - 1);
    else if (scheduleView === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCursorDate(next);
  };

  const goNext = () => {
    const next = new Date(cursorDate);
    if (scheduleView === 'month') next.setMonth(next.getMonth() + 1);
    else if (scheduleView === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCursorDate(next);
  };

  const goToday = () => setCursorDate(new Date());

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Ad Schedule</h2>

        <div className="flex items-center space-x-1">
          {/* Filter Type Buttons */}
          <div className="flex items-center gap-1">
            {/* Date Picker */}
          <input
            type={
              filterType === "day"
                ? "date"
                : filterType === "month"
                ? "month"
                : "number" // or "text" for custom year input
            }
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded px-2 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
            placeholder={filterType === "year" ? "YYYY" : ""}
            min={filterType === "year" ? "1900" : undefined}
            max={filterType === "year" ? "2100" : undefined}
          />
            <button
              onClick={() => setFilterType("day")}
              className={`px-3 py-2 text-sm rounded ${
                filterType === "day" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setFilterType("month")}
              className={`px-3 py-2 text-sm rounded ${
                filterType === "month" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setFilterType("year")}
              className={`px-3 py-2 text-sm rounded ${
                filterType === "year" ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Year
            </button>
          </div>
          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            className="px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>


      {loading ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading schedules...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-lg p-4 text-red-700">Failed to load schedules.</div>
      ) : groupedByMaterial.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">No ads scheduled in this period.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByMaterial.map(([materialId, ads]) => (
            <div key={materialId}>
              {/* Material Header */}
              <div className="px-4 py-2 text-lg font-semibold text-gray-700 flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                {materialId} ({ads.length} ad{ads.length !== 1 ? 's' : ''})
              </div>

              {/* 2 Column Grid for Ads */}
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3">
                {ads
                  .slice()
                  .sort((a, b) => {
                    const dateA = parseDate(a.startTime) || parseDate(a.createdAt);
                    const dateB = parseDate(b.startTime) || parseDate(b.createdAt);
                    if (!dateA || !dateB) return 0;
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map((ad) => (
                    <li
                      key={ad.id}
                      className="bg-white rounded-lg shadow-md px-5 py-3 hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer"
                    >
                      {/* Title + Format + Status in same row */}
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900 truncate text-lg">
                          {ad.title || '(Untitled Ad)'}
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="px-3 py-1 rounded bg-gray-100 text-gray-700">
                            {ad.adFormat}
                          </span>
                          <span
                            className={`px-3 py-1 rounded ${
                              ad.status === 'RUNNING'
                                ? 'bg-green-100 text-green-700'
                                : ad.status === 'APPROVED'
                                ? 'bg-blue-100 text-blue-700'
                                : ad.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : ad.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {ad.status}
                          </span>
                        </div>
                      </div>

                      {/* Dates + Time Range in 2 columns */}
                      <div className="flex justify-between mt-2 text-sm text-gray-500">
                        {/* Left side: Created + Ends */}
                        <div className="space-y-1">
                          <div>Created: {formatDateOnly(ad.createdAt)}</div>
                          <div>Ends: {formatDateOnly(ad.endTime)}</div>
                        </div>

                        {/* Right side: Time Range + Start Date */}
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-1 ">
                            <Clock className="w-3 h-3" />
                            <span>
                              {parseDate(ad.startTime)?.toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              }) || 'N/A'}
                              {parseDate(ad.endTime)
                                ? ` - ${parseDate(ad.endTime)!.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}`
                                : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>Starts: {formatDateOnly(ad.startTime)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          ))}

        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
