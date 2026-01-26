import { useState } from 'react';
import { Calendar as CalendarIcon, FileText } from 'lucide-react';
import { MonthView } from './MonthView';
import { DayView } from './DayView';

export function Calendar() {
  const [mobileView, setMobileView] = useState<'month' | 'day'>('month');

  return (
    <>
      {/* Mobile Layout - Single Column with Tabs */}
      <div className="lg:hidden flex flex-col h-full">
        {/* Mobile Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setMobileView('month')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition-colors ${
              mobileView === 'month'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Month</span>
          </button>
          <button
            onClick={() => setMobileView('day')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 border-b-2 transition-colors ${
              mobileView === 'day'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Day</span>
          </button>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden">
          {mobileView === 'month' ? <MonthView /> : <DayView />}
        </div>
      </div>

      {/* Desktop Layout - Two Columns */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:divide-x h-full">
        {/* Month View - Left Panel */}
        <div className="overflow-hidden">
          <MonthView />
        </div>

        {/* Day View - Right Panel */}
        <div className="overflow-hidden">
          <DayView />
        </div>
      </div>
    </>
  );
}
