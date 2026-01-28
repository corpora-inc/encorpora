import { useState, useEffect } from 'react';
import { Users, Plus, X as XIcon, Pencil, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExportImport } from './ExportImport';
import { About } from './About';
import { useSettingsStore } from '@/store/settings';
import { useCalendarStore } from '@/store/calendar';
import { usePhotosStore } from '@/store/photos';
import { invoke } from '@tauri-apps/api/core';
import type { Settings as SettingsType, Student } from '@/types/database';

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { settings, students, currentStudentId, totalDays, setSettings, setStudents, getCurrentStudent, setCurrentStudentId, setTotalDays } = useSettingsStore();
  const { clearDays } = useCalendarStore();
  const { clearPhotos } = usePhotosStore();
  const [parentName, setParentName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [editingStudent, setEditingStudent] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);

  useEffect(() => {
    if (settings) {
      setParentName(settings.parent_name);
    }
  }, [settings]);

  const handleParentNameBlur = async () => {
    if (!settings) return;
    if (settings.parent_name === parentName) return; // No changes

    try {
      const updatedSettings: SettingsType = {
        ...settings,
        parent_name: parentName,
      };

      await invoke('update_settings_command', { settings: updatedSettings });
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleSwitchStudent = async (studentId: number) => {
    setIsStudentDropdownOpen(false);

    if (studentId === currentStudentId) return;

    try {
      // Clear all student-specific state before switching
      clearDays();
      clearPhotos();

      // Update current student in backend
      if (settings) {
        const updatedSettings: SettingsType = {
          ...settings,
          current_student_id: studentId,
        };
        await invoke('update_settings_command', { settings: updatedSettings });
        setSettings(updatedSettings);
      }

      // Set new student ID - this will trigger data reload
      setCurrentStudentId(studentId);

      // Reload total days for new student
      const total = await invoke<number>('get_total_homeschool_days_command', {
        studentId: studentId,
      });
      setTotalDays(total);
    } catch (error) {
      console.error('Failed to switch student:', error);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName.trim()) return;

    try {
      const student = await invoke<Student>('add_student_command', { name: newStudentName.trim() });
      setStudents([...students, student]);
      setNewStudentName('');
    } catch (error) {
      console.error('Failed to add student:', error);
    }
  };

  const handleEditStudent = async (studentId: number) => {
    if (!editName.trim()) return;

    try {
      await invoke('update_student_command', { id: studentId, name: editName.trim() });
      const updatedStudents = students.map(s =>
        s.id === studentId ? { ...s, name: editName.trim() } : s
      );
      setStudents(updatedStudents);
      setEditingStudent(null);
      setEditName('');
    } catch (error) {
      console.error('Failed to update student:', error);
    }
  };

  const handleDeleteStudent = async (studentId: number) => {
    if (students.length === 1) {
      alert('Cannot delete the only student. Add another student first.');
      return;
    }

    if (!confirm('Delete this student? All their data (days, notes, photos) will be permanently removed.')) {
      return;
    }

    try {
      await invoke('delete_student_command', { id: studentId });
      const updatedStudents = students.filter(s => s.id !== studentId);
      setStudents(updatedStudents);
    } catch (error) {
      console.error('Failed to delete student:', error);
    }
  };

  const currentStudent = getCurrentStudent();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-3 md:px-4 py-3 border-b shrink-0" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <h1 className="text-base md:text-lg font-semibold">Settings</h1>
        <Button variant="outline" size="icon" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto mobile-scroll-padding">
        <div className="max-w-2xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <div className="space-y-6">
            {/* Current Student Stats */}
            {currentStudent && (
              <div className="bg-primary/5 p-3 rounded-md relative">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Current Student</p>
                    {students.length > 1 ? (
                      <button
                        onClick={() => setIsStudentDropdownOpen(!isStudentDropdownOpen)}
                        className="flex items-center gap-1.5 font-medium hover:text-primary transition-colors"
                      >
                        <span>{currentStudent.name}</span>
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    ) : (
                      <p className="font-medium">{currentStudent.name}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Total Homeschool Days</p>
                    <p className="text-2xl font-bold text-primary">{totalDays}</p>
                  </div>
                </div>

                {/* Student Dropdown */}
                {isStudentDropdownOpen && students.length > 1 && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsStudentDropdownOpen(false)}
                    />
                    <div className="absolute left-3 top-full mt-1 z-20 w-64 bg-popover border rounded-md shadow-lg">
                      {students.map((student) => (
                        <button
                          key={student.id}
                          onClick={() => handleSwitchStudent(student.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left ${
                            student.id === currentStudentId ? 'bg-accent font-medium' : ''
                          }`}
                        >
                          <Users className="h-5 w-5" />
                          <span>{student.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Parent Name */}
            <div className="space-y-2">
              <Label htmlFor="parent-name" className="text-sm">Parent Name</Label>
              <Input
                id="parent-name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                onBlur={handleParentNameBlur}
                placeholder="Your name"
                className="text-sm"
              />
            </div>

            {/* Students */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm md:text-base font-medium flex items-center gap-2">
                <Users className="h-5 w-5" />
                Students
              </h3>
              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center gap-3 p-3 rounded border">
                    {editingStudent === student.id ? (
                      <>
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-sm flex-1"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEditStudent(student.id)}
                        >
                          <Check className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingStudent(null);
                            setEditName('');
                          }}
                        >
                          <XIcon className="h-5 w-5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{student.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingStudent(student.id);
                            setEditName(student.name);
                          }}
                        >
                          <Pencil className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeleteStudent(student.id)}
                          disabled={students.length === 1}
                        >
                          <XIcon className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="New student name"
                    className="text-sm"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddStudent()}
                  />
                  <Button size="sm" onClick={handleAddStudent}>
                    <Plus className="h-5 w-5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>
            </div>

            {/* Backup & Restore */}
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm md:text-base font-medium">Backup & Restore</h3>
              <ExportImport />
            </div>

            {/* About */}
            <div className="pt-4 border-t">
              <About />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
