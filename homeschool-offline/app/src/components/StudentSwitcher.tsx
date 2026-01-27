import { useState } from 'react';
import { Users, ChevronDown } from 'lucide-react';
import { useSettingsStore } from '@/store/settings';
import { useCalendarStore } from '@/store/calendar';
import { usePhotosStore } from '@/store/photos';
import { invoke } from '@tauri-apps/api/core';
import type { Settings } from '@/types/database';

export function StudentSwitcher() {
  const { students, currentStudentId, getCurrentStudent, setCurrentStudentId, settings, setSettings } = useSettingsStore();
  const { clearDays } = useCalendarStore();
  const { clearPhotos } = usePhotosStore();
  const [isOpen, setIsOpen] = useState(false);
  const currentStudent = getCurrentStudent();

  const handleSwitchStudent = async (studentId: number) => {
    setIsOpen(false);

    if (studentId === currentStudentId) return;

    try {
      console.log('Switching student from', currentStudentId, 'to', studentId);

      // Clear all student-specific state before switching
      console.log('Clearing calendar days and photos...');
      clearDays();
      clearPhotos();

      // Update current student in backend
      if (settings) {
        const updatedSettings: Settings = {
          ...settings,
          current_student_id: studentId,
        };
        await invoke('update_settings_command', { settings: updatedSettings });
        setSettings(updatedSettings);
      }

      // Set new student ID - this will trigger data reload in App.tsx
      setCurrentStudentId(studentId);
      console.log('Student switched successfully');
    } catch (error) {
      console.error('Failed to switch student:', error);
    }
  };

  if (students.length === 0) {
    return null;
  }

  // If only one student, just show their name without dropdown
  if (students.length === 1) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium">
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">{currentStudent?.name}</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
      >
        <Users className="h-4 w-4" />
        <span className="hidden sm:inline">{currentStudent?.name || 'Select Student'}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full mt-1 z-20 w-48 bg-popover border rounded-md shadow-lg">
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => handleSwitchStudent(student.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left ${
                  student.id === currentStudentId ? 'bg-accent font-medium' : ''
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{student.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
