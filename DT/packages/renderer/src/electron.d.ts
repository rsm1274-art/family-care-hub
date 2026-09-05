export interface ElectronConfig {
  initialized: boolean;
  serverUrl: string;
}

export interface HostStatus {
  state: 'idle' | 'starting-db' | 'starting-api' | 'ready' | 'error';
  message: string;
}

export interface ElectronAPI {
  getConfig(): Promise<ElectronConfig>;
  startLocal(): Promise<{ serverUrl: string }>;
  getHostStatus(): Promise<HostStatus>;
  onHostStatus(callback: (status: HostStatus) => void): () => void;
}

declare global {
  interface Window {
    /** Present only when running inside the Electron shell. */
    electronAPI?: ElectronAPI;
  }
}
