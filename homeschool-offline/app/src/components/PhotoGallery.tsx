import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X, File, FileText, FileImage, FileVideo, FileAudio, Paperclip, Image as ImageIcon, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePhotosStore } from '@/store/photos';
import { useSettingsStore } from '@/store/settings';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Photo } from '@/types/database';
import { usePlatform } from '@/hooks/usePlatform';
import { WebcamCapture } from '@/components/WebcamCapture';
import { logger } from '@/utils/logger';

interface PhotoGalleryProps {
  date: string;
}

// Helper to determine file type from extension
function getFileType(filePath: string): 'image' | 'video' | 'audio' | 'document' | 'other' {
  const ext = filePath.toLowerCase().split('.').pop() || '';

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'm4v'].includes(ext)) {
    return 'video';
  }
  if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'wma'].includes(ext)) {
    return 'audio';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages'].includes(ext)) {
    return 'document';
  }
  return 'other';
}

// Simple extension hint from URI - backend will do real detection from bytes
function getExtensionHintFromUri(uri: string): string {
  // Try to extract extension from URI
  const match = uri.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  if (match?.[1]) {
    return match[1];
  }

  // If no extension in URI, return 'bin' - backend will detect from magic bytes
  return 'bin';
}

// Helper to get icon for file type
function getFileIcon(filePath: string) {
  const type = getFileType(filePath);
  switch (type) {
    case 'image':
      return <FileImage className="h-8 w-8 md:h-12 md:w-12" />;
    case 'video':
      return <FileVideo className="h-8 w-8 md:h-12 md:w-12" />;
    case 'audio':
      return <FileAudio className="h-8 w-8 md:h-12 md:w-12" />;
    case 'document':
      return <FileText className="h-8 w-8 md:h-12 md:w-12" />;
    default:
      return <File className="h-8 w-8 md:h-12 md:w-12" />;
  }
}

