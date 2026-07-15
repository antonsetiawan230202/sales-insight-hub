const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronFs", {
  getBasePath: () => ipcRenderer.invoke("app:getBasePath"),
  readJson: () => ipcRenderer.invoke("fs:readJson"),
  writeJson: (value) => ipcRenderer.invoke("fs:writeJson", value),
  listDataFiles: () => ipcRenderer.invoke("fs:listDataFiles"),
  readDataFile: (name) => ipcRenderer.invoke("fs:readDataFile", name),
  statDataFile: (name) => ipcRenderer.invoke("fs:statDataFile", name),
});
