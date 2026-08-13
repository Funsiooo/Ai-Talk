/* 连接 renderer.js 渲染进程与 main.js 主进程的通讯 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  openProxyDialog: () => ipcRenderer.invoke('open-proxy-dialog'),  // 弹出代理设置窗口
  setProxy: (proxyAddress) => ipcRenderer.invoke('set-proxy', proxyAddress),  // 设置代理
  clearProxy: () => ipcRenderer.invoke('clear-proxy'),  // 清除代理
  openVersionDialog: () => ipcRenderer.invoke('open-version-dialog'),  // 打开版本信息弹窗
  restoreSidebar: () => ipcRenderer.send('restore-sidebar-request'),
  detachWebview: (url) => ipcRenderer.invoke('detach-webview', url), // 分离到独立浏览器窗口
  openLinkWindow: (url) => ipcRenderer.invoke('open-link-window', url), // 聊天链接弹出新窗口
   // 监听 main 发来的恢复 URL 事件
  restoreWebviewUrl: (callback) =>
    ipcRenderer.on("restore-webview-url", (event, url) => callback(url)),
  // API 请求代理 - 通过主进程发送请求绕过 CORS
  apiFetch: (options) => ipcRenderer.invoke('api-fetch', options),
  // 取消指定 API 请求
  apiFetchAbort: (requestId) => ipcRenderer.invoke('api-fetch-abort', requestId),
  // 文件读写 - 本地持久化存储
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  getConfigPath: () => ipcRenderer.invoke('get-config-path'),
  listDir: (dirPath) => ipcRenderer.invoke('list-dir', dirPath),
  // 审计日志追加写入（JSONL 格式，隐私合规追溯）
  appendAuditLog: (filePath, content) => ipcRenderer.invoke('append-audit-log', filePath, content),
  // 审计日志导出（弹出保存对话框，写入文件）
  // format: 'xls' | 'csv'
  exportAuditLog: (data, filter, format) => new Promise((resolve) => {
    ipcRenderer.once('export-audit-log-reply', (event, result) => resolve(result));
    ipcRenderer.send('export-audit-log', { data: data, filter: filter, format: format || 'xls' });
  }),
  // DLP 检测记录导出（format: 'xls' | 'csv'）
  exportDlpLog: (data, format) => new Promise((resolve) => {
    ipcRenderer.once('export-dlp-log-reply', (event, result) => resolve(result));
    ipcRenderer.send('export-dlp-log', { data: data, format: format || 'xls' });
  }),
  // 使用报告导出（自包含 HTML 报告文件）
  // filename：可选默认文件名（如用户画像分析报告传「Report+时间」）
  exportReport: (data, filename) => new Promise((resolve) => {
    ipcRenderer.once('export-report-reply', (event, result) => resolve(result));
    ipcRenderer.send('export-report', { data: data, filename: filename });
  }),
  // 清空全部审计日志（audit-logs/ 目录下所有 JSONL 文件）
  clearAuditLogs: () => ipcRenderer.invoke('clear-audit-logs'),
  // 数据文件管理：打开数据目录 / 导出数据 / 导入数据（本地数据迁移、跨平台迁移）
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  exportDataFiles: () => ipcRenderer.invoke('export-data-files'),
  importDataFiles: () => ipcRenderer.invoke('import-data-files'),
  // 配置文件
  loadModelConfig: () => ipcRenderer.invoke('load-model-config'),
  // 技能商店：导入（选择 .md/.zip）、删除、获取系统默认技能 id
  importSkill: () => ipcRenderer.invoke('import-skills'),
  deleteSkill: (skillId) => ipcRenderer.invoke('delete-skill', skillId),
  getSystemSkillIds: () => ipcRenderer.invoke('get-system-skill-ids'),
  ensureBuiltinSkills: () => ipcRenderer.invoke('ensure-builtin-skills'),
  // 技能工具：工作区设置（允许访问的路径，仅只读）+ 只读工具执行
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
  getWorkspacePaths: () => ipcRenderer.invoke('get-workspace-paths'),
  chooseWorkspace: () => ipcRenderer.invoke('choose-workspace'),
  removeWorkspacePath: (p) => ipcRenderer.invoke('remove-workspace-path', p),
  checkPathInWorkspace: (filePath) => ipcRenderer.invoke('check-path-in-workspace', filePath),
  executeTool: (toolName, args, skillIds) => ipcRenderer.invoke('execute-tool', toolName, args, skillIds),
  getSkillTools: () => ipcRenderer.invoke('get-skill-tools'),
  // 发送前附件敏感数据预检：本地读取「允许访问的路径」内的文本文件内容（仅用于 DLP 检测，不外发）
  readAttachmentContent: (filePath) => ipcRenderer.invoke('read-attachment-content', filePath),
  // 附件：选择文件/文件夹（附件以路径引用形式参与对话，不读取内容）
  chooseAttachments: () => ipcRenderer.invoke('choose-attachments'),
});