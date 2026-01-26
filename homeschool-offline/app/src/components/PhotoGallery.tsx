import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, X, File, FileText, FileImage, FileVideo, FileAudio, Paperclip, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePhotosStore } from '@/store/photos';
import { useSettingsStore } from '@/store/settings';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { Photo } from '@/types/database';

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
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs for hidden file inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = getPhotos(date);

  // Detect if we're on mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      console.log('Full User Agent:', navigator.userAgent);
      console.log('Platform:', navigator.platform);
      console.log('Max Touch Points:', navigator.maxTouchPoints);

      // Modern iPads might report as Mac, so check for touch support
      const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const userAgentMobile = /iphone|ipad|ipod|android/i.test(userAgent);

      // Consider it mobile if either:
      // 1. User agent indicates mobile device, OR
      // 2. Has touch screen AND not explicitly a desktop (maxTouchPoints > 1 filters out desktop touch screens)
      const mobile = userAgentMobile || (hasTouchScreen && navigator.maxTouchPoints > 1);

      console.log('Detection results:', {
        userAgentMobile,
        hasTouchScreen,
        maxTouchPoints: navigator.maxTouchPoints,
        finalDecision: mobile ? 'MOBILE' : 'DESKTOP'
      });

      setIsMobile(mobile);
    };
    checkMobile();
  }, []);

  // Load photos when date changes
  const loadPhotosForDate = async () => {
    if (!currentStudentId) return;

    try {
      const backendPhotos = await invoke<Photo[]>('get_photos_for_date', {
        studentId: currentStudentId,
        date,
      });
      console.log('Loaded photos from backend:', backendPhotos);
      setPhotos(date, backendPhotos);
    } catch (error) {
      console.error('Failed to load photos:', error);
    }
  };

  useEffect(() => {
    loadPhotosForDate();
  }, [date, currentStudentId]);

  // Helper to process files from file input
  const processFiles = async (files: FileList) => {
    console.log('processFiles called with', files.length, 'files');
    console.log('currentStudentId:', currentStudentId);

    if (!currentStudentId) {
      console.error('No currentStudentId - cannot process files');
      return;
    }

    if (files.length === 0) {
      console.log('No files to process');
      return;
    }

    console.log('Starting file processing...');
    setIsLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`Processing file ${i + 1}/${files.length}:`, file.name, file.type, file.size);
        try {

          // Save file to cache directory first using Tauri's writeFile
          console.log('Importing Tauri file system APIs...');
          const { writeFile, exists, mkdir } = await import('@tauri-apps/plugin-fs');
          const { join, appCacheDir } = await import('@tauri-apps/api/path');
          console.log('APIs imported successfully');

          // Read file as ArrayBuffer
          console.log('Reading file as ArrayBuffer...');
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          console.log(`ArrayBuffer read: ${uint8Array.length} bytes`);

          // Get cache directory path and ensure it exists
          const cacheDir = await appCacheDir();
          console.log('Cache directory:', cacheDir);

          const cacheDirExists = await exists(cacheDir);
          console.log('Cache directory exists:', cacheDirExists);

          if (!cacheDirExists) {
            console.log('Creating cache directory...');
            await mkdir(cacheDir, { recursive: true });
            console.log('Cache directory created');
          }

          // Generate temp filename
          const timestamp = Date.now();
          const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const tempFileName = `${timestamp}_${sanitizedName}`;
          console.log('Temp filename:', tempFileName);

          // Get full path for the file
          const fullPath = await join(cacheDir, tempFileName);
          console.log('Full path for write:', fullPath);

          // Write file to cache directory
          console.log('Writing file to cache directory...');
          await writeFile(fullPath, uint8Array);
          console.log('File written to cache:', fullPath);

          // Add photo to database
          console.log('Calling add_photo_command with studentId:', currentStudentId, 'date:', date);
          const photo = await invoke<Photo>('add_photo_command', {
            studentId: currentStudentId,
            date,
            sourcePath: fullPath,
          });
          console.log('Photo added successfully:', photo);
          addPhoto(photo);
          successCount++;
          console.log('Success count:', successCount);
        } catch (error) {
          console.error('Failed to process file:', file.name, error);
          console.error('Error details:', error);
          failCount++;
        }
      }

      console.log(`Finished processing. Success: ${successCount}, Failed: ${failCount}`);

      // Reload photos from backend
      console.log('Reloading photos from backend...');
      await loadPhotosForDate();
      console.log('Photos reloaded');

      if (failCount > 0) {
        alert(`Added ${successCount} file(s). ${failCount} failed.`);
      }
    } catch (error) {
      console.error('Failed to process files (outer catch):', error);
      console.error('Error details:', error);
      alert(`Failed to process files: ${error}`);
    } finally {
      console.log('processFiles complete, setting isLoading to false');
      setIsLoading(false);
    }
  };

  // Handle choosing photos from library
  const handleChoosePhoto = () => {
    console.log('handleChoosePhoto called');
    setShowAddMenu(false);
    if (photoInputRef.current) {
      console.log('Clicking photoInputRef');
      photoInputRef.current.click();
    } else {
      console.log('photoInputRef.current is null');
    }
  };


  const handleCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleCameraChange triggered', e.target.files?.length);
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handlePhotoChange triggered', e.target.files?.length);
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  // Handle adding any file type
  const handleAddFile = () => {
    console.log('handleAddFile called');
    setShowAddMenu(false);
    if (fileInputRef.current) {
      console.log('Clicking fileInputRef');
      fileInputRef.current.click();
    } else {
      console.log('fileInputRef.current is null');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileChange triggered', e.target.files?.length);
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: number) => {
    try {
      await invoke('delete_photo_command', { id: photoId });
      deletePhoto(date, photoId);
    } catch (error) {
      console.error('Failed to delete photo:', error);
    }
  };

  const getPhotoUrl = (filePath: string) => {
    // convertFileSrc will auto-detect the right protocol
    const url = convertFileSrc(filePath);
    console.log('Converting file path to URL:', filePath, '->', url);
    return url;
  };

  console.log('PhotoGallery render - isMobile:', isMobile);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm md:text-base font-medium">Photos & Files</h3>
        {isMobile ? (
          // Mobile: Single button that uses native picker (shows 3 options automatically on iOS)
          <Button
            onClick={() => {
              console.log('Mobile add button clicked, triggering photoInputRef');
              photoInputRef.current?.click();
            }}
            disabled={isLoading}
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            <Plus className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Add</span>
          </Button>
        ) : (
          // Desktop: 3-button menu
          <div className="relative">
            <Button
              onClick={() => {
                console.log('Desktop add button clicked, toggling menu');
                setShowAddMenu(!showAddMenu);
              }}
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
                  onClick={handleChoosePhoto}
                  className="w-full flex items-center gap-3 px-4 py-3 md:py-2 text-sm md:text-sm hover:bg-accent transition-colors rounded-t-md border-b"
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
                    className="w-full h-full flex flex-col items-center justify-center bg-muted rounded-lg cursor-pointer hover:bg-muted/80 transition-colors p-2"
                    onClick={() => setSelectedPhoto(photo)}
                  >
                    {getFileIcon(photo.file_path)}
                    <p className="text-xs text-center mt-2 line-clamp-2 text-muted-foreground">
                      {photo.file_path.split('/').pop()?.split('.').slice(0, -1).join('.')}
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

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center safe-area-container"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full z-10"
            onClick={() => setSelectedPhoto(null)}
            style={{
              top: 'max(1rem, env(safe-area-inset-top))',
              right: 'max(1rem, env(safe-area-inset-right))'
            }}
          >
            <X className="h-6 w-6" />
          </button>

          <div className="max-w-full max-h-full flex flex-col items-center p-4" onClick={(e) => e.stopPropagation()}>
            {getFileType(selectedPhoto.file_path) === 'image' ? (
              <img
                src={getPhotoUrl(selectedPhoto.file_path)}
                alt=""
                className="max-w-full max-h-[80vh] object-contain"
              />
            ) : getFileType(selectedPhoto.file_path) === 'video' ? (
              <video
                src={getPhotoUrl(selectedPhoto.file_path)}
                controls
                className="max-w-full max-h-[80vh]"
              />
            ) : getFileType(selectedPhoto.file_path) === 'audio' ? (
              <div className="flex flex-col items-center gap-4 p-8 bg-background/10 rounded-lg">
                <FileAudio className="h-24 w-24 text-white" />
                <audio src={getPhotoUrl(selectedPhoto.file_path)} controls className="w-full max-w-md" />
                <p className="text-white text-center">
                  {selectedPhoto.file_path.split('/').pop()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 p-8 bg-background/10 rounded-lg">
                {getFileIcon(selectedPhoto.file_path)}
                <p className="text-white text-center text-lg">
                  {selectedPhoto.file_path.split('/').pop()}
                </p>
                <p className="text-white/70 text-sm">
                  Preview not available for this file type
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close menu (desktop only) */}
      {!isMobile && showAddMenu && (
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
