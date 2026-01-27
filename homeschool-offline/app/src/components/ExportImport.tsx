import { useState } from 'react';
import { Download, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { ImportWarningDialog } from './ImportWarningDialog';

export function ExportImport() {
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportPath, setExportPath] = useState<string | null>(null);

  // Import state
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportClick = async () => {
    setIsExporting(true);
    setExportComplete(false);
    setExportError(null);

    try {
      console.log('Starting export...');

      // Backend creates file in accessible location and returns path
      console.log('Calling export_data_to_external_command...');
      const filePath: string = await invoke('export_data_to_external_command');
      console.log('Backend created file at:', filePath);

      if (!filePath) {
        throw new Error('Backend returned empty path - export failed');
      }

      setIsExporting(false);
      setExportComplete(true);
      setExportPath(filePath);

      // Auto-clear success message after 10 seconds
      setTimeout(() => {
        setExportComplete(false);
        setExportPath(null);
      }, 10000);
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportError(String(error));
    }
  };

  const handleImportClick = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ZIP Archive',
          extensions: ['zip']
        }]
      });

      if (selected && typeof selected === 'string') {
        // Show warning dialog
        setPendingImportFile(selected);
        setShowImportWarning(true);
      }
    } catch (error) {
      console.error('File selection failed:', error);
      setImportError(String(error));
    }
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;

    setShowImportWarning(false);
    setIsImporting(true);
    setImportComplete(false);
    setImportError(null);

    try {
      // Step 1: Read the file (handles content:// URIs on Android)
      const fileBytes = await readFile(pendingImportFile);

      // Step 2: Send bytes to backend for import
      const bytesArray = Array.from(fileBytes);
      await invoke('import_data_from_bytes_command', { bytes: bytesArray });

      setIsImporting(false);
      setImportComplete(true);

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Import failed:', error);
      setIsImporting(false);
      setImportError(String(error));
    }

    setPendingImportFile(null);
  };

  const handleImportCancel = () => {
    setShowImportWarning(false);
    setPendingImportFile(null);
  };

  return (
    <div className="space-y-6">
      {/* Import Warning Dialog */}
      <ImportWarningDialog
        open={showImportWarning}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />

      {/* Export Section */}
      <div className="space-y-3">
        <Button
          onClick={handleExportClick}
          disabled={isExporting || isImporting}
          className="w-full h-12"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <span>Exporting...</span>
            </>
          ) : exportComplete ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <span>Export Complete!</span>
            </>
          ) : (
            <>
              <Download className="h-5 w-5 mr-2" />
              <span>Export Backup</span>
            </>
          )}
        </Button>

        {/* Export Success */}
        {exportComplete && exportPath && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
            <p className="font-medium mb-2">Backup saved successfully!</p>
            <p className="text-xs opacity-80 break-all">{exportPath}</p>
          </div>
        )}

        {/* Export Error */}
        {exportError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Export failed</p>
              <p className="text-xs opacity-80">{exportError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className="space-y-3">
        <Button
          onClick={handleImportClick}
          disabled={isExporting || isImporting}
          variant="outline"
          className="w-full h-12"
          size="lg"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <span>Importing...</span>
            </>
          ) : importComplete ? (
            <>
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              <span>Import Complete!</span>
            </>
          ) : (
            <>
              <Upload className="h-5 w-5 mr-2" />
              <span>Import Backup</span>
            </>
          )}
        </Button>

        {/* Import Success */}
        {importComplete && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
            <p className="font-medium mb-1">Import successful!</p>
            <p className="text-xs opacity-80">App will reload in 2 seconds...</p>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium mb-1">Import failed</p>
              <p className="text-xs opacity-80">{importError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-muted-foreground space-y-2 pt-2">
        <p>
          <strong>Export:</strong> Create a backup ZIP containing all your data and photos.
        </p>
        <p>
          <strong>Import:</strong> Restore from a backup. This will replace all current data.
        </p>
      </div>
    </div>
  );
}
