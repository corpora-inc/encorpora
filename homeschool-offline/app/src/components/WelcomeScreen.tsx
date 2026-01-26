import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSettingsStore } from '@/store/settings';
import { invoke } from '@tauri-apps/api/core';
import { X, Plus } from 'lucide-react';
import type { Settings, Student } from '@/types/database';

export function WelcomeScreen() {
  const { setSettings, setStudents, setCurrentStudentId, setOnboarded } = useSettingsStore();
  const [parentName, setParentName] = useState('');
  const [studentNames, setStudentNames] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddStudent = () => {
    setStudentNames([...studentNames, '']);
  };

  const handleRemoveStudent = (index: number) => {
    if (studentNames.length > 1) {
      setStudentNames(studentNames.filter((_, i) => i !== index));
    }
  };

  const handleStudentNameChange = (index: number, value: string) => {
    const newNames = [...studentNames];
    newNames[index] = value;
    setStudentNames(newNames);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validStudentNames = studentNames.filter(name => name.trim());
    if (!parentName.trim() || validStudentNames.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Create students
      const createdStudents: Student[] = [];
      for (const name of validStudentNames) {
        const student = await invoke<Student>('add_student_command', { name: name.trim() });
        createdStudents.push(student);
      }

      // Update settings with parent name and first student as current
      const currentSettings = await invoke<Settings>('get_settings_command');
      const updatedSettings: Settings = {
        ...currentSettings,
        parent_name: parentName,
        current_student_id: createdStudents[0].id,
      };

      await invoke('update_settings_command', { settings: updatedSettings });

      setSettings(updatedSettings);
      setStudents(createdStudents);
      setCurrentStudentId(createdStudents[0].id);
      setOnboarded(true);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to create students. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full bg-background flex items-center justify-center p-4 safe-area-container overflow-y-auto">
      <div className="max-w-md w-full space-y-6 md:space-y-8 my-4">
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold">Homeschool Offline</h1>
          <p className="text-base md:text-lg text-muted-foreground">
            Track your homeschooling journey
          </p>
        </div>

        <div className="space-y-4 bg-card p-6 md:p-8 rounded-lg border shadow-lg">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Welcome!</h2>
            <p className="text-sm text-muted-foreground">
              Set up your homeschool profile and add your students.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="parent-name">
                Parent Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="parent-name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label>
                Students <span className="text-destructive">*</span>
              </Label>
              {studentNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => handleStudentNameChange(index, e.target.value)}
                    placeholder={`Student ${index + 1} name`}
                    required
                  />
                  {studentNames.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveStudent(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddStudent}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Student
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!parentName.trim() || studentNames.filter(n => n.trim()).length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Setting up...' : 'Get Started'}
            </Button>
          </form>
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1">
          <p>100% offline • No cloud • You own your data</p>
        </div>
      </div>
    </div>
  );
}
