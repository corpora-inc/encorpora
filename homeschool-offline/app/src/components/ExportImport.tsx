import { useState } from 'react';
import { Download, Upload, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';

export function ExportImport() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setMessage(null);

      const timestamp = new Date().toISOString().split('T')[0];
      const defaultFilename = `homeschool-backup-${timestamp}.zip`;

      const filePath = await save({
        defaultPath: defaultFilename,
        filters: [{
          name: 'ZIP Archive',
          extensions: ['zip']
        }]
      });

      if (filePath) {
        await invoke('export_data_command', { destPath: filePath });
        setMessage({
          type: 'success',
          text: 'Backup exported successfully!',
        });
      }
    } catch (error) {
      console.error('Export failed:', error);
      setMessage({
        type: 'error',
        text: `Export failed: ${error}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsImporting(true);
      setMessage(null);

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ZIP Archive',
          extensions: ['zip']
        }]
      });

      if (selected && typeof selected === 'string') {
        await invoke('import_data_command', { sourcePath: selected });
        setMessage({
          type: 'success',
          text: 'Backup imported successfully! Please restart the app to see the restored data.',
        });

        // Reload the page after a delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Import failed:', error);
      setMessage({
        type: 'error',
        text: `Import failed: ${error}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-3">
        <Button
          onClick={handleExport}
          disabled={isExporting || isImporting}
          className="flex-1 h-12 md:h-10"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 mr-2 animate-spin" />
              <span className="text-sm md:text-base">Exporting...</span>
            </>
          ) : (
            <>
              <Download className="h-5 w-5 md:h-4 md:w-4 mr-2" />
              <span className="text-sm md:text-base">Export Backup</span>
            </>
          )}
        </Button>

        <Button
          onClick={handleImport}
          disabled={isExporting || isImporting}
          variant="outline"
          className="flex-1 h-12 md:h-10"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-5 w-5 md:h-4 md:w-4 mr-2 animate-spin" />
              <span className="text-sm md:text-base">Importing...</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 md:h-4 md:w-4 mr-2" />
              <span className="text-sm md:text-base">Import Backup</span>
            </>
          )}
        </Button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
              : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Export:</strong> Create a backup ZIP file containing all your data and photos.
        </p>
        <p>
          <strong>Import:</strong> Restore data from a backup ZIP file. Your current data will be backed up automatically.
        </p>
      </div>
    </div>
  );
}
