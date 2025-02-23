export interface ElectronAPI {
    selectFolder: () => Promise<string[]>;
    getFileUrl: (filePath: string) => Promise<string>;
    getMetadata: (path: string) => Promise<{
      title?: string;
      artist?: string;
      albumArt?: {
        format: string;
        data: string;
      } | null;
    }>;
    getFilesInFolder: (folderPath: string) => Promise<string[]>;
    checkAlbumArtFolder: (folderPath: string) => Promise<string[]>;
    getDefaultDownloadDir: () => string;
    getSavedFolder: () => Promise<string>;
    saveFolder: (folder: string) => Promise<void>;
    getSavedVolume: () => Promise<number>;
    saveVolume: (volume: number) => Promise<void>;
    getSaveStatePreference: () => Promise<boolean>;
    getTrackOrder: (folderPath: string) => Promise<string[]>;
    saveTrackOrder: (folderPath: string, order: string[]) => Promise<void>;
}
    
declare global {
    interface Window {
      electron: ElectronAPI;
    }
}

export interface Track {
  id: string;
  title?: string;
  artist?: string;
  artists?: string[];
  album?: string;
  genre?: string;
  year?: string;
  duration?: number;
  name?: string;
  fullPath: string;
  albumArt?: {
    format: string;
    data: string;
  } | null;
}
