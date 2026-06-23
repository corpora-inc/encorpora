import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings, Student } from '@/types/database';

interface SettingsState {
  settings: Settings | null;
  students: Student[];
  currentStudentId: number | null;
  onboarded: boolean;
  totalDays: number;

  setSettings: (settings: Settings) => void;
  setStudents: (students: Student[]) => void;
  setCurrentStudentId: (studentId: number | null) => void;
  setOnboarded: (onboarded: boolean) => void;
  setTotalDays: (totalDays: number) => void;
  incrementTotalDays: () => void;
  decrementTotalDays: () => void;

  // Helper to get current student
  getCurrentStudent: () => Student | null;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: null,
      students: [],
      currentStudentId: null,
      onboarded: false,
      totalDays: 0,

      setSettings: (settings) => set({ settings }),
      setStudents: (students) => set({ students }),
      setCurrentStudentId: (studentId) => set({ currentStudentId: studentId }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setTotalDays: (totalDays) => set({ totalDays }),
      incrementTotalDays: () => set((state) => ({ totalDays: state.totalDays + 1 })),
      decrementTotalDays: () => set((state) => ({ totalDays: Math.max(0, state.totalDays - 1) })),

      getCurrentStudent: () => {
        const { students, currentStudentId } = get();
        if (!currentStudentId) return null;
        return students.find(s => s.id === currentStudentId) || null;
      },
    }),
    {
      name: 'homeschool-settings',
    }
  )
);
