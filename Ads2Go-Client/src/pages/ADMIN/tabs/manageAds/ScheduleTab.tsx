import React, { useMemo, useState } from 'react';
import { Calendar, CalendarPlus, ChevronLeft, ChevronRight, Clock, Monitor } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_ALL_ADS, GET_ALL_DEPLOYMENTS, type Ad, type AdDeployment } from '../../../../graphql/admin/ads';

interface ScheduleTabProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  dateFilter?: {
    startDate: Date | null;
    endDate: Date | null;
    condition: string;
  } | null;
}


const ScheduleTab: React.FC<ScheduleTabProps> = ({ statusFilter, onStatusChange, dateFilter }) => {
  const [scheduleView, setScheduleView] = useState<'month' | 'week' | 'day'>('month');
  const [cursorDate, setCursorDate] = useState<Date>(new Date());

  const [filterType, setFilterType] = useState<"day" | "month" | "year">("day");
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;


  const { data, loading, error, refetch } = useQuery(GET_ALL_ADS, {
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all'
  });

  // Also query deployments to get scheduled slots
  const { data: deploymentsData } = useQuery(GET_ALL_DEPLOYMENTS, {
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

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
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
    let filtered = adsInPeriod.filter(ad => 
      statusFilter === 'All Status' || ad.status.toLowerCase() === statusFilter.toLowerCase()
    );

    // Apply date filter if active (from parent component)
    if (dateFilter) {
      filtered = filtered.filter(ad => {
        const adStartDate = parseDate(ad.startTime) || parseDate(ad.createdAt);
        if (!adStartDate) return false;

        const { startDate, endDate, condition } = dateFilter;
        
        switch (condition) {
          case 'Is':
            return startDate && isSameDay(adStartDate, startDate);
          case 'Is before':
            return startDate && adStartDate < startDate;
          case 'Is after':
            return startDate && adStartDate > startDate;
          case 'Is on or before':
            return startDate && adStartDate <= startDate;
          case 'Is on or after':
            return startDate && adStartDate >= startDate;
          case 'Is in between':
            return startDate && endDate && adStartDate >= startDate && adStartDate <= endDate;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [adsInPeriod, statusFilter, dateFilter]);




  const groupedByMaterial = useMemo(() => {
    const source: Ad[] = filteredAds.length > 0 ? filteredAds : (data?.getAllAds ?? []);
    const map = new Map<string, Ad[]>();
    const now = new Date();
    const processedAdIds = new Set<string>(); // Track which ads we've already added
    
    // ✅ FIRST: Check deployment slots for SCHEDULED slots (this takes priority)
    const deployments: AdDeployment[] = deploymentsData?.getAllDeployments ?? [];
    deployments.forEach((deployment) => {
      deployment.lcdSlots?.forEach((slot) => {
        // Only include SCHEDULED slots with future start times
        if (slot.status !== 'SCHEDULED') return;
        if (!slot.startTime) return;
        
        const slotStartTime = new Date(slot.startTime);
        if (slotStartTime <= now) return; // Skip slots that already started
        
        const adId = slot.ad?.id || slot.adId;
        if (processedAdIds.has(adId)) return; // Skip duplicates
        
        // Create a virtual Ad object from the slot
        const virtualAd: Ad = {
          id: adId,
          title: slot.ad?.title || 'Unknown',
          description: slot.ad?.description || '',
          adType: 'DIGITAL',
          adFormat: slot.ad?.adFormat || 'VIDEO',
          status: 'SCHEDULED', // Use slot status
          paymentStatus: 'PAID', // Assume paid since it's deployed
          startTime: slot.startTime,
          endTime: slot.endTime || '',
          mediaFile: slot.ad?.mediaFile || slot.mediaFile || '',
          price: 0,
          totalPrice: 0,
          durationDays: 0,
          numberOfDevices: 0,
          adLengthSeconds: 0,
          playsPerDayPerDevice: 0,
          totalPlaysPerDay: 0,
          pricePerPlay: 0,
          createdAt: slot.ad?.createdAt || '',
          updatedAt: '',
          userId: null,
          materialId: null,
        };
        
        processedAdIds.add(adId);
        
        // Group by material (using deployment's materialId, not the ad's)
        const materialId = deployment.materialId;
        const current = map.get(materialId) ?? [];
        current.push(virtualAd);
        map.set(materialId, current);
      });
    });
    
    // SECOND: Add ads from the Ad collection (only if not already in deployment slots)
    // Note: In practice, all ads should already be in deployment slots since
    // ad creation requires at least 1 device. This is just a safety fallback.
    source.forEach((ad) => {
      // Skip if already added from deployment slots
      if (processedAdIds.has(ad.id)) {
        return;
      }
      
      // Filter 1: Only SCHEDULED status
      if (ad.status !== 'SCHEDULED') {
        return;
      }
      
      // Filter 2: Only PAID payment status
      if (ad.paymentStatus !== 'PAID') {
        return;
      }
      
      // Filter 3: Only ads waiting to start (startTime in future)
      const startTime = parseDate(ad.startTime);
      if (startTime && startTime <= now) {
        return; // Skip ads that have already started
      }
      
      // Only include ads that have a material assigned
      // (Skip ads without materials since they shouldn't exist in the system)
      const materialId = typeof ad.materialId === 'string' 
        ? ad.materialId 
        : (ad.materialId?.materialId || ad.materialId?.id || null);
      
      if (materialId) {
        processedAdIds.add(ad.id);
        const current = map.get(materialId) ?? [];
        current.push(ad);
        map.set(materialId, current);
      }
      // Note: Removed "Not Deployed" section since all ads must be deployed during creation
    });
    
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredAds, data, deploymentsData]);

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

  // Pagination calculations
  const totalPages = Math.ceil(groupedByMaterial.length / itemsPerPage);
  const paginatedGroupedMaterials = groupedByMaterial.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Ad Schedule</h2>
      </div>



      {loading ? (
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-lg text-gray-600">Loading schedules...</span>
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-lg p-4 text-red-700">Failed to load schedules.</div>
      ) : (
        <div className="space-y-4">
          {groupedByMaterial.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-8 text-center">
              <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No ads scheduled in this period.</p>
            </div>
          ) : (
            paginatedGroupedMaterials.map(([materialId, ads]) => (
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
                                : ad.status === 'SCHEDULED'
                                ? 'bg-purple-100 text-purple-700'
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
            ))
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-center px-4 py-4 mt-4 border-t">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || totalPages === 0}
                className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Previous</span>
              </button>

              <div className="flex gap-1">
                {(() => {
                  const pages = [];
                  const maxVisiblePages = 5;
                  const effectiveTotalPages = totalPages === 0 ? 1 : totalPages;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(effectiveTotalPages, startPage + maxVisiblePages - 1);

                  if (endPage - startPage < maxVisiblePages - 1) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => handlePageChange(i)}
                        disabled={totalPages === 0}
                        className={`px-3 py-1 text-sm rounded ${
                          currentPage === i
                            ? "border border-gray-300 text-black"
                            : "text-gray-700 hover:border border-gray-300"
                        } ${totalPages === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {i}
                      </button>
                    );
                  }

                  if (endPage < effectiveTotalPages) {
                    pages.push(
                      <span key="ellipsis" className="px-2 text-gray-500">
                        …
                      </span>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages || totalPages === 0}
                className="flex items-center px-3 py-1 text-sm rounded font-semibold hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleTab;
