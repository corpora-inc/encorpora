import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarStore } from '@/store/calendar';
import { useSettingsStore } from '@/store/settings';
import { PhotoGallery } from './PhotoGallery';
import { formatDate, stringToDate, addDaysToString, subDaysFromString } from '@/lib/dates';
import { invoke } from '@tauri-apps/api/core';
import type { Day, DayUpdate } from '@/types/database';

interface DayViewProps {
  compact?: boolean;
}

export function DayView({ compact = false }: DayViewProps) {
  const { selectedDate, setSelectedDate, getDay, setDay } = useCalendarStore();
  const { currentStudentId, incrementTotalDays, decrementTotalDays } = useSettingsStore();
  const [isHomeschoolDay, setIsHomeschoolDay] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load day data when selected date changes
  useEffect(() => {
    const loadDay = async () => {
      if (!currentStudentId) return;

      try {
        const day = getDay(selectedDate);
        if (day) {
          setIsHomeschoolDay(day.is_homeschool_day);
          setNotes(day.notes);
        } else {
          // Try to load from backend
          const backendDay = await invoke<Day | null>('get_day', {
            studentId: currentStudentId,
            date: selectedDate,
          });
          if (backendDay) {
            setDay(backendDay);
            setIsHomeschoolDay(backendDay.is_homeschool_day);
            setNotes(backendDay.notes);
          } else {
            setIsHomeschoolDay(false);
            setNotes('');
          }
        }
      } catch (error) {
        console.error('Failed to load day:', error);
      }
    };

    loadDay();
  }, [selectedDate, currentStudentId, getDay, setDay]);

  const handleHomeschoolToggle = async (checked: boolean) => {
    if (!currentStudentId) return;

    const previousValue = isHomeschoolDay;
    setIsHomeschoolDay(checked);

    try {
      const update: DayUpdate = { is_homeschool_day: checked };
      const updatedDay = await invoke<Day>('update_day', {
        studentId: currentStudentId,
        date: selectedDate,
        updates: update,
      });
      setDay(updatedDay);

      // Update total days counter in global store
      if (checked && !previousValue) {
        // Turned ON homeschool day
        incrementTotalDays();
      } else if (!checked && previousValue) {
        // Turned OFF homeschool day
        decrementTotalDays();
      }
    } catch (error) {
      console.error('Failed to update homeschool day:', error);
      // Revert on error
      setIsHomeschoolDay(previousValue);
    }
  };

  const handleNotesBlur = async () => {
    if (!currentStudentId) return;

    const currentDay = getDay(selectedDate);
    if (currentDay && currentDay.notes === notes) {
      return; // No changes
    }

    setIsSaving(true);
    try {
      const update: DayUpdate = { notes };
      const updatedDay = await invoke<Day>('update_day', {
        studentId: currentStudentId,
        date: selectedDate,
        updates: update,
      });
      setDay(updatedDay);
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrevDay = () => {
    const newDate = subDaysFromString(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = addDaysToString(selectedDate, 1);
    setSelectedDate(newDate);
  };

  const date = stringToDate(selectedDate);
  const displayDate = formatDate(date, 'EEEE, MMMM d, yyyy');

  return (
    <div className={compact ? "flex flex-col" : "flex flex-col h-full"}>
      {/* Header */}
      <div className="flex items-center p-2 md:p-4 border-b shrink-0">
        <Button variant="outline" size="icon" onClick={handlePrevDay} className="h-9 w-9 md:h-10 md:w-10 shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="flex-1 text-xs md:text-xl font-semibold text-center px-2">{displayDate}</h2>
        <Button variant="outline" size="icon" onClick={handleNextDay} className="h-9 w-9 md:h-10 md:w-10 shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className={compact ? "p-3 md:p-6 space-y-4 md:space-y-6" : "flex-1 overflow-y-auto mobile-scroll-padding p-3 md:p-6 space-y-4 md:space-y-6"}>
        {/* Homeschool Day Toggle */}
        <div className="flex items-center justify-between p-3 md:p-4 border rounded-lg">
          <Label htmlFor="homeschool-toggle" className="text-sm md:text-base font-medium">
            Homeschool Day
          </Label>
          <Switch
            id="homeschool-toggle"
            checked={isHomeschoolDay}
            onCheckedChange={handleHomeschoolToggle}
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm md:text-base font-medium">
            Notes
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Add notes about today's activities..."
            className="min-h-[120px] md:min-h-[150px] resize-none text-sm"
          />
          {isSaving && (
            <p className="text-xs text-muted-foreground">Saving...</p>
          )}
        </div>

        {/* Photos */}
        <PhotoGallery date={selectedDate} />
      </div>
    </div>
  );
}
