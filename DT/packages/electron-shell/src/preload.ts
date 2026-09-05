import { contextBridge, ipcRenderer } from 'electron';

// Minimal bridge: local-stack startup and status only.
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('fch:get-config'),
  startLocal: () => ipcRenderer.invoke('fch:start-local'),
  getHostStatus: () => ipcRenderer.invoke('fch:get-host-status'),
  onHostStatus: (callback: (status: { state: string; message: string }) => void) => {
    const listener = (_e: unknown, status: { state: string; message: string }) => callback(status);
    ipcRenderer.on('fch:host-status', listener);
    return () => ipcRenderer.removeListener('fch:host-status', listener);
  },
});
