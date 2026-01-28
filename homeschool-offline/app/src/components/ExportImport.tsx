import { useState } from 'react';
import { Download, Upload, Loader2, CheckCircle, AlertCircle, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, exists, mkdir, remove } from '@tauri-apps/plugin-fs';
import { appCacheDir, join } from '@tauri-apps/api/path';
import { ImportWarningDialog } from './ImportWarningDialog';
import { usePlatform } from '@/hooks/usePlatform';

export function ExportImport() {
  const { isMobile, platformType } = usePlatform();
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exportMessageDismissed, setExportMessageDismissed] = useState(false);

  // Import state
  const [showImportWarning, setShowImportWarning] = useState(false);
  const [pendingImportCachePath, setPendingImportCachePath] = useState<string | null>(null);
  const [isPreparingImport, setIsPreparingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExportClick = async () => {
    setIsExporting(true);
    setExportComplete(false);
    setExportError(null);
    setExportMessageDismissed(false);

    // Force UI update before backend work
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      console.log('Starting export...');

      if (isMobile) {
        // Mobile platforms
        let filePath: string;

        if (platformType === 'android') {
          // Android: Export to /sdcard/Download/
          console.log('Calling export_data_to_external_command (Android)...');
          filePath = await invoke('export_data_to_external_command');

          console.log('Backend created file at:', filePath);

          if (!filePath) {
            throw new Error('Backend returned empty path - export failed');
          }

          setIsExporting(false);
          setExportComplete(true);
          setExportPath(filePath);
        } else if (platformType === 'ios') {
          // iOS: Export to temp, then open native share sheet
          console.log('Calling export_data_to_ios_documents_command (iOS)...');
          filePath = await invoke('export_data_to_ios_documents_command');

          console.log('Backend created file at:', filePath);

          if (!filePath) {
            throw new Error('Backend returned empty path - export failed');
          }

          // Immediately open iOS Share Sheet
          console.log('Opening iOS Share Sheet...');
          await invoke('plugin:ios-share|share_file', { filePath });

          // Share Sheet is now open - user can save wherever they want
          setIsExporting(false);
          setExportComplete(true);
          setExportPath(filePath);
        } else {
          throw new Error('Unknown mobile platform');
        }
      } else {
        // Desktop: Traditional save dialog
        const timestamp = new Date().toISOString().split('T')[0];
        const defaultFilename = `homeschool-backup-${timestamp}.zip`;

        const destPath = await save({
          defaultPath: defaultFilename,
          filters: [{
            name: 'ZIP Archive',
            extensions: ['zip']
          }]
        });

        if (!destPath) {
          setIsExporting(false);
          return;
        }

        await invoke('export_data_command', { destPath });
        setIsExporting(false);
        setExportComplete(true);
        setExportPath(destPath);
      }
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);

      // Parse error for user-friendly message
      let errorMessage = 'Export failed. ';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage += 'Permission denied. Please check storage permissions.';
        } else if (error.message.includes('space') || error.message.includes('disk full')) {
          errorMessage += 'Not enough storage space available.';
        } else if (error.message.includes('cancelled')) {
          errorMessage += 'Export was cancelled.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'An unexpected error occurred.';
      }

      setExportError(errorMessage);
    }
  };

  const handleImportClick = async () => {
    // Reset any previous errors
    setImportError(null);

    let cachePath: string | null = null;

    try {
      // Step 1: Open file dialog
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'ZIP Archive',
          extensions: ['zip']
        }]
      });

      // User cancelled
      if (!selected || typeof selected !== 'string') {
        return;
      }

      console.log('File selected:', selected);

      // Step 2: Show loading indicator while preparing file
      setIsPreparingImport(true);

      try {
        // Step 3: Read file bytes immediately (critical for iOS temporary files)
        let fileBytes: Uint8Array;
        try {
          fileBytes = await readFile(selected);
          console.log('File read successfully, size:', fileBytes.length, 'bytes');
        } catch (readError) {
          throw new Error(
            `Unable to read the selected file. ${
              readError instanceof Error ? readError.message : 'The file may have been moved or deleted.'
            }`
          );
        }

        // Step 4: Validate file size (basic sanity check)
        if (fileBytes.length === 0) {
          throw new Error('The selected file is empty. Please choose a valid backup file.');
        }

        if (fileBytes.length > 2 * 1024 * 1024 * 1024) { // 2GB limit
          throw new Error('The backup file is too large (over 2GB). This may not be a valid backup.');
        }

        // Step 5: Ensure cache directory exists
        let cacheDir: string;
        try {
          cacheDir = await appCacheDir();
          const cacheDirExists = await exists(cacheDir);
          if (!cacheDirExists) {
            await mkdir(cacheDir, { recursive: true });
          }
        } catch (dirError) {
          throw new Error(
            `Unable to access app storage. ${
              dirError instanceof Error ? dirError.message : 'Please try restarting the app.'
            }`
          );
        }

        // Step 6: Write to cache with timestamp to avoid conflicts
        const timestamp = Date.now();
        const cacheFileName = `import_${timestamp}.zip`;
        try {
          cachePath = await join(cacheDir, cacheFileName);
          console.log('Writing to cache:', cachePath);
          await writeFile(cachePath, fileBytes);
        } catch (writeError) {
          throw new Error(
            `Unable to prepare file for import. ${
              writeError instanceof Error && writeError.message.includes('space')
                ? 'You may be running out of storage space.'
                : writeError instanceof Error
                ? writeError.message
                : 'Please try again.'
            }`
          );
        }

        // Step 7: Verify file was written correctly
        try {
          const cacheFileExists = await exists(cachePath);
          if (!cacheFileExists) {
            throw new Error('File verification failed. Please try again.');
          }
        } catch (verifyError) {
          throw new Error('Unable to verify cached file. Please try again.');
        }

        console.log('File prepared successfully for import');

        // Step 8: Store cache path and show confirmation dialog
        setPendingImportCachePath(cachePath);
        setShowImportWarning(true);

      } catch (prepError) {
        // Cleanup cache file on error
        if (cachePath) {
          try {
            await remove(cachePath);
            console.log('Cleaned up cache file after error');
          } catch (cleanupError) {
            console.error('Failed to cleanup cache file:', cleanupError);
          }
        }

        // Show user-friendly error
        const errorMessage = prepError instanceof Error
          ? prepError.message
          : 'An unexpected error occurred while preparing the file.';

        console.error('Import preparation failed:', prepError);
        setImportError(errorMessage);
      } finally {
        setIsPreparingImport(false);
      }

    } catch (dialogError) {
      // File dialog error (rare, but handle gracefully)
      console.error('File selection dialog failed:', dialogError);
      setImportError('Unable to open file picker. Please try again.');
      setIsPreparingImport(false);
    }
  };

  const handleImportConfirm = async () => {
    // Safety check
    if (!pendingImportCachePath) {
      console.error('No cached file path available for import');
      setImportError('Import preparation failed. Please try selecting the file again.');
      setShowImportWarning(false);
      return;
    }

    const cachePathToCleanup = pendingImportCachePath;

    setShowImportWarning(false);
    setIsImporting(true);
    setImportComplete(false);
    setImportError(null);

    try {
      console.log('Starting import from cache path:', pendingImportCachePath);

      // Verify file still exists before attempting import
      const fileStillExists = await exists(pendingImportCachePath);
      if (!fileStillExists) {
        throw new Error('Cached file no longer exists. Please try importing again.');
      }

      // Pass the cache file path to backend (avoids IPC size limits)
      await invoke('import_data_command', { sourcePath: pendingImportCachePath });

      console.log('Import successful');
      setIsImporting(false);
      setImportComplete(true);

      // Cleanup cache file after successful import
      try {
        await remove(cachePathToCleanup);
        console.log('Cleaned up cache file after successful import');
      } catch (cleanupError) {
        console.warn('Failed to cleanup cache file (non-critical):', cleanupError);
      }

      // Reload app to reflect imported data
      // This is necessary because the database and all state needs to be reloaded
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Import failed:', error);
      setIsImporting(false);

      // Parse error message for user-friendly display
      let errorMessage = 'Import failed. ';

      if (error instanceof Error) {
        if (error.message.includes('Invalid backup file')) {
          errorMessage += 'The selected file is not a valid backup. Please choose a backup file exported from this app.';
        } else if (error.message.includes('No such file')) {
          errorMessage += 'The file could not be found. It may have been deleted.';
        } else if (error.message.includes('permission')) {
          errorMessage += 'Permission denied. Please check file permissions.';
        } else if (error.message.includes('space') || error.message.includes('disk full')) {
          errorMessage += 'Not enough storage space available.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'An unexpected error occurred.';
      }

      setImportError(errorMessage);

      // Cleanup cache file on error
      try {
        await remove(cachePathToCleanup);
        console.log('Cleaned up cache file after error');
      } catch (cleanupError) {
        console.warn('Failed to cleanup cache file:', cleanupError);
      }
    }

    setPendingImportCachePath(null);
  };

  const handleImportCancel = async () => {
    // Cleanup cache file when user cancels
    if (pendingImportCachePath) {
      try {
        await remove(pendingImportCachePath);
        console.log('Cleaned up cache file after user cancellation');
      } catch (cleanupError) {
        console.warn('Failed to cleanup cache file:', cleanupError);
      }
    }

    setShowImportWarning(false);
    setPendingImportCachePath(null);
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
        {exportComplete && exportPath && !exportMessageDismissed && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="font-medium mb-2">Backup saved successfully!</p>
                {platformType === 'ios' && (
                  <p className="text-xs opacity-80 mb-2">
                    Choose where to save your backup using the iOS Share Sheet. You can save to Files, iCloud Drive, or AirDrop to another device.
                  </p>
                )}
                {platformType !== 'ios' && (
                  <p className="text-xs opacity-80 break-all">{exportPath}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setExportMessageDismissed(true);
                  setExportComplete(false);
                  setExportPath(null);
                }}
                className="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Export Error */}
        {exportError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Export failed</p>
                  <p className="text-xs opacity-80">{exportError}</p>
                </div>
              </div>
              <button
                onClick={() => setExportError(null)}
                className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import Section */}
      <div className="space-y-3">
        <Button
          onClick={handleImportClick}
          disabled={isExporting || isImporting || isPreparingImport}
          variant="outline"
          className="w-full h-12"
          size="lg"
        >
          {isPreparingImport ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <span>Preparing file...</span>
            </>
          ) : isImporting ? (
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
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4" />
              <p className="font-medium">Import successful!</p>
            </div>
            <p className="text-xs opacity-80">Reloading app to load your restored data...</p>
          </div>
        )}

        {/* Import Error */}
        {importError && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Import failed</p>
                  <p className="text-xs opacity-80">{importError}</p>
                </div>
              </div>
              <button
                onClick={() => setImportError(null)}
                className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                aria-label="Dismiss"
              >
                <XIcon className="h-4 w-4" />
              </button>
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
