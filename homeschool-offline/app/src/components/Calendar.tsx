import { useState, useEffect } from 'react';
import { MonthView } from './MonthView';
import { DayView } from './DayView';

export function Calendar() {
  // Force re-render on resize (debounced) to recalculate layout
  const [resizeKey, setResizeKey] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setResizeKey(k => k + 1), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div key={resizeKey} className="h-full">
      {/* Mobile Layout - Vertical Stack (scrollable) */}
      <div className="lg:hidden flex flex-col h-full overflow-y-auto mobile-scroll-padding">
        {/* Month Grid */}
        <div className="shrink-0">
          <MonthView compact />
        </div>

        {/* Day View */}
        <div className="shrink-0">
          <DayView compact />
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
    </div>
  );
}
