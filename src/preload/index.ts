// The bridge between the UI and the main process.
//
// This runs in the UI's renderer before the page loads, with access to a
// small part of Electron. It exposes exactly the functions in BrowserApi as
// `window.browser` and nothing else; the UI never sees ipcRenderer itself.

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { Channels, type BrowserApi, type WindowState } from '../shared/ipc';

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
  newTab: () => ipcRenderer.send(Channels.newTab),
  closeTab: (id) => ipcRenderer.send(Channels.closeTab, id),
  activateTab: (id) => ipcRenderer.send(Channels.activateTab, id),
  moveTab: (id, toIndex) => ipcRenderer.send(Channels.moveTab, id, toIndex),
  toggleMute: (id) => ipcRenderer.send(Channels.toggleMute, id),
  tabMenu: (id) => ipcRenderer.send(Channels.tabMenu, id),
  find: (text, { forward, next }) => ipcRenderer.send(Channels.find, text, forward, next),
  stopFind: () => ipcRenderer.send(Channels.stopFind),
  resetZoom: () => ipcRenderer.send(Channels.resetZoom),
  onState: (listener) => subscribe<[WindowState]>(Channels.state, listener),
  onFocusAddress: (listener) => subscribe(Channels.focusAddress, listener),
  onFocusFind: (listener) => subscribe(Channels.focusFind, listener),
};

contextBridge.exposeInMainWorld('browser', api);
