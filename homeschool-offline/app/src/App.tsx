import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Calendar } from './components/Calendar';
import { WelcomeScreen } from './components/WelcomeScreen';
import { Settings } from './components/Settings';
import { StudentSwitcher } from './components/StudentSwitcher';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Settings as SettingsIcon } from 'lucide-react';
import { useSettingsStore } from './store/settings';
import { useCalendarStore } from './store/calendar';
import { usePhotosStore } from './store/photos';
import type { Settings as SettingsType, Day, Student } from './types/database';

type View = 'calendar' | 'settings';

function App() {
  const { onboarded, currentStudentId, totalDays, setSettings, setStudents, setCurrentStudentId, setTotalDays, getCurrentStudent } = useSettingsStore();
  const { currentMonth, setDays } = useCalendarStore();
  const { setPhotoCounts } = usePhotosStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentView, setCurrentView] = useState<View>('calendar');
  const currentStudent = getCurrentStudent();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize database
        await invoke('init_db_command');

        // Load settings
        const settings = await invoke<SettingsType>('get_settings_command');
        setSettings(settings);

        // Load students
        let students = await invoke<Student[]>('get_students_command');

        // Only create a default student if user is already onboarded but has no students
        // (e.g., after database migration). If not onboarded, let WelcomeScreen handle it.
        if (students.length === 0 && onboarded) {
          console.log('Onboarded user has no students, creating default student');
          const defaultStudent = await invoke<Student>('add_student_command', { name: 'Student 1' });
          students = [defaultStudent];

          // Update settings to point to this student
          const updatedSettings = { ...settings, current_student_id: defaultStudent.id };
          await invoke('update_settings_command', { settings: updatedSettings });
          setSettings(updatedSettings);
        }

        setStudents(students);

        // Set current student from settings or first student
        if (settings.current_student_id) {
          setCurrentStudentId(settings.current_student_id);
        } else if (students.length > 0) {
          setCurrentStudentId(students[0].id);
        }

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, []);

  // Load total days when student changes
  useEffect(() => {
    const loadTotalDays = async () => {
      if (!currentStudentId) return;

      try {
        const total = await invoke<number>('get_total_homeschool_days_command', {
          studentId: currentStudentId,
        });
        setTotalDays(total);
      } catch (error) {
        console.error('Failed to load total days:', error);
      }
    };

    if (isInitialized && onboarded && currentStudentId) {
      loadTotalDays();
    }
  }, [currentStudentId, isInitialized, onboarded, setTotalDays]);

  // Load days and photo counts when month or student changes
  useEffect(() => {
    const loadMonth = async () => {
      if (!currentStudentId) return;

      try {
        // Load days
        const days = await invoke<Day[]>('get_days_in_month_command', {
          studentId: currentStudentId,
          year: currentMonth.year,
          month: currentMonth.month,
        });
        setDays(days);

        // Load photo counts for the entire month
        const counts = await invoke<Record<string, number>>('get_photo_counts_for_month_command', {
          studentId: currentStudentId,
          year: currentMonth.year,
          month: currentMonth.month,
        });
        setPhotoCounts(counts);
      } catch (error) {
        console.error('Failed to load month:', error);
      }
    };

    if (isInitialized && onboarded && currentStudentId) {
      loadMonth();
    }
  }, [currentMonth, currentStudentId, isInitialized, onboarded]);

  if (!isInitialized) {
    return (
      <div className="h-full flex items-center justify-center safe-area-container">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!onboarded) {
    return <WelcomeScreen />;
  }

  if (currentView === 'settings') {
    return <Settings onClose={() => setCurrentView('calendar')} />;
  }

  return (
    <div className="h-full flex flex-col safe-area-container">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <StudentSwitcher />
          <h1 className="text-base md:text-lg font-semibold">{currentStudent?.name || 'Student'}</h1>
          <Badge variant="secondary" className="text-xs">
            {totalDays} {totalDays === 1 ? 'day' : 'days'}
          </Badge>
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentView('settings')}>
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Calendar />
      </div>
    </div>
  );
}

export default App;
