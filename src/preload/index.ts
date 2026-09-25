// The bridge between the UI and the main process.
//
// This runs in the UI's renderer before the page loads, with access to a
// small part of Electron. It exposes exactly the functions in BrowserApi as
// `window.browser` and nothing else; the UI never sees ipcRenderer itself.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { Channels, type BrowserApi, type PageState } from '../shared/ipc';

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void) {
  const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...(args as T));
  ipcRenderer.on(channel, wrapped);
  return () => {
    ipcRenderer.removeListener(channel, wrapped);
  };
}

const api: BrowserApi = {
  platform: process.platform,
  navigate: (input) => ipcRenderer.send(Channels.navigate, input),
  back: () => ipcRenderer.send(Channels.back),
  forward: () => ipcRenderer.send(Channels.forward),
  reload: () => ipcRenderer.send(Channels.reload),
  stop: () => ipcRenderer.send(Channels.stop),
  focusPage: () => ipcRenderer.send(Channels.focusPage),
  onState: (listener) => subscribe<[PageState]>(Channels.state, listener),
  onFocusAddress: (listener) => subscribe(Channels.focusAddress, listener),
};

contextBridge.exposeInMainWorld('browser', api);
