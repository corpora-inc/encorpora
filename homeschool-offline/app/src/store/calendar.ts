import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Day } from '@/types/database';
import { getTodayString } from '@/lib/dates';

interface CalendarState {
  days: Map<string, Day>;
  selectedDate: string;
  currentMonth: { year: number; month: number };
  setDays: (days: Day[]) => void;
  setDay: (day: Day) => void;
  setSelectedDate: (date: string) => void;
  setCurrentMonth: (year: number, month: number) => void;
  getDay: (date: string) => Day | undefined;
  clearDays: () => void;
}

const now = new Date();

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      days: new Map(),
      selectedDate: getTodayString(),
      currentMonth: {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      },
      setDays: (days) =>
        set((state) => {
          const newDays = new Map(state.days);
          days.forEach((day) => newDays.set(day.date, day));
          return { days: newDays };
        }),
      setDay: (day) =>
        set((state) => {
          const newDays = new Map(state.days);
          newDays.set(day.date, day);
          return { days: newDays };
        }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setCurrentMonth: (year, month) => set({ currentMonth: { year, month } }),
      getDay: (date) => get().days.get(date),
      clearDays: () => set({ days: new Map(), selectedDate: getTodayString() }),
    }),
    {
      name: 'homeschool-calendar',
      partialize: (state) => ({
        selectedDate: state.selectedDate,
        currentMonth: state.currentMonth,
      }),
    }
  )
);
