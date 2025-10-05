import React, { useState } from 'react';
import { ChevronDown, Filter, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface DateFilterProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilter: (filter: {
    startDate: Date | null;
    endDate: Date | null;
    condition: string;
  }) => void;
  onDeleteFilter: () => void;
}

const DateFilter: React.FC<DateFilterProps> = ({ isOpen, onClose, onApplyFilter, onDeleteFilter }) => {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const handleDateSelect = (date: Date) => {
    setStartDate(date);
    setEndDate(null);
  };

  const handleApplyFilter = () => {
    onApplyFilter({ startDate, endDate, condition: 'Is' });
    onClose();
  };

  const handleCancel = () => {
    setStartDate(null);
    setEndDate(null);
    onClose();
  };

  const generateCalendarDays = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    const days = [];
    const currentDate = new Date(startDate);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
  };

  const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  const isCurrentMonth = (date: Date, month: Date): boolean => {
    return date.getMonth() === month.getMonth() && 
           date.getFullYear() === month.getFullYear();
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const calendarDays = generateCalendarDays(currentMonth);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 flex items-start justify-end z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-64 max-h-[50vh] flex flex-col mt-32 mr-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-2 border-b border-gray-200">
        </div>


        {/* Calendar Section */}
        <div className="p-2 flex-1 overflow-y-auto">
          <div className="border border-gray-200 rounded-md p-1.5">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-900">
                {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </h4>
              <div className="flex gap-0.5">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-0.5 hover:bg-gray-100 rounded"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 py-0.5 h-5 flex items-center justify-center">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, index) => {
                const isSelected = (startDate && isSameDay(day, startDate)) ||
                                 (endDate && isSameDay(day, endDate));
                const isCurrentMonthDay = isCurrentMonth(day, currentMonth);
                
                return (
                  <button
                    key={index}
                    onClick={() => handleDateSelect(day)}
                    className={`
                      p-0 text-xs rounded hover:bg-gray-100 h-5 w-5 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-blue-600 text-white' 
                        : isCurrentMonthDay 
                          ? 'text-gray-900' 
                          : 'text-gray-400'
                      }
                    `}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="p-2 border-t border-gray-200">
          <div className="flex gap-1.5">
            <button
              onClick={handleCancel}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyFilter}
              className="flex-1 px-2 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-xs"
              disabled={!startDate}
            >
              Apply Filter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DateFilter;
