import { MonthView } from './MonthView';
import { DayView } from './DayView';

export function Calendar() {
  return (
    <>
      {/* Mobile Layout - Vertical Stack (scrollable) */}
      <div className="lg:hidden flex flex-col h-full overflow-y-auto">
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
    </>
  );
}
