import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarWidgetProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date | null) => void;
  className?: string;
  minDate?: Date;
  showActionButtons?: boolean;
}

const CalendarWidget: React.FC<CalendarWidgetProps> = ({ 
  selectedDate, 
  onDateSelect, 
  className = '',
  minDate,
  showActionButtons = true
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const generateCalendarDays = (month: Date) => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    
    const firstDay = new Date(year, monthIndex, 1);
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

  const handleDateSelect = (date: Date) => {
    onDateSelect(date);
  };

  const calendarDays = generateCalendarDays(currentMonth);

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 p-4 w-80 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 w-full justify-items-center">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2 h-10 w-10 flex items-center justify-center">
            {day}
          </div>
        ))}
        
        {/* Calendar days */}
        {calendarDays.map((day, index) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonthDay = isCurrentMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isDisabled = minDate && day < minDate;
          
          return (
            <button
              key={index}
              onClick={() => !isDisabled && handleDateSelect(day)}
              disabled={isDisabled}
              className={`
                text-sm font-medium rounded-md transition-colors h-10 w-10 flex items-center justify-center
                ${isDisabled
                  ? 'text-gray-300 cursor-not-allowed'
                  : isSelected 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : isCurrentMonthDay 
                      ? isToday
                        ? 'bg-blue-50 text-blue-600 font-semibold hover:bg-blue-100'
                        : 'text-gray-900 hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-50'
                }
              `}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>

      {/* Action Buttons */}
      {showActionButtons && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
          <button
            onClick={() => onDateSelect(null)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onDateSelect(selectedDate)}
            className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
          >
            Apply Filter
          </button>
        </div>
      )}
    </div>
  );
};

export default CalendarWidget;
