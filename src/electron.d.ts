export interface ElectronAPI {
    selectFolder: () => Promise<string[]>;
    getFileUrl: (filePath: string) => Promise<string>;
  }
    
  declare global {
    interface Window {
      electron: ElectronAPI;
    }
  }
  