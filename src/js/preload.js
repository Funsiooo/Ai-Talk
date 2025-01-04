/* 连接 renderer.js 渲染进程与 main.js 主进程的通讯 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openProxyDialog: () => ipcRenderer.invoke('open-proxy-dialog'),  // 弹出代理设置窗口
  setProxy: (proxyAddress) => ipcRenderer.invoke('set-proxy', proxyAddress),  // 设置代理
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),  // 清除代理
  openVersionDialog: () => ipcRenderer.invoke('open-version-dialog')  // 清除代理
});