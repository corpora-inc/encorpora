import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

interface ImportWarningDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportWarningDialog({ open, onCancel, onConfirm }: ImportWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="text-left">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-red-500/10">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <AlertDialogTitle className="text-xl">
              Replace All Data?
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-left text-muted-foreground text-base pt-4 space-y-3">
              <div className="font-semibold text-foreground">
                This will completely replace:
              </div>
              <ul className="list-disc pl-6 space-y-1.5 text-foreground/90">
                <li>All students and their information</li>
                <li>All calendar entries and notes</li>
                <li>All photos and media files</li>
                <li>All app settings</li>
              </ul>
              <div className="pt-2 text-sm text-muted-foreground">
                Your current data will be backed up automatically before import,
                but this backup will only be accessible if import fails.
              </div>
              <div className="font-semibold text-foreground pt-2">
                Are you sure you want to continue?
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Yes, Replace All Data
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
