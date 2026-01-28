import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCalendarStore } from '@/store/calendar';
import { usePhotosStore } from '@/store/photos';
import {
  getMonthCalendarDays,
  isDateInMonth,
  isDateToday,
  dateToString,
  formatDate,
  getTodayString,
} from '@/lib/dates';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface MonthViewProps {
  compact?: boolean;
}

export function MonthView({ compact = false }: MonthViewProps) {
  const { currentMonth, selectedDate, setSelectedDate, setCurrentMonth, getDay } = useCalendarStore();
  const { getPhotoCount } = usePhotosStore();

  const calendarDays = getMonthCalendarDays(currentMonth.year, currentMonth.month);

  const handlePrevMonth = () => {
    if (currentMonth.month === 1) {
      setCurrentMonth(currentMonth.year - 1, 12);
    } else {
      setCurrentMonth(currentMonth.year, currentMonth.month - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth.month === 12) {
      setCurrentMonth(currentMonth.year + 1, 1);
    } else {
      setCurrentMonth(currentMonth.year, currentMonth.month + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today.getFullYear(), today.getMonth() + 1);
    setSelectedDate(getTodayString());
  };

  const handleDateClick = (date: Date) => {
    const dateStr = dateToString(date);
    setSelectedDate(dateStr);
  };

  return (
    <div className={compact ? "flex flex-col" : "flex flex-col h-full"}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 md:p-4 border-b shrink-0">
        <h2 className="text-base md:text-2xl font-semibold truncate mr-2">
          {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="sm" onClick={handleToday} className="h-8 px-2 text-xs md:h-9 md:px-3 md:text-sm">
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8 md:h-9 md:w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8 md:h-9 md:w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className={compact ? "p-1.5 md:p-4" : "flex-1 p-1.5 md:p-4 mobile-scroll-padding overflow-auto"}>
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-2 mb-1 md:mb-2">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] md:text-sm font-medium text-muted-foreground py-1"
            >
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-0.5 md:gap-2">
          {calendarDays.map((date) => {
            const dateStr = dateToString(date);
            const day = getDay(dateStr);
            const photoCount = getPhotoCount(dateStr);
            const isCurrentMonth = isDateInMonth(date, currentMonth.month, currentMonth.year);
            const isSelected = dateStr === selectedDate;
            const isTodayDate = isDateToday(date);

            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(date)}
                className={cn(
                  "relative aspect-square rounded border transition-all hover:border-primary min-h-[40px] md:min-h-0",
                  isCurrentMonth ? "bg-background" : "bg-muted/30",
                  isSelected && "ring-1 md:ring-2 ring-primary border-primary",
                  isTodayDate && "font-bold"
                )}
              >
                {/* Date number */}
                <div className={cn(
                  "absolute top-0.5 left-0.5 md:top-1 md:left-2 text-[10px] md:text-sm leading-none",
                  !isCurrentMonth && "text-muted-foreground",
                  isTodayDate && "text-primary"
                )}>
                  {formatDate(date, 'd')}
                </div>

                {/* Homeschool day indicator */}
                {day?.is_homeschool_day && (
                  <div className="absolute top-0.5 right-0.5 md:top-1 md:right-2">
                    <div className="h-1 w-1 md:h-2 md:w-2 rounded-full bg-green-500" />
                  </div>
                )}

                {/* File count badge */}
                {photoCount > 0 && (
                  <div className="absolute bottom-0.5 right-0.5 md:bottom-1 md:right-1">
                    <div className="px-0.5 py-0.5 md:px-1.5 md:py-0.5 text-[8px] md:text-xs rounded-full bg-blue-500 text-white leading-none min-w-[12px] md:min-w-0 text-center" title={`${photoCount} file${photoCount !== 1 ? 's' : ''}`}>
                      {photoCount}
                    </div>
                  </div>
                )}

                {/* Notes indicator */}
                {day?.notes && day.notes.trim().length > 0 && (
                  <div className="absolute bottom-0.5 left-0.5 md:bottom-1 md:left-2">
                    <div className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-yellow-500" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
