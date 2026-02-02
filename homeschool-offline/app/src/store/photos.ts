import { create } from 'zustand';
import type { Photo } from '@/types/database';

interface PhotosState {
  photosByDate: Map<string, Photo[]>;
  photoCountsByDate: Map<string, number>;
  setPhotos: (date: string, photos: Photo[]) => void;
  setPhotoCounts: (counts: Record<string, number>) => void;
  addPhoto: (photo: Photo) => void;
  deletePhoto: (date: string, photoId: number) => void;
  getPhotos: (date: string) => Photo[];
  getPhotoCount: (date: string) => number;
  clearPhotos: () => void;
}

export const usePhotosStore = create<PhotosState>((set, get) => ({
  photosByDate: new Map(),
  photoCountsByDate: new Map(),
  setPhotos: (date, photos) =>
    set((state) => {
      const newPhotos = new Map(state.photosByDate);
      const newCounts = new Map(state.photoCountsByDate);
      newPhotos.set(date, photos);
      newCounts.set(date, photos.length);
      return { photosByDate: newPhotos, photoCountsByDate: newCounts };
    }),
  setPhotoCounts: (counts) =>
    set((state) => {
      const newCounts = new Map(state.photoCountsByDate);
      Object.entries(counts).forEach(([date, count]) => {
        newCounts.set(date, count);
      });
      return { photoCountsByDate: newCounts };
    }),
  addPhoto: (photo) =>
    set((state) => {
      const newPhotos = new Map(state.photosByDate);
      const newCounts = new Map(state.photoCountsByDate);
      const existing = newPhotos.get(photo.date) || [];
      newPhotos.set(photo.date, [...existing, photo]);
      newCounts.set(photo.date, existing.length + 1);
      return { photosByDate: newPhotos, photoCountsByDate: newCounts };
    }),
  deletePhoto: (date, photoId) =>
    set((state) => {
      const newPhotos = new Map(state.photosByDate);
      const newCounts = new Map(state.photoCountsByDate);
      const existing = newPhotos.get(date) || [];
      const filtered = existing.filter((p) => p.id !== photoId);
      newPhotos.set(date, filtered);
      newCounts.set(date, filtered.length);
      return { photosByDate: newPhotos, photoCountsByDate: newCounts };
    }),
  getPhotos: (date) => get().photosByDate.get(date) || [],
  getPhotoCount: (date) => get().photoCountsByDate.get(date) || 0,
  clearPhotos: () => set({ photosByDate: new Map(), photoCountsByDate: new Map() }),
}));
