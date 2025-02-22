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
}
    
declare global {
    interface Window {
      electron: ElectronAPI;
    }
}