export function PhotoGallery({ date }: PhotoGalleryProps) {
  const { getPhotos, setPhotos, addPhoto, deletePhoto } = usePhotosStore();
  const { currentStudentId } = useSettingsStore();
  const { isMobile } = usePlatform();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);

  // Refs for hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = getPhotos(date);

  // Load photos when date changes
  const loadPhotosForDate = async () => {
    if (!currentStudentId) return;

    try {
      const backendPhotos = await invoke<Photo[]>('get_photos_for_date', {
        studentId: currentStudentId,
        date,
      });
      logger.debug('Loaded photos from backend:', backendPhotos);
      setPhotos(date, backendPhotos);
    } catch (error) {
      logger.error('Failed to load photos:', error);
    }
  };

  useEffect(() => {
    loadPhotosForDate();
  }, [date, currentStudentId]);

  // Helper to process files using Tauri dialog
  const processFilesFromDialog = async (photosOnly: boolean = false) => {
    logger.debug('processFilesFromDialog called, photosOnly:', photosOnly);

    if (!currentStudentId) {
      logger.error('No currentStudentId - cannot process files');
      return;
    }

    // FAIL-SAFE: Track if cleanup already executed
    let cleanupExecuted = false;

    const performCleanup = () => {
      if (!cleanupExecuted) {
        setIsLoading(false);
        setShowAddMenu(false);
        cleanupExecuted = true;
      }
    };

    try {
      setIsLoading(true);
      const { open } = await import('@tauri-apps/plugin-dialog');

      let selected;
      try {
        if (photosOnly) {
          // For photos/videos - use different formats for mobile vs desktop
          if (isMobile) {
            // Mobile (iOS/Android): Use MIME types
            // Only include formats widely supported on mobile platforms
            selected = await open({
              multiple: true,
              filters: [{
                name: 'Photos & Videos',
                extensions: [
                  // Images - all platforms
                  'image/jpeg',
                  'image/png',
                  'image/gif',
                  'image/webp',
                  'image/heic',
                  'image/heif',
                  // Videos - widely supported formats
                  'video/mp4',
                  'video/quicktime',
                  'video/mpeg',
                  'video/3gpp'
                ]
              }]
            });
          } else {
            // Desktop: Use file extensions (broader support)
            selected = await open({
              multiple: true,
              filters: [{
                name: 'Photos & Videos',
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'm4v', 'mpeg', '3gp']
              }]
            });
          }
        } else {
          // For files, no filter = all file types
          selected = await open({
            multiple: true,
          });
        }
      } catch (dialogError) {
        logger.error('Dialog open failed:', dialogError);
        performCleanup(); // Early cleanup on dialog error
        return;
      }

      logger.debug('Dialog returned:', selected);

      if (!selected) {
        logger.debug('No files selected');
        performCleanup(); // Early cleanup on cancellation
        return;
      }

      if (Array.isArray(selected) && selected.length === 0) {
        logger.debug('No files selected (empty array)');
        performCleanup(); // Early cleanup on cancellation
        return;
      }

      const paths = Array.isArray(selected) ? selected : [selected];
      logger.debug('Processing paths:', paths);

      let successCount = 0;
      let failCount = 0;

      for (const filePath of paths) {
        try {
          logger.debug('Processing file path:', filePath);

          // Check if it's an Android content URI
          if (filePath.startsWith('content://')) {
            try {
              // Use Tauri's readFile which supports content URIs on Android
              const { readFile } = await import('@tauri-apps/plugin-fs');

              const bytes = await readFile(filePath);
              logger.debug(`Read ${bytes.length} bytes from content URI`);

              // Get extension hint from URI (backend will detect from magic bytes)
              const extensionHint = getExtensionHintFromUri(filePath);

              // Try to extract filename from URI
              let originalFilename: string | undefined = undefined;
              const uriParts = filePath.split('/');
              const lastPart = decodeURIComponent(uriParts[uriParts.length - 1] || '');
              if (lastPart && !lastPart.includes(':') && lastPart.length < 100) {
                originalFilename = lastPart;
              }

              // Send bytes to Rust - backend will detect real file type from magic bytes
              const photo = await invoke<Photo>('add_photo_from_bytes_command', {
                studentId: currentStudentId,
                date,
                bytes: Array.from(bytes),
                extension: extensionHint,
                originalFilename,
              });
              logger.debug('Photo added successfully from bytes:', photo);
              addPhoto(photo);
              successCount++;
            } catch (readError) {
              logger.error('Failed to read content URI:', readError);
              failCount++;
            }
          } else {
            // Regular file path - try to extract filename
            let originalFilename: string | undefined = undefined;
            const pathParts = filePath.split('/');
            const filename = pathParts[pathParts.length - 1];
            if (filename && filename.length < 255) {
              originalFilename = filename;
            }

            const photo = await invoke<Photo>('add_photo_command', {
              studentId: currentStudentId,
              date,
              sourcePath: filePath,
              originalFilename,
            });
            logger.debug('Photo added successfully:', photo);
            addPhoto(photo);
            successCount++;
          }
        } catch (error) {
          logger.error('Failed to add photo:', filePath, error);
          failCount++;
        }
      }

      logger.debug(`Finished processing. Success: ${successCount}, Failed: ${failCount}`);

      if (successCount > 0) {
        await loadPhotosForDate();
      }

      if (failCount > 0) {
        alert(`Added ${successCount} file(s). ${failCount} failed.`);
      }
    } catch (error) {
      logger.error('Failed to open file dialog or process files:', error);
      alert(`Failed to select files: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      performCleanup(); // Final cleanup - always runs
    }
  };

  // Helper to process files from HTML file input (desktop fallback)
  const processFiles = async (files: FileList) => {
    logger.debug('processFiles called with', files.length, 'files');

    if (!currentStudentId) {
      logger.error('No currentStudentId - cannot process files');
      return;
    }

    if (files.length === 0) {
      logger.debug('No files to process');
      return;
    }

    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        logger.debug(`Processing file ${i + 1}/${files.length}:`, file.name);
        try {
          // Save file to cache directory first using Tauri's writeFile
          const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
          const { join, appCacheDir } = await import('@tauri-apps/api/path');

          // Read file as ArrayBuffer
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          // Get cache directory path and ensure it exists
          const cacheDir = await appCacheDir();

          const cacheDirExists = await exists(cacheDir);

          if (!cacheDirExists) {
            await mkdir(cacheDir, { recursive: true });
          }

          // Generate temp filename
          const timestamp = Date.now();
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const tempFileName = `${timestamp}_${sanitizedName}`;

          // Get full path for the file
          const fullPath = await join(cacheDir, tempFileName);

          // Write file to cache directory
          await writeFile(fullPath, uint8Array);

          // Add photo to database
          const photo = await invoke<Photo>('add_photo_command', {
            studentId: currentStudentId,
            date,
            sourcePath: fullPath,
            originalFilename: file.name,
          });
          logger.debug('Photo added successfully:', photo);
          addPhoto(photo);
          successCount++;
        } catch (error) {
          logger.error('Failed to process file:', file.name, error);
          failCount++;
        }
      }

      logger.debug(`Finished processing. Success: ${successCount}, Failed: ${failCount}`);

      // Reload photos from backend if any succeeded
      if (successCount > 0) {
        await loadPhotosForDate();
      }

      if (failCount > 0) {
        alert(`Added ${successCount} file(s). ${failCount} failed.`);
      }
    } catch (error) {
      logger.error('Failed to process files:', error);
      alert(`Failed to process files: ${error}`);
    } finally {
      setIsLoading(false);
      setShowAddMenu(false);
    }
  };

  // Handle taking a photo (camera)
  const handleTakePhoto = async () => {
    setShowAddMenu(false);

    // Use HTML input with capture attribute to trigger camera on all platforms
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  // Handle choosing photos from library
  const handleChoosePhoto = async () => {
    setShowAddMenu(false);
    // Use Tauri dialog with strict photo/video filter on ALL platforms
    await processFilesFromDialog(true);
  };


  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Now works on mobile too since we can handle content URIs
      await processFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Handle adding any file type
  const handleAddFile = async () => {
    setShowAddMenu(false);

    if (isMobile) {
      // On mobile, use Tauri dialog (no filter = all files)
      await processFilesFromDialog(false);
    } else {
      // On desktop, use file input
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Handle desktop camera capture
  const handleTakePictureDesktop = () => {
    setShowAddMenu(false);
    setShowWebcam(true);
  };

  const handleWebcamCapture = async (file: File) => {
    logger.debug('handleWebcamCapture called with file:', file.name);
    setShowWebcam(false);

    // Convert File to FileList using DataTransfer API
    const dt = new DataTransfer();
    dt.items.add(file);
    await processFiles(dt.files);
  };

  const handleDeletePhoto = async (photoId: number) => {
    try {
      await invoke('delete_photo_command', { id: photoId });
      deletePhoto(date, photoId);
    } catch (error) {
      logger.error('Failed to delete photo:', error);
    }
  };

  const getPhotoUrl = (filePath: string) => {
    // convertFileSrc will auto-detect the right protocol
    return convertFileSrc(filePath);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm md:text-base font-medium">Photos & Files</h3>
        {isMobile ? (
          // Mobile: Button with menu for camera and file picker
          <div className="relative">
            <Button
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Add</span>
            </Button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 w-48 bg-popover border rounded-md shadow-lg">
                <button
                  onClick={handleTakePhoto}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors rounded-t-md border-b"
                >
                  <ImageIcon className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Take Photo</span>
                </button>
                <button
                  onClick={handleChoosePhoto}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors border-b"
                >
                  <ImageIcon className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Choose Photos</span>
                </button>
                <button
                  onClick={handleAddFile}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors rounded-b-md"
                >
                  <Paperclip className="h-5 w-5 shrink-0" />
                  <span className="font-medium">Add Files</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          // Desktop: 3-button menu
          <div className="relative">
            <Button
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              <Plus className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Add</span>
            </Button>

            {showAddMenu && (
              <div className="absolute right-0 top-full mt-1 z-10 w-56 md:w-48 bg-popover border rounded-md shadow-lg">
                <button
                  onClick={handleTakePictureDesktop}
                  className="w-full flex items-center gap-3 px-4 py-3 md:py-2 text-sm md:text-sm hover:bg-accent transition-colors rounded-t-md border-b"
                >
                  <Camera className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                  <span className="font-medium">Take Picture</span>
                </button>
                <button
                  onClick={handleChoosePhoto}
                  className="w-full flex items-center gap-3 px-4 py-3 md:py-2 text-sm md:text-sm hover:bg-accent transition-colors border-b"
                >
                  <ImageIcon className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                  <span className="font-medium">Choose Photos</span>
                </button>
                <button
                  onClick={handleAddFile}
                  className="w-full flex items-center gap-3 px-4 py-3 md:py-2 text-sm md:text-sm hover:bg-accent transition-colors rounded-b-md"
                >
                  <Paperclip className="h-5 w-5 md:h-4 md:w-4 shrink-0" />
                  <span className="font-medium">Add Files</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-6 md:p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No files yet. Add photos, videos, documents, or any file.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {photos.map((photo) => {
            const fileType = getFileType(photo.file_path);
            const isImage = fileType === 'image';

            return (
              <div key={photo.id} className="relative group aspect-square">
                {isImage ? (
                  <img
                    src={getPhotoUrl(photo.file_path)}
                    alt=""
                    className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setSelectedPhoto(photo)}
                  />
                ) : (
                  <div
                    className={`w-full h-full flex flex-col items-center justify-center bg-muted rounded-lg p-2 ${
                      fileType === 'video' ? 'cursor-pointer hover:bg-muted/80 transition-colors' : ''
                    }`}
                    onClick={fileType === 'video' ? () => setSelectedPhoto(photo) : undefined}
                  >
                    {getFileIcon(photo.file_path)}
                    <p className="text-xs text-center mt-2 line-clamp-2 text-muted-foreground">
                      {photo.original_filename ||
                       photo.file_path.split('/').pop()?.split('.').slice(0, -1).join('.')}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {photo.file_path.split('.').pop()?.toUpperCase()}
                    </p>
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePhoto(photo.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox - rendered via portal to bypass parent constraints */}
      {selectedPhoto && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
          style={{
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            margin: 0,
            padding: 0,
          }}
        >
          <button
            className="absolute p-2 text-white hover:bg-white/10 rounded-full z-10"
            onClick={() => setSelectedPhoto(null)}
            style={{
              top: 'calc(env(safe-area-inset-top) + 1rem)',
              right: 'calc(env(safe-area-inset-right) + 1rem)'
            }}
          >
            <X className="h-6 w-6" />
          </button>

          <div
            className="max-w-full max-h-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: `calc(env(safe-area-inset-top) + 3rem) calc(env(safe-area-inset-right) + 1rem) calc(env(safe-area-inset-bottom) + 1rem) calc(env(safe-area-inset-left) + 1rem)`
            }}
          >
            {getFileType(selectedPhoto.file_path) === 'image' ? (
              <img
                src={getPhotoUrl(selectedPhoto.file_path)}
                alt=""
                className="max-w-full max-h-full object-contain"
              />
            ) : getFileType(selectedPhoto.file_path) === 'video' ? (
              <video
                src={getPhotoUrl(selectedPhoto.file_path)}
                controls
                className="max-w-full max-h-full"
              />
            ) : getFileType(selectedPhoto.file_path) === 'audio' ? (
              <div className="flex flex-col items-center gap-4 p-8 bg-background/10 rounded-lg">
                <FileAudio className="h-24 w-24 text-white" />
                <audio src={getPhotoUrl(selectedPhoto.file_path)} controls className="w-full max-w-md" />
                <p className="text-white text-center">
                  {selectedPhoto.original_filename || selectedPhoto.file_path.split('/').pop()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 bg-background/10 rounded-lg">
                {getFileIcon(selectedPhoto.file_path)}
                <p className="text-white text-center text-lg">
                  {selectedPhoto.original_filename || selectedPhoto.file_path.split('/').pop()}
                </p>
                <p className="text-white/70 text-sm">
                  Preview not available for this file type
                </p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* WebcamCapture modal for desktop camera */}
      {showWebcam && (
        <WebcamCapture
          onCapture={handleWebcamCapture}
          onClose={() => setShowWebcam(false)}
        />
      )}

      {/* Click outside to close menu */}
      {showAddMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowAddMenu(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCameraChange}
        style={{ display: 'none' }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handlePhotoChange}
        style={{ display: 'none' }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
