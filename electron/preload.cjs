const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("DESKTOP", {
  isDesktop: true,
  saveAs: (src, name) => ipcRenderer.invoke("file:saveAs", src, name),
  exportPdf: (id, name) => ipcRenderer.invoke("file:exportPdf", id, name),
  pick: (kind) => ipcRenderer.invoke("file:pick", kind),
  openPath: (p) => ipcRenderer.invoke("shell:openPath", p),
  showItem: (p) => ipcRenderer.invoke("shell:showItem", p),
  openExternal: (u) => ipcRenderer.invoke("shell:openExternal", u),
});
