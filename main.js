const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const extract = require('extract-zip')

// ===== Windows Squirrel 安装事件处理 =====
if (process.platform === 'win32') {
  try {
    var squirrelCommand = process.argv[1];
    if (squirrelCommand) {
      var squirrelEvent = path.basename(squirrelCommand, '.exe').replace('squirrel-', '');
      if (['install', 'updated', 'uninstall', 'obsolete'].includes(squirrelEvent)) {
        var { spawn } = require('child_process');
        var updateExe = path.resolve(process.execPath, '..', '..', 'Update.exe');

        try { spawn(updateExe, ['--createShortcut=' + path.basename(process.execPath)], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}

        if (squirrelEvent === 'uninstall') {
          try { spawn(updateExe, ['--removeShortcut=' + path.basename(process.execPath)], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {}
        }
        if (squirrelEvent === 'obsolete') {
          app.quit();
        }
      }
    }
  } catch (e) {}
}

let mainWindow;
let proxyWindow;
let versionWindow
let detachedWindows = new Set(); // 用于跟踪所有detach-webview创建的窗口

// 跨平台 icon 路径
function getIconPath() {
  if (process.platform === 'win32') return path.join(__dirname, 'assets', 'logo.ico');
  if (process.platform === 'darwin') return path.join(__dirname, 'assets', 'logo.icns');
  return path.join(__dirname, 'assets', 'logo.png'); // linux
}

function createInAppBrowserWindow(url, options = {}) {
  if (!url || !/^https?:\/\//i.test(url)) return null;

  const session = options.session || (mainWindow && !mainWindow.isDestroyed()
    ? mainWindow.webContents.session
    : undefined);

  var win = new BrowserWindow({
    width: 1080,
    height: 745,
    icon: getIconPath(),
    title: 'Ai Talk',
    webPreferences: {
      session: session,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  attachExternalLinkHandler(win.webContents);
  win.setMenu(null);
  win.loadURL(url);

  if (options.audit !== false) {
    var logPath = path.join(getDataDir(), 'ai-talk-audit.jsonl');
    var logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      eventType: 'user_action',
      action: 'open_link',
      detail: JSON.stringify({ url: url })
    }) + '\n';
    fs.appendFileSync(logPath, logEntry, 'utf-8');
  }

  return win;
}

function attachExternalLinkHandler(contents) {
  if (!contents || contents.isDestroyed()) return;

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      createInAppBrowserWindow(url, {
        session: contents.session
      });
    }
    return { action: 'deny' };
  });
}

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    icon: getIconPath(),
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : undefined,  // macOS: 隐藏标题栏
    webPreferences: {
      devTools: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'src', 'js', 'preload.js'),
      enableRemoteModule: false,
      nodeIntegration: false,
      nativeWindowOpen: true,
      webSecurity: true,
      allowRunningInsecureContent: true,
    },
  });

  // 隐藏electron menu
  mainWindow.setMenu(null);

  // 加载初始页面
  mainWindow.loadFile(path.join(__dirname, 'src', 'view', 'index.html'));

  // 默认模式的官方站点运行在 webview 内，需要单独拦截其 target=_blank / window.open
  mainWindow.webContents.on('did-attach-webview', (event, contents) => {
    attachExternalLinkHandler(contents);
  });

  // 主窗口关闭时，关闭所有detach-webview创建的窗口
  mainWindow.on('closed', () => {
    closeAllDetachedWindows();
    mainWindow = null;
  });


}

// 创建用于输入代理的自定义窗口
function createProxyWindow() {
  proxyWindow = new BrowserWindow({
    width: 400,
    height: 250,
    icon: getIconPath(),
    parent: mainWindow,
    modal: true,
    show: false,  // 初始时不显示
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'src','js', 'preload.js')
    }
  });

  proxyWindow.setMenu(null);

  proxyWindow.loadFile(path.join(__dirname, 'src', 'view', 'proxy.html'));
  proxyWindow.once('ready-to-show', () => {
    proxyWindow.show();
  });

  // 监听关闭窗口事件
  proxyWindow.on('closed', () => {
    proxyWindow = null;
  });
}

// 关闭所有detach-webview创建的窗口
function closeAllDetachedWindows() {
  for (const win of detachedWindows) {
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }
  detachedWindows.clear();
}

// 监听渲染进程发送的请求来打开代理输入窗口
ipcMain.handle('open-proxy-dialog', () => {
  createProxyWindow();
});

// 设置代理
ipcMain.handle('set-proxy', async (event, proxyAddress) => {
  try {
    await mainWindow.webContents.session.setProxy({
      proxyRules: `http=${proxyAddress};https=${proxyAddress}`,
      proxyBypassRules: '<local>' // 可选：不通过代理的地址
    });
    mainWindow.webContents.reload(); // 设置代理后重新加载页面
    return { ok: true };
  } catch (err) {
    console.error('设置代理失败:', err);
    // 不再使用原生 dialog（带框架 logo），错误信息交回渲染进程用应用内弹窗展示
    return { ok: false, error: '无法设置代理: ' + err.message };
  }
});

// 清除代理并恢复默认设置
ipcMain.handle('clear-proxy', () => {
  mainWindow.webContents.session.clearCache() // 清除缓存
    .then(() => {
      // 恢复默认代理设置
      return mainWindow.webContents.session.setProxy({});
    })
    .then(() => {
      mainWindow.webContents.reload(); // 重新加载页面
      console.log('代理已清除，恢复默认设置');
    })
    .catch(err => {
      console.error('清除代理失败:', err);
    });
});

// 会话分身功能，将 Electron 会话窗口独立到桌面
ipcMain.handle("detach-webview", (event, url) => {
  if (!url) return;

  // 使用当前会话
  const ses = mainWindow.webContents.session;

  const win = new BrowserWindow({
    width: 1080,
    height: 745,
    icon: getIconPath(),
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  attachExternalLinkHandler(win.webContents);
  win.setMenu(null);
  win.loadURL(url);

   // 将窗口添加到跟踪集合
  detachedWindows.add(win);

  // 窗口关闭时从集合中移除并通知渲染进程恢复 webview
  win.on("closed", () => {
    detachedWindows.delete(win);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("restore-webview-url", url);
    }
  });
});

// 聊天中点击链接 → 弹出独立内置浏览器窗口
ipcMain.handle("open-link-window", (event, url) => {
  createInAppBrowserWindow(url);
});


// 创建用于输入显示“关于程序”的自定义窗口
function createVersionWindow() {
  versionWindow = new BrowserWindow({
    width: 500,
    height: 685,
    icon: getIconPath(),
    parent: mainWindow,
    modal: true,
    show: false,  // 初始时不显示
    webPreferences: {  // 关于窗口
      nodeIntegration: true,
      preload: path.join(__dirname, 'src','js', 'preload.js')
    }
  });

  versionWindow.setMenu(null);

  versionWindow.loadFile(path.join(__dirname, 'src', 'view', 'about.html'));
  versionWindow.once('ready-to-show', () => {
    versionWindow.show();
  });

  // 监听关闭窗口事件
  versionWindow.on('closed', () => {
    versionWindow = null;
  });
}

// 监听渲染进程发送的请求来打开窗口
ipcMain.handle('open-version-dialog', () => {
  createVersionWindow();
});


// 在main.js的ipcMain部分添加
ipcMain.on('restore-sidebar-request', () => {
  mainWindow.webContents.send('restore-sidebar');
});

// AbortController 映射表，用于支持停止请求
const pendingRequests = new Map();

// API 请求代理 - 解决浏览器 CORS 限制，支持通过 requestId 取消
ipcMain.handle('api-fetch', async (event, options) => {
  const { url, method, headers, body, requestId } = options;
  try {
    const controller = new AbortController();
    if (requestId) {
      pendingRequests.set(requestId, controller);
    }
    // Electron fetch 对非 Latin-1 字符会抛 ByteString 转换错误
    // （报错形如：Cannot convert argument to a ByteString ... greater than 255）
    // 因此 header 值只保留 Latin-1（\x00-\xff）范围内字符，中文等超范围字符直接剔除
    var safeHeaders = {};
    if (headers && typeof headers === 'object') {
      Object.keys(headers).forEach(function (k) {
        safeHeaders[k] = String(headers[k]).replace(/[^\x00-\xff]/g, '');
      });
    } else {
      safeHeaders['Content-Type'] = 'application/json';
    }
    // URL 中的非 ASCII 字符做百分号编码
    var safeUrl = String(url).replace(/[^\x21-\x7e]/g, function (c) {
      return encodeURIComponent(c);
    });
    const fetchOptions = {
      method: method || 'POST',
      headers: safeHeaders,
      signal: controller.signal,
    };
    if (body) {
      var bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      // body 以 UTF-8 Buffer 发送，避免字符串编码歧义
      fetchOptions.body = Buffer.from(bodyStr, 'utf-8');
    }
    const response = await fetch(safeUrl, fetchOptions);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { ok: false, status: 0, aborted: true, error: '请求已取消' };
    }
    return { ok: false, status: 0, error: err.message };
  } finally {
    if (requestId) {
      pendingRequests.delete(requestId);
    }
  }
});

// 取消指定请求
ipcMain.handle('api-fetch-abort', async (event, requestId) => {
  const controller = pendingRequests.get(requestId);
  if (controller) {
    controller.abort();
    pendingRequests.delete(requestId);
    return true;
  }
  return false;
});

// 获取数据目录（跨平台统一使用 userData，打包后可读写）
var dataPath = null;
var configPath = null;
function getDataDir() {
  if (dataPath) return dataPath;
  dataPath = path.join(app.getPath('userData'), 'data');
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  return dataPath;
}
function getConfigDir() {
  if (configPath) return configPath;
  configPath = path.join(app.getPath('userData'), 'config');
  if (!fs.existsSync(configPath)) fs.mkdirSync(configPath, { recursive: true });
  return configPath;
}

ipcMain.handle('get-data-path', () => {
  return getDataDir();
});

ipcMain.handle('get-config-path', () => {
  return getConfigDir();
});

// 获取默认配置源目录：开发时为项目根 config/；打包后优先 Resources/config（extraResources 复制），
// 若安装包缺失 Resources/config（extraResources 未生效），回退到 app.asar 内的 /config，保证内置技能仍可同步
function getSourceConfigDir() {
  var srcDir = path.join(__dirname, 'config');
  if (app.isPackaged) {
    var resDir = path.join(process.resourcesPath, 'config');
    if (fs.existsSync(resDir)) srcDir = resDir;
  }
  return srcDir;
}

// 首次启动时，将默认配置文件从应用包复制到 userData
function ensureDefaultConfig() {
  var srcDir = getSourceConfigDir();
  var destDir = getConfigDir();

  var files = ['model-config.json', 'dlp-rules.json', 'prompt-templates.json'];
  for (var i = 0; i < files.length; i++) {
    var destFile = path.join(destDir, files[i]);
    if (!fs.existsSync(destFile)) {
      var srcFile = path.join(srcDir, files[i]);
      if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
      }
    }
  }

  // 同步内置技能（文件夹式：<skills>/<名称>/SKILL.md），仅更新缺失或源更新的文件，不动用户技能
  syncBuiltinSkills(
    path.join(srcDir, 'skills'),
    path.join(destDir, 'skills')
  );
  // 旧版扁平 .md 技能迁移为文件夹式（保留用户已导入的技能）
  migrateLegacyFlatSkills();
}

// 读取本地文件
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error('读取文件失败:', err);
    return null;
  }
});

// 写入本地文件
ipcMain.handle('write-file', async (event, filePath, data) => {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, data, 'utf-8');
    return true;
  } catch (err) {
    console.error('写入文件失败:', err);
    return false;
  }
});

// 列出目录下的文件
// 递归列出目录下所有文件（返回相对路径，含子目录）
function listFilesRecursive(dir, relPrefix, result) {
  var entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return result;
  }
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i].name);
    var rel = relPrefix ? relPrefix + '/' + entries[i].name : entries[i].name;
    if (entries[i].isDirectory()) {
      listFilesRecursive(full, rel, result);
    } else if (entries[i].isFile()) {
      result.push(rel);
    }
  }
  return result;
}

ipcMain.handle('list-dir', async (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return [];
    return listFilesRecursive(dirPath, '', []);
  } catch (err) {
    console.error('列出目录失败:', err);
    return [];
  }
});

// ===== 技能商店：导入 / 删除（系统默认技能不可删除） =====

// 系统默认技能来源目录（打包后 Resources/config/skills，开发时项目 config/skills；
// Resources/config 缺失时回退 app.asar 内 /config/skills）
function getSourceSkillsDir() {
  return path.join(getSourceConfigDir(), 'skills');
}
function getDestSkillsDir() {
  return path.join(getConfigDir(), 'skills');
}

// 由名称生成一个稳定的 id（GitHub 仓库中的 SKILL.md 常只有 name、没有 id）
function slugifyId(str) {
  var s = (str || '').trim().toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'skill';
}

// 从技能 .md 的 Front Matter 中提取 id / name；有 name 无 id 时用 name 生成 id
// id/name 都要剥离首尾引号，与渲染层 YamlParser 解析保持一致。
// 否则带引号的 id（如 id: "dirscan"）在两侧解析结果不同（"dirscan" vs dirscan），
// 会造成技能能显示但删除失败、@skill 引用找不到技能。
function extractSkillMeta(raw) {
  var m = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(raw || '');
  if (!m) return null;
  var nameMatch = /^name:\s*(.+?)\s*$/m.exec(m[1]);
  var name = nameMatch ? nameMatch[1].replace(/^['"]+|['"]+$/g, '').trim() : '';
  var idMatch = /^id:\s*(.+?)\s*$/m.exec(m[1]);
  var id = idMatch ? idMatch[1].replace(/^['"]+|['"]+$/g, '').trim() : (name ? slugifyId(name) : '');
  if (!id) return null;
  return { id: id, name: name || id };
}

// 技能导入上限：单个 .md/.zip 文件不超过 10MB，超限直接拒绝并提示原因
var SKILL_IMPORT_SIZE_LIMIT = 10 * 1024 * 1024;
// zip 解压后内容总大小上限：防止小体积 zip 解压出超大内容（解压炸弹）
var SKILL_ZIP_EXTRACT_LIMIT = 50 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return bytes + 'B';
}

// 由技能 name 生成安全目录名（目录名 = 技能名称），剔除文件系统非法字符并保留可读性
function sanitizeFolderName(name) {
  var s = (name || '').trim();
  if (!s) return '';
  s = s.replace(/[\/\\:*?"<>|\x00-\x1f]/g, '-')
       .replace(/^\.+/, '')          // 去除前导点（防隐藏文件 / ..）
       .replace(/[.\s]+$/g, '')      // 去除尾部点与空格（Windows 限制）
       .replace(/\s+/g, ' ')
       .trim();
  if (!s) return '';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(s)) return '_' + s; // Windows 保留设备名
  if (s.length > 120) s = s.substring(0, 120);
  return s;
}

// 统计目录总大小（含子目录），用于 zip 解压后的内容量校验
function dirTotalSize(dir) {
  var total = 0;
  var entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return total; }
  for (var i = 0; i < entries.length; i++) {
    var full = path.join(dir, entries[i].name);
    if (entries[i].isDirectory()) {
      total += dirTotalSize(full);
    } else if (entries[i].isFile()) {
      try { total += fs.statSync(full).size; } catch (e) {}
    }
  }
  return total;
}

// 递归同步目录：目标缺失或源文件更新时才覆盖（内置技能更新，不覆盖用户技能）
function syncDirPreservingNewer(src, dest) {
  var entries = [];
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch (e) { return; }
  fs.mkdirSync(dest, { recursive: true });
  for (var i = 0; i < entries.length; i++) {
    var s = path.join(src, entries[i].name);
    var d = path.join(dest, entries[i].name);
    if (entries[i].isDirectory()) {
      syncDirPreservingNewer(s, d);
    } else if (entries[i].isFile()) {
      try {
        if (!fs.existsSync(d) || fs.statSync(s).mtimeMs > fs.statSync(d).mtimeMs) {
          fs.copyFileSync(s, d);
        }
      } catch (e) {}
    }
  }
}

// 同步内置技能（新版为文件夹式：<skills>/<名称>/SKILL.md）
// 仅同步白名单内的系统内置技能；用户自行放入源码目录的技能不会被当作内置同步/保护
// 目标目录中若存在同名但不同 id 的文件夹，视为用户自定义技能，不覆盖
function syncBuiltinSkills(srcSkillsDir, destSkillsDir) {
  if (!fs.existsSync(srcSkillsDir)) return;
  fs.mkdirSync(destSkillsDir, { recursive: true });
  var entries = [];
  try { entries = fs.readdirSync(srcSkillsDir, { withFileTypes: true }); } catch (e) { return; }
  for (var i = 0; i < entries.length; i++) {
    if (!entries[i].isDirectory()) continue;
    var srcFolder = path.join(srcSkillsDir, entries[i].name);
    var entry = findSkillMdInDir(srcFolder);
    if (!entry) continue;
    var srcMeta = null;
    try { srcMeta = extractSkillMeta(fs.readFileSync(entry, 'utf-8')); } catch (e) {}
    if (!srcMeta || SYSTEM_SKILL_IDS.indexOf(srcMeta.id) === -1) continue; // 非系统内置，跳过同步
    var destFolder = path.join(destSkillsDir, entries[i].name);
    if (fs.existsSync(destFolder)) {
      var destEntry = findSkillMdInDir(destFolder);
      var sameBuiltin = false;
      if (destEntry) {
        try {
          var destMeta = extractSkillMeta(fs.readFileSync(destEntry, 'utf-8'));
          sameBuiltin = destMeta && destMeta.id === srcMeta.id;
        } catch (e) {}
      }
      if (!sameBuiltin) continue; // 用户同名自定义技能，不覆盖
      syncDirPreservingNewer(srcFolder, destFolder);
    } else {
      copyDirRecursive(srcFolder, destFolder);
    }
  }
}

// 旧版扁平 .md 技能迁移：<skills>/xxx.md → <skills>/<名称>/SKILL.md（保留用户已导入的技能）
function migrateLegacyFlatSkills() {
  var destDir = getDestSkillsDir();
  if (!fs.existsSync(destDir)) return;
  var entries = [];
  try { entries = fs.readdirSync(destDir, { withFileTypes: true }); } catch (e) { return; }
  for (var i = 0; i < entries.length; i++) {
    if (!entries[i].isFile() || !entries[i].name.toLowerCase().endsWith('.md')) continue;
    var file = path.join(destDir, entries[i].name);
    var raw;
    try { raw = fs.readFileSync(file, 'utf-8'); } catch (e) { continue; }
    var meta = extractSkillMeta(raw);
    if (!meta) continue;
    var folder = sanitizeFolderName(meta.name) || meta.id;
    var destFolder = path.join(destDir, folder);
    if (fs.existsSync(destFolder)) {
      // 同名文件夹已存在（可能是新内置），直接清理旧扁平文件
      try { fs.unlinkSync(file); } catch (e) {}
      continue;
    }
    try {
      fs.mkdirSync(destFolder, { recursive: true });
      fs.writeFileSync(path.join(destFolder, 'SKILL.md'), ensureSkillId(raw, meta.id), 'utf-8');
      fs.unlinkSync(file);
    } catch (e) {
      console.warn('[Skills] 迁移旧版技能失败:', file, e);
    }
  }
}

// 随应用发布的系统内置技能 id 白名单（不可删除、启动自动同步、导入重名检测）。
// 只有白名单内的技能才被视为「系统默认」；
// 用户通过导入或手动复制放入技能目录的技能，一律视为用户技能（可删除、可在 @skill 中引用）。
var SYSTEM_SKILL_IDS = ['optimize', 'memory', 'translate', 'user-insight'];

// 读取系统默认技能的 id 列表（不可删除 / 导入重名检测）
function getSystemSkillIds() {
  var src = getSourceSkillsDir();
  if (!fs.existsSync(src)) return SYSTEM_SKILL_IDS.slice();
  var folders = collectSkillFolders(src, []);
  var ids = [];
  for (var i = 0; i < folders.length; i++) {
    var entry = findSkillMdInDir(folders[i]);
    if (!entry) continue;
    try {
      var meta = extractSkillMeta(fs.readFileSync(entry, 'utf-8'));
      if (meta && meta.id && SYSTEM_SKILL_IDS.indexOf(meta.id) !== -1) ids.push(meta.id);
    } catch (e) {}
  }
  return ids;
}

// 同步内置技能到用户目录（打开技能商店时调用，新增内置技能无需重启应用即可生效）
ipcMain.handle('ensure-builtin-skills', function () {
  try {
    syncBuiltinSkills(getSourceSkillsDir(), getDestSkillsDir());
    return true;
  } catch (e) {
    console.error('[Skills] 内置技能同步失败:', e);
    return false;
  }
});

// 收集技能目录下已占用的目录名（含内置技能），导入时做同名检测。
// 只有「含 SKILL.md 入口」的目录才算已占用；用户放的其他资源目录不阻塞导入
function getOccupiedSkillFolderNames() {
  var destDir = getDestSkillsDir();
  var names = {};
  if (!fs.existsSync(destDir)) return names;
  var entries = fs.readdirSync(destDir, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].isDirectory() && findSkillMdInDir(path.join(destDir, entries[i].name))) {
      names[entries[i].name] = true;
    }
  }
  return names;
}

// 收集技能目录下所有已存在的技能 id（含内置技能），导入时做 id 重名检测
function getExistingSkillIds(destDir) {
  var ids = {};
  if (!fs.existsSync(destDir)) return ids;
  var folders = collectSkillFolders(destDir, []);
  for (var i = 0; i < folders.length; i++) {
    var entry = findSkillMdInDir(folders[i]);
    if (!entry) continue;
    try {
      var meta = extractSkillMeta(fs.readFileSync(entry, 'utf-8'));
      if (meta && meta.id) ids[meta.id] = true;
    } catch (e) {}
  }
  return ids;
}

// 在目录中查找 SKILL.md（不区分大小写，仅当前层级），返回绝对路径或 null
function findSkillMdInDir(dir) {
  var entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return null; }
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].isFile() && entries[i].name.toLowerCase() === 'skill.md') {
      return path.join(dir, entries[i].name);
    }
  }
  return null;
}

// 递归收集「含 SKILL.md 的文件夹」作为 skill 文件夹；命中后不再下钻，避免嵌套重复计入
function collectSkillFolders(dir, result) {
  var base = path.basename(dir);
  // 跳过明显的构建/依赖目录；.trae/.claude/.cursor 等技能容器目录允许进入
  if (/^(node_modules|dist|build|\.git|\.idea|\.vscode|__pycache__|\.venv|venv|coverage|\.cache|\.next|\.nuxt|out|target|__MACOSX)$/i.test(base)) {
    return result;
  }
  if (findSkillMdInDir(dir)) {
    result.push(dir);
    return result;
  }
  var entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return result; }
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].isDirectory()) {
      collectSkillFolders(path.join(dir, entries[i].name), result);
    }
  }
  return result;
}

// 递归复制目录（保留子目录结构与全部文件）
// skipFileNames：小写文件名 → true 的映射，命中则跳过（跳过入口 skill.md，
// 避免覆盖 writeSkillFolder 已写入的规范 SKILL.md）
function copyDirRecursive(src, dest, skipFileNames) {
  // 先建目标目录，避免复制时父目录不存在
  fs.mkdirSync(dest, { recursive: true });
  var entries = [];
  try { entries = fs.readdirSync(src, { withFileTypes: true }); } catch (e) { return; }
  for (var i = 0; i < entries.length; i++) {
    var s = path.join(src, entries[i].name);
    var d = path.join(dest, entries[i].name);
    if (entries[i].isDirectory()) {
      if (/^(__MACOSX)$/i.test(entries[i].name)) continue; // 跳过解压噪音目录
      fs.mkdirSync(d, { recursive: true });
      copyDirRecursive(s, d, skipFileNames);
    } else if (entries[i].isFile()) {
      if (/^(\.ds_store|thumbs\.db|desktop\.ini)$/i.test(entries[i].name)) continue;
      if (skipFileNames && skipFileNames[entries[i].name.toLowerCase()]) continue;
      try { fs.copyFileSync(s, d); } catch (e) {}
    }
  }
}

// 保证 Front Matter 中写入规范 id：无 id 时由 name 生成并插入；已有 id 时统一去掉引号，
// 使磁盘上的 id 与解析层（extractSkillMeta / 渲染层 YamlParser）解析结果一致，
// 避免带引号 id 造成「能显示但删除/引用失败」。
function ensureSkillId(raw, finalId) {
  var fmMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(raw || '');
  if (!fmMatch) return raw;
  var fm = fmMatch[1];
  if (/^id:\s*\S/m.test(fm)) {
    var newFm = fm.replace(/^id:\s*.+$/m, 'id: ' + finalId);
    return raw.replace(fmMatch[0], '---\n' + newFm + '\n---');
  }
  return raw.replace(fmMatch[0], '---\nid: ' + finalId + '\n' + fm + '\n---');
}

// 导入时剥离 frontmatter 中的 builtin 标记：导入的是用户自定义技能，不应被当作系统内置技能隐藏
function stripBuiltinFlag(raw) {
  var fmMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(raw || '');
  if (!fmMatch) return raw;
  var fm = fmMatch[1];
  if (!/^builtin\s*:\s*(true|yes|1)\b/m.test(fm)) return raw;
  var newFm = fm.replace(/^builtin\s*:\s*(true|yes|1)\b[^\r\n]*\r?\n?/m, '');
  return '---\n' + newFm + '\n---';
}

// 将技能写入 <skills>/<名称>/SKILL.md（目录名 = 技能名称，唯一化冲突检测）
// 返回 { id, name, filename, dir } 或 null（写入 skipped 说明原因）
// defaultIds：系统内置技能 id（禁止覆盖）；existingIds：当前技能目录中已存在的所有技能 id（禁止重复 id）
function writeSkillFolder(destDir, meta, raw, entryName, skipped, usedFolders, defaultIds, existingIds) {
  var finalId = meta.id;
  if (defaultIds.indexOf(finalId) !== -1) {
    skipped.push({ filename: entryName, reason: '与系统默认技能重名（id: ' + finalId + '），已跳过' });
    return null;
  }
  if (existingIds && existingIds[finalId]) {
    skipped.push({ filename: entryName, reason: '技能 id「' + finalId + '」已存在，已跳过' });
    return null;
  }
  var folder = sanitizeFolderName(meta.name) || finalId;
  var destFolder = path.join(destDir, folder);
  // 同名目录已存在时：仅当该目录已含 SKILL.md（是真实技能）才视为重名跳过；
  // 用户手动放置的资源目录（如 dirsearch 仓库）不阻塞导入，SKILL.md 直接写入该目录
  if (usedFolders[folder] || (fs.existsSync(destFolder) && findSkillMdInDir(destFolder))) {
    skipped.push({ filename: entryName, reason: '同名技能「' + meta.name + '」已存在，已跳过' });
    return null;
  }
  fs.mkdirSync(destFolder, { recursive: true });
  // 一次性写入规范内容：id 去引号 + 剥离 builtin 标记（导入的是用户技能，不应被当作系统内置隐藏）
  fs.writeFileSync(path.join(destFolder, 'SKILL.md'), ensureSkillId(stripBuiltinFlag(raw), finalId), 'utf-8');
  usedFolders[folder] = true;
  if (existingIds) existingIds[finalId] = true;
  return { id: finalId, name: meta.name, filename: 'SKILL.md', dir: folder };
}

// 导入单个 .md：包装为 <skills>/<名称>/SKILL.md 文件夹
function importSingleMdFile(src, destDir, skipped, usedFolders, defaultIds, existingIds) {
  try {
    var stat = fs.statSync(src);
    if (stat.size > SKILL_IMPORT_SIZE_LIMIT) {
      skipped.push({ filename: path.basename(src), reason: '文件超过 10MB 上限（' + formatSize(stat.size) + '），已拒绝' });
      return null;
    }
    var raw = fs.readFileSync(src, 'utf-8');
    var meta = extractSkillMeta(raw);
    if (!meta) {
      skipped.push({ filename: path.basename(src), reason: '不是有效的技能文件（缺少 Front Matter / id）' });
      return null;
    }
    return writeSkillFolder(destDir, meta, raw, path.basename(src), skipped, usedFolders, defaultIds, existingIds);
  } catch (e) {
    skipped.push({ filename: path.basename(src), reason: '读取失败' });
    return null;
  }
}

// 导入技能主流程：selected 为用户选择的 .md / .zip 文件
// 规则：入口文件必须是 skill.md（或 SKILL.md）；每个技能在 <skills>/<名称>/ 下独立成目录
async function importSkills(selected) {
  var destDir = getDestSkillsDir();
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  var ext = path.extname(selected).toLowerCase();
  if (ext !== '.md' && ext !== '.zip') {
    return { imported: [], skipped: [], error: '不支持的文件类型（仅支持 .md / .zip）' };
  }

  // 文件大小限制：超过 10MB 直接拒绝
  var stat = fs.statSync(selected);
  if (stat.size > SKILL_IMPORT_SIZE_LIMIT) {
    return { imported: [], skipped: [], error: '文件超过 10MB 上限（' + formatSize(stat.size) + '），已拒绝导入。请精简或压缩技能文件后再试。' };
  }

  var defaultIds = getSystemSkillIds();
  var usedFolders = getOccupiedSkillFolderNames();
  var existingIds = getExistingSkillIds(destDir); // 当前已存在的所有技能 id，用于导入时 id 重名检测
  var imported = [];
  var skipped = [];

  var tempDir = null;
  try {
    if (ext === '.md') {
      var r = importSingleMdFile(selected, destDir, skipped, usedFolders, defaultIds, existingIds);
      if (r) imported.push(r);
    } else {
      // zip：解压到临时目录，仅「含 SKILL.md 的文件夹」视为可导入技能
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-talk-skill-'));
      await extract(selected, { dir: tempDir });
      // 防解压炸弹：解压后内容总大小上限
      if (dirTotalSize(tempDir) > SKILL_ZIP_EXTRACT_LIMIT) {
        return { imported: [], skipped: [], error: '压缩包解压后内容超过 50MB，已拒绝导入（疑似异常压缩包）' };
      }
      var folders = collectSkillFolders(tempDir, []);
      if (folders.length === 0) {
        return { imported: [], skipped: [], error: '压缩包内未找到 skill.md（或 SKILL.md）入口文件。入口必须是 SKILL.md，请参考商店中的「编写模板」。' };
      }
      for (var i = 0; i < folders.length; i++) {
        var skillDir = folders[i];
        var entry = findSkillMdInDir(skillDir);
        if (!entry) continue;
        var relFolder = path.relative(tempDir, skillDir).replace(/\\/g, '/') || '';
        try {
          // 单个技能内容量限制：目录总大小 > 10MB 拒绝
          if (dirTotalSize(skillDir) > SKILL_IMPORT_SIZE_LIMIT) {
            skipped.push({ filename: relFolder + '/SKILL.md', reason: '技能内容超过 10MB 上限，已拒绝' });
            continue;
          }
          var raw = fs.readFileSync(entry, 'utf-8');
          var meta = extractSkillMeta(raw);
          if (!meta) {
            skipped.push({ filename: relFolder + '/SKILL.md', reason: '不是有效的技能文件（缺少 Front Matter / id）' });
            continue;
          }
          var r2 = writeSkillFolder(destDir, meta, raw, relFolder + '/SKILL.md', skipped, usedFolders, defaultIds, existingIds);
          if (!r2) continue;
          // 整个文件夹复制为 <skills>/<名称>/（保留脚本/资源，访问需在入口文件声明）。
          // 跳过入口 skill.md/SKILL.md：规范内容（id 去引号 + 剥离 builtin）已由
          // writeSkillFolder 写入目标 SKILL.md，避免大小写变体在 macOS 上互相覆盖
          var destFolder = path.join(destDir, r2.dir);
          copyDirRecursive(skillDir, destFolder, { 'skill.md': true });
          imported.push(r2);
        } catch (e) {
          skipped.push({ filename: relFolder + '/SKILL.md', reason: '读取失败' });
        }
      }
    }
    return { imported: imported, skipped: skipped, error: null };
  } finally {
    if (tempDir) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    }
  }
}

// 获取系统默认技能 id 列表（供商店区分「不可删除」的技能）
ipcMain.handle('get-system-skill-ids', async () => {
  return getSystemSkillIds();
});

// 导入技能：弹出文件选择框，支持 .md 与 .zip（单个文件不超过 10MB）
ipcMain.handle('import-skills', async (event) => {
  var win = BrowserWindow.fromWebContents(event.sender);
  var result = await dialog.showOpenDialog(win, {
    title: '导入技能（.md / .zip，单个文件不超过 10MB）',
    properties: ['openFile'],
    filters: [
      { name: '技能文件', extensions: ['md', 'zip'] }
    ]
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  try {
    var out = await importSkills(result.filePaths[0]);
    return {
      success: out.imported.length > 0,
      imported: out.imported,
      skipped: out.skipped,
      error: out.error || (out.imported.length === 0
        ? (out.skipped.length > 0
            ? '未找到可导入的技能（跳过 ' + out.skipped.length + ' 个，如 "' + out.skipped[0].filename + '"：' + out.skipped[0].reason + '）'
            : '未找到可导入的技能')
        : null)
    };
  } catch (err) {
    console.error('导入技能失败:', err);
    return { success: false, error: err.message || '导入失败' };
  }
});

// ===== 技能工具沙箱：统一以「技能商店 → 允许访问的路径（全局工作区）」为唯一根目录（仅只读） =====
// 每个技能不再单独授权目录；用户只需在技能商店中设置允许访问的路径，所有技能共用。
// 除已设置路径内的文件外，其他路径一律无法读取。

// 路径容器校验：绝对路径须位于任一允许访问根目录内（防 ../ 与符号链接逃逸）
function resolveAuthorized(relPath, roots) {
  if (typeof relPath !== 'string' || relPath.trim() === '') return { error: '缺少路径参数' };
  var p = relPath.trim();
  for (var i = 0; i < roots.length; i++) {
    var ws = roots[i];
    var abs = path.resolve(ws, p);
    var realWs;
    try { realWs = fs.realpathSync(ws); } catch (e) { realWs = ws; }
    var checkAbs = abs;
    try { if (fs.existsSync(abs)) checkAbs = fs.realpathSync(abs); } catch (e) {}
    var rel = path.relative(realWs, checkAbs);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
      return { abs: abs, real: checkAbs, root: realWs };
    }
  }
  return { error: '路径超出允许访问范围，已拒绝: ' + relPath };
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSkillRel(s) {
  s = String(s || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
  if (s === '/' || s === '.' || s === '') return '';
  return s;
}

// 解析入口文件中声明的可访问资源：
// 1) Front Matter files 字段（列表）
// 2) systemPrompt / 正文中显式出现的 @skill:<id>/<相对路径> 引用
// 未声明的文件一律拒绝读取（“必须先定义调用规则，否则不得执行”）
function getDeclaredSkillFiles(raw, skillId) {
  var allowed = new Set();
  function add(s) {
    s = normalizeSkillRel(s);
    if (!s) return;
    allowed.add(s);
    allowed.add(s.toLowerCase());
  }
  var fmMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---/.exec(raw || '');
  var fm = fmMatch ? fmMatch[1] : '';
  var filesMatch = /^files:\s*(.*)$/m.exec(fm);
  if (filesMatch) {
    var inline = (filesMatch[1] || '').trim();
    if (inline) {
      // 内联列表：files: [a, b] 或 files: a, b
      var inlineItems = inline.replace(/^\[|\]$/g, '').split(',').map(function (x) { return x.trim(); });
      for (var k = 0; k < inlineItems.length; k++) {
        if (inlineItems[k]) add(inlineItems[k]);
      }
    } else {
      var seg = fm.substring(filesMatch.index + filesMatch[0].length);
      var lines = seg.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var lm = /^\s*-\s*(.+?)\s*$/.exec(lines[i]);
        if (!lm) break;
        add(lm[1]);
      }
    }
  }
  var re = new RegExp('@skill:' + escapeRegExp(skillId) + '/([^\\s"\'`<>]+)', 'g');
  // 句子标点截断集合（仅当紧贴路径时生效）。
  // . 与 - 是文件名核心字符（扩展名、连字符），不能进截断集合，
  // 否则会把 RECONNAISSANCE.md 截成 RECONNAISSANCE；英文句号紧贴路径时改用尾部剥离。
  var DELIM = '（），。、；：！？「」『』【】《》〈〉…—,;:!?';
  function cutToken(tok) {
    var cut = -1;
    for (var c = 0; c < DELIM.length; c++) {
      var idx = tok.indexOf(DELIM.charAt(c));
      if (idx !== -1 && (cut === -1 || idx < cut)) cut = idx;
    }
    if (cut !== -1) tok = tok.slice(0, cut);
    return tok.replace(/\.+$/, '');
  }
  var m;
  while ((m = re.exec(raw || '')) !== null) {
    var tok = cutToken(m[1]);
    try { add(decodeURIComponent(tok)); } catch (e) { add(tok); }
  }
  return allowed;
}

// 相对路径是否在声明集合内（支持目录前缀声明，如 files: [scripts/]）
function isDeclaredFile(relReal, allowed) {
  if (!allowed || allowed.size === 0) return false;
  var norm = normalizeSkillRel(relReal);
  if (!norm) return false;
  if (allowed.has(norm) || allowed.has(norm.toLowerCase())) return true;
  var values = Array.from(allowed);
  for (var i = 0; i < values.length; i++) {
    var low = values[i].toLowerCase();
    if (low.endsWith('/') && norm.toLowerCase().indexOf(low) === 0) return true;
  }
  return false;
}

// 解析 @skill:<id>/<rel>：容器校验 + read_file 需入口声明（list_dir 仅列目录名，放行）
function resolveSkillOwnFile(skillId, relInSkill, toolName) {
  var skillDir = findSkillDirById(skillId);
  if (!skillDir) return { error: '未找到技能: ' + skillId };
  var rel = (relInSkill == null || relInSkill === '') ? '' : relInSkill;
  var abs = path.resolve(skillDir, rel);
  var realSkill;
  try { realSkill = fs.realpathSync(skillDir); } catch (e) { realSkill = skillDir; }
  var checkAbs = abs;
  try { if (fs.existsSync(abs)) checkAbs = fs.realpathSync(abs); } catch (e) {}
  var relReal = path.relative(realSkill, checkAbs);
  if (relReal === '' || relReal.startsWith('..') || path.isAbsolute(relReal)) {
    return { error: '路径超出技能目录，已拒绝: @skill:' + skillId + '/' + rel };
  }
  // 入口文件（skill.md / SKILL.md）始终可读；其余文件需在入口中声明
  if (toolName === 'read_file' && rel !== '' && path.basename(checkAbs).toLowerCase() !== 'skill.md') {
    var entry = findSkillMdInDir(skillDir);
    var allowed = null;
    if (entry) {
      try { allowed = getDeclaredSkillFiles(fs.readFileSync(entry, 'utf-8'), skillId); } catch (e) {}
    }
    if (!allowed || !isDeclaredFile(relReal, allowed)) {
      return { error: '该资源未在入口文件（SKILL.md）中声明，已拒绝读取。请在 SKILL.md 的 files 字段中声明（如 files: [scripts/scan.py]），或在 systemPrompt 中以 @skill:' + skillId + '/<相对路径> 引用后再访问。' };
    }
  }
  return { abs: abs, real: checkAbs, root: skillDir };
}

// 技能工具路径解析（读权限沙箱）：
// - @skill: 前缀 → 技能自带目录（read_file 需入口声明）
// - 相对路径/绝对路径 → 解析到「技能商店中设置的允许访问路径（全局工作区）」；
//   未设置任何路径时拒绝访问（仅只读，其他路径一律无法读取）
async function resolveSkillPathForCall(event, toolName, relPath, skillIds) {
  var p = (relPath || '').trim();
  var sm = /^@skill:([^/]+)(?:\/([\s\S]*))?$/.exec(p);
  if (sm) return resolveSkillOwnFile(sm[1], sm[2], toolName);
  var roots = getWorkspacePaths();
  if (!roots.length) {
    return { error: '未设置允许访问的路径，已拒绝读取。请在「技能商店 → 允许访问的路径」中添加要读取的文件夹（仅只读）。' };
  }
  return resolveAuthorized(p, roots);
}

// 在目录中递归查找指定 id 的技能入口文件，返回绝对路径或 null（优先 SKILL.md）
// 命中 SKILL.md 入口后立即停止整树搜索，避免继续遍历兄弟目录
function findSkillFileRecursive(dir, skillId) {
  var fallback = null;
  var found = false;
  function walk(d) {
    if (found) return;
    var entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (var i = 0; i < entries.length; i++) {
      if (found) return;
      var full = path.join(d, entries[i].name);
      if (entries[i].isDirectory()) {
        walk(full);
      } else if (entries[i].isFile() && entries[i].name.toLowerCase().endsWith('.md')) {
        try {
          var meta = extractSkillMeta(fs.readFileSync(full, 'utf-8'));
          if (meta && meta.id === skillId) {
            if (entries[i].name.toLowerCase() === 'skill.md') { fallback = full; found = true; return; }
            if (!fallback) fallback = full;
          }
        } catch (e) {}
      }
    }
  }
  walk(dir);
  return fallback;
}

// 删除技能：系统默认技能不可删除
ipcMain.handle('delete-skill', async (event, skillId) => {
  if (!skillId) return { success: false, error: '缺少技能 ID' };
  var destDir = getDestSkillsDir();
  if (!fs.existsSync(destDir)) return { success: false, error: '技能目录不存在' };
  if (getSystemSkillIds().indexOf(skillId) !== -1) {
    return { success: false, error: '系统默认技能不可删除' };
  }
  var filePath = findSkillFileRecursive(destDir, skillId);
  if (!filePath) return { success: false, error: '未找到该技能' };
  try {
    // 文件夹型技能（直接位于技能目录下的子文件夹）：整个文件夹一并删除，保留配套脚本/资源清理干净
    var parent = path.dirname(filePath);
    var toDelete = filePath;
    if (parent !== destDir && path.dirname(parent) === destDir) {
      toDelete = parent;
    }
    fs.rmSync(toDelete, { recursive: true, force: true });
    // 清理删除后遗留的空目录
    parent = path.dirname(toDelete);
    while (parent !== destDir && parent.indexOf(destDir) === 0) {
      try {
        if (fs.readdirSync(parent).length === 0) {
          fs.rmdirSync(parent);
          parent = path.dirname(parent);
        } else {
          break;
        }
      } catch (e) { break; }
    }
    return { success: true, deleted: { id: skillId, filename: path.relative(destDir, toDelete) } };
  } catch (e) {
    return { success: false, error: '删除失败：' + e.message };
  }
});

// ===== 技能工具：本地文件只读访问（工作区沙箱） =====

// 单次读取上限（字节）与整读阈值（字节）
// 参考市面常见限制：Claude 项目文件单文件 30MB；超过整读阈值的文件按 offset/length 分段读取，
// 避免一次读入撑爆上下文
var SKILL_READ_CHUNK = 1024 * 1024;        // 默认单次最多读取 1MB
var SKILL_READ_FULL_LIMIT = 30 * 1024 * 1024; // 文件 ≤30MB 可直接整体读取

// ===== walk_dir / scan_sensitive 扫描限制 =====
var SCAN_MAX_FILES = 500;                 // 单次最多扫描文件数
var SCAN_MAX_DEPTH = 8;                   // 默认递归深度
var SCAN_MAX_FILE_BYTES = 1024 * 1024;    // 单文件扫描上限 1MB（超出跳过登记）
var SCAN_MAX_TOTAL_BYTES = 20 * 1024 * 1024; // 单次扫描累计上限 20MB
// 文本文件扩展名白名单（其余按二进制跳过，仅登记不读内容）
var SCAN_TEXT_EXTS = ['.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.java',
  '.c', '.h', '.cpp', '.hpp', '.rb', '.php', '.sh', '.bat', '.ps1', '.yaml', '.yml', '.toml',
  '.ini', '.cfg', '.conf', '.env', '.xml', '.html', '.htm', '.css', '.scss', '.sql', '.log',
  '.csv', '.tsv', '.properties', '.gradle', '.lock', '.sample', '.example'];

// 递归遍历目录（沙箱内调用），返回文件/目录相对路径清单
function walkDirEntries(absDir, opts) {
  opts = opts || {};
  var files = [];
  var dirs = [];
  var maxDepth = Math.min(32, Math.max(1, parseInt(opts.maxDepth, 10) || SCAN_MAX_DEPTH));
  var maxEntries = Math.min(10000, Math.max(1, parseInt(opts.maxEntries, 10) || 2000));
  var includeHidden = !!opts.includeHidden;
  var includeDotfiles = !!opts.includeDotfiles; // 仅文件：.env/.gitignore 等放行，隐藏目录仍跳过
  var truncated = false;
  var entryCount = 0;
  function walk(dir, rel, depth) {
    if (truncated) return;
    var list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    for (var i = 0; i < list.length; i++) {
      if (truncated) return;
      var en = list[i];
      if (/^\./.test(en.name) && !includeHidden) {
        if (en.isDirectory()) continue;      // 隐藏目录（.git/.node_modules）默认始终跳过
        if (!includeDotfiles) continue;      // 隐藏文件默认跳过，扫描时可放行
      }
      var childRel = rel ? rel + '/' + en.name : en.name;
      var childAbs = path.join(dir, en.name);
      if (en.isDirectory()) {
        dirs.push(childRel);
        if (depth < maxDepth) walk(childAbs, childRel, depth + 1);
      } else {
        var sz = 0;
        try { sz = fs.statSync(childAbs).size; } catch (e) {}
        files.push({ abs: childAbs, rel: childRel, size: sz });
      }
      entryCount++;
      if (entryCount >= maxEntries) { truncated = true; return; }
    }
  }
  walk(absDir, '', 0);
  return { files: files, dirs: dirs, truncated: truncated, fileCount: files.length, dirCount: dirs.length };
}

// 目录树文本（walk_dir 工具输出）
function collectDirTree(absDir, opts) {
  var w = walkDirEntries(absDir, opts);
  var lines = [];
  for (var i = 0; i < w.dirs.length; i++) lines.push(w.dirs[i] + '/');
  for (var j = 0; j < w.files.length; j++) {
    var f = w.files[j];
    lines.push(f.rel + '  (' + formatSize(f.size) + ')');
  }
  return { lines: lines, dirCount: w.dirCount, fileCount: w.fileCount, truncated: w.truncated };
}

// 扫描目录文本文件内容（scan_sensitive 工具）：返回可供 DLP 检测的内容，不落盘
function scanSensitiveDir(absDir, opts) {
  var w = walkDirEntries(absDir, Object.assign({}, opts, { maxDepth: SCAN_MAX_DEPTH, includeDotfiles: true }));
  var scanned = [];          // { rel, content }
  var scannedBytes = 0;
  var skippedBinary = 0;
  var skippedLarge = 0;
  var truncated = w.truncated;
  for (var i = 0; i < w.files.length; i++) {
    if (scanned.length >= SCAN_MAX_FILES || scannedBytes >= SCAN_MAX_TOTAL_BYTES) { truncated = true; break; }
    var f = w.files[i];
    if (f.size > SCAN_MAX_FILE_BYTES) { skippedLarge++; continue; }
    // 扩展名白名单；无扩展名的点文件（.env/.gitignore/.npmrc 等）也按文本候选处理，由下方 null 字节嗅探兜底
    var ext = path.extname(f.rel).toLowerCase();
    var isText = SCAN_TEXT_EXTS.indexOf(ext) !== -1 || (ext === '' && /^\..+$/.test(path.basename(f.rel)));
    if (!isText) { skippedBinary++; continue; }
    var fd;
    try { fd = fs.openSync(f.abs, 'r'); } catch (e) { continue; }
    var buf = Buffer.alloc(Math.max(1, Math.min(f.size || 0, SCAN_MAX_FILE_BYTES)));
    var bytes = 0;
    try { bytes = fs.readSync(fd, buf, 0, buf.length, 0); } finally { fs.closeSync(fd); }
    if (!bytes) continue;
    var content = buf.toString('utf-8', 0, bytes);
    if (content.indexOf('\u0000') !== -1) { skippedBinary++; continue; }
    scannedBytes += bytes;
    scanned.push({ rel: f.rel, content: content });
  }
  return {
    filesTotal: w.fileCount,
    scanned: scanned,
    scannedBytes: scannedBytes,
    skippedBinary: skippedBinary,
    skippedLarge: skippedLarge,
    truncated: truncated
  };
}

// 内置工具注册表（name → OpenAI function schema）
// 技能在 front matter 中通过 tools 字段声明，引用即授权；执行始终受「允许访问的路径」沙箱约束（仅只读）
var SKILL_TOOLS = {
  read_file: {
    name: 'read_file',
    description: '读取文件内容（UTF-8 文本）。文件不超过 30MB 时可直接整体读取；更大文件需用 offset/length 分段读取（单次最多 1MB）。路径必须是相对「技能商店 → 允许访问的路径」的相对路径（不要用绝对路径），只能读取已设置路径内的文件，只读。技能自带文件用 @skill:<技能id>/<相对路径> 访问（如 @skill:security-audit/scripts/scan.py），且该文件必须已在 SKILL.md 中声明。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对「允许访问的路径」的相对路径（不要用绝对路径），如 docs/readme.md；技能自带文件必须用 @skill:<技能id>/<相对路径>（如 @skill:security-audit/scripts/scan.py）' },
        offset: { type: 'number', description: '起始读取位置（字节偏移，默认 0）；配合 length 分页读取大文件' },
        length: { type: 'number', description: '本次最多读取的字节数（默认 1048576，即 1MB）' }
      },
      required: ['path']
    }
  },
  list_dir: {
    name: 'list_dir',
    description: '列出目录下的文件与子目录（目录名以 / 结尾），便于了解项目结构。path 使用相对「允许访问的路径」的相对路径（不要用绝对路径）；技能自带目录用 @skill:<技能id>/（如 @skill:security-audit/）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对「允许访问的路径」的目录路径（不要用绝对路径），缺省为根目录；技能自带目录用 @skill:<技能id>/' }
      },
      required: []
    }
  },
  walk_dir: {
    name: 'walk_dir',
    description: '递归遍历目录，一次性返回完整目录树（目录带 / 后缀，文件标注大小），用于分析前摸清目录结构。path 使用相对「允许访问的路径」的相对路径（不要用绝对路径）。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对「允许访问的路径」的目录路径（不要用绝对路径），缺省为根目录' },
        maxDepth: { type: 'number', description: '最大递归深度，默认 8，最大 32' },
        maxEntries: { type: 'number', description: '最多返回条目数，默认 2000，超出截断' },
        includeHidden: { type: 'boolean', description: '是否包含隐藏文件/目录（默认 false，跳过 .git/.node_modules 等）' }
      },
      required: []
    }
  },
  scan_sensitive: {
    name: 'scan_sensitive',
    description: '对目录做全量敏感数据预扫描：遍历文本文件并交给本地 DLP 规则检测（身份证、手机号、银行卡、密钥、口令等）。检测命中时系统会弹窗询问用户处理方式，并在结果中告知你后续读取策略（自动打码 / 跳过 / 取消）。path 使用相对「允许访问的路径」的相对路径。',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对「允许访问的路径」的目录路径（不要用绝对路径），缺省为根目录' },
        maxDepth: { type: 'number', description: '最大递归深度，默认 8' },
        maxEntries: { type: 'number', description: '最多扫描文件数，默认 500，超出截断' }
      },
      required: []
    }
  }
};

var _workspacePaths = null;
var WORKSPACE_FILE = 'ai-talk-workspace.json';

// 读取全部允许访问的工作区路径（空数组表示未设置）；兼容旧版单路径 { path }
function getWorkspacePaths() {
  if (_workspacePaths) return _workspacePaths;
  try {
    var f = path.join(getConfigDir(), WORKSPACE_FILE);
    if (fs.existsSync(f)) {
      var data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      if (Array.isArray(data.paths) && data.paths.length > 0) {
        _workspacePaths = data.paths.filter(function (p) { return p && fs.existsSync(p); });
        return _workspacePaths;
      }
      if (data && data.path && fs.existsSync(data.path)) {
        _workspacePaths = [data.path];
        return _workspacePaths;
      }
    }
  } catch (e) {}
  _workspacePaths = [];
  return _workspacePaths;
}

function getWorkspacePath() {
  var ps = getWorkspacePaths();
  return ps.length ? ps[0] : null;
}

function saveWorkspacePaths(list) {
  _workspacePaths = list;
  try {
    fs.writeFileSync(path.join(getConfigDir(), WORKSPACE_FILE), JSON.stringify({ paths: list }, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存工作区失败:', e);
  }
}

// 追加一个允许访问的路径（realpath 去重）
function addWorkspacePath(p) {
  if (!p) return false;
  if (!fs.existsSync(p)) return false;
  var realP;
  try { realP = fs.realpathSync(p); } catch (e) { return false; }
  var list = getWorkspacePaths();
  for (var i = 0; i < list.length; i++) {
    try { if (fs.realpathSync(list[i]) === realP) return false; } catch (e) {}
  }
  list.push(p);
  saveWorkspacePaths(list);
  return true;
}

// 移除一个允许访问的路径
function removeWorkspacePath(p) {
  var list = getWorkspacePaths();
  var out = list.filter(function (x) { return x !== p; });
  if (out.length === list.length) return false;
  saveWorkspacePaths(out);
  return true;
}

// 判断绝对路径是否位于任一允许访问的工作区根目录内（防 ../ 与符号链接逃逸）
function isPathInWorkspace(absPath) {
  var roots = getWorkspacePaths();
  if (!roots.length || !absPath) return false;
  var checkAbs;
  try { checkAbs = fs.realpathSync(absPath); } catch (e) { checkAbs = path.resolve(absPath); }
  for (var i = 0; i < roots.length; i++) {
    var realWs;
    try { realWs = fs.realpathSync(roots[i]); } catch (e) { realWs = roots[i]; }
    var rel = path.relative(realWs, checkAbs);
    if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) return true;
  }
  return false;
}

// 根据 skill id 查找其文件夹绝对路径（SKILL.md 所在目录），未找到返回 null
function findSkillDirById(skillId) {
  if (!skillId) return null;
  var destDir = getDestSkillsDir();
  var f = findSkillFileRecursive(destDir, skillId);
  if (!f) return null;
  var d = path.dirname(f);
  try {
    if (fs.statSync(d).isDirectory()) return d;
  } catch (e) {}
  return null;
}

// 获取已设置的工作区路径（未设置返回 null）
ipcMain.handle('get-workspace-path', async () => getWorkspacePath());

// 获取全部允许访问的工作区路径（数组）
ipcMain.handle('get-workspace-paths', async () => getWorkspacePaths());

// 弹出文件夹选择框追加一个允许访问的路径
ipcMain.handle('choose-workspace', async (event) => {
  var win = BrowserWindow.fromWebContents(event.sender);
  var result = await dialog.showOpenDialog(win, {
    title: '添加允许访问的文件夹',
    buttonLabel: '允许访问此文件夹',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
  var added = addWorkspacePath(result.filePaths[0]);
  return { path: result.filePaths[0], added: added };
});

// 移除一个允许访问的路径
ipcMain.handle('remove-workspace-path', async (event, p) => {
  var removed = removeWorkspacePath(p);
  return { success: removed, paths: getWorkspacePaths() };
});

// 判断绝对路径是否在允许访问的工作区路径内
ipcMain.handle('check-path-in-workspace', async (event, filePath) => {
  return { inside: isPathInWorkspace(filePath), paths: getWorkspacePaths() };
});

// 弹出选择框选择附件（支持单/多文件、文件夹）
ipcMain.handle('choose-attachments', async (event) => {
  var win = BrowserWindow.fromWebContents(event.sender);
  var result = await dialog.showOpenDialog(win, {
    title: '选择要添加到对话的文件或文件夹',
    buttonLabel: '添加',
    properties: ['openFile', 'openDirectory', 'multiSelections']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true, items: [], outside: [] };
  }
  var items = result.filePaths.map(function (p) {
    var kind = 'file';
    try { if (fs.statSync(p).isDirectory()) kind = 'dir'; } catch (e) {}
    return { path: p, kind: kind };
  });
  var outside = items.filter(function (it) { return !isPathInWorkspace(it.path); })
    .map(function (it) { return it.path; });
  return { canceled: false, items: items, outside: outside };
});

// 获取内置工具注册表（供渲染进程构建 tools 参数）
ipcMain.handle('get-skill-tools', async () => SKILL_TOOLS);

// 执行技能声明的只读工具（仅注册表内工具，且只读访问「允许访问的路径」沙箱）
// skillIds：当前对话引用的技能 id 列表，用于解析 @skill: 自带文件路径
ipcMain.handle('execute-tool', async (event, toolName, args, skillIds) => {
  var tool = SKILL_TOOLS[toolName];
  if (!tool) return { ok: false, error: '未知工具: ' + toolName };
  args = args || {};
  var ids = Array.isArray(skillIds) ? skillIds.filter(Boolean) : [];
  try {
    if (toolName === 'read_file') {
      var r1 = await resolveSkillPathForCall(event, toolName, args.path, ids);
      if (r1.error) return { ok: false, error: r1.error };
      if (!fs.existsSync(r1.abs) || !fs.statSync(r1.abs).isFile()) {
        return { ok: false, error: '文件不存在或不是文件: ' + args.path };
      }
      var stat = fs.statSync(r1.abs);
      var offset = Math.max(0, parseInt(args.offset, 10) || 0);
      // 未指定 offset/length：≤30MB 文件整体读取；否则按 1MB 分段
      var defaultLen = (args.offset == null && args.length == null && stat.size <= SKILL_READ_FULL_LIMIT)
        ? stat.size
        : SKILL_READ_CHUNK;
      var length = Math.max(1, parseInt(args.length, 10) || defaultLen);
      // 未指定 offset/length 时，超过整读阈值（30MB）的大文件要求分段读取
      if (stat.size > SKILL_READ_FULL_LIMIT && args.offset == null && args.length == null) {
        return { ok: false, error: '文件超过 30MB（' + stat.size + ' 字节），请使用 offset/length 分段读取（单次最多 1MB）: ' + args.path };
      }
      if (offset >= stat.size) {
        return { ok: true, result: '', path: args.path, size: stat.size, offset: offset, last: true, total: stat.size };
      }
      var readLen = Math.min(length, stat.size - offset);
      var buf = Buffer.alloc(readLen);
      var fd = fs.openSync(r1.abs, 'r');
      try {
        var bytes = fs.readSync(fd, buf, 0, readLen, offset);
        var content = buf.toString('utf-8', 0, bytes);
        return {
          ok: true,
          result: content,
          path: args.path,
          size: stat.size,
          offset: offset,
          last: (offset + bytes) >= stat.size,
          total: stat.size
        };
      } finally {
        fs.closeSync(fd);
      }
    }
    if (toolName === 'list_dir') {
      var relDir = (args.path && args.path !== '.') ? args.path : '.';
      var r2 = await resolveSkillPathForCall(event, toolName, relDir, ids);
      if (r2.error) return { ok: false, error: r2.error };
      if (!fs.existsSync(r2.abs) || !fs.statSync(r2.abs).isDirectory()) {
        return { ok: false, error: '目录不存在: ' + relDir };
      }
      var entries = fs.readdirSync(r2.abs, { withFileTypes: true });
      var lines = entries.map(function (e) { return e.name + (e.isDirectory() ? '/' : ''); });
      lines.sort();
      return { ok: true, result: lines.join('\n'), path: relDir };
    }
    if (toolName === 'walk_dir') {
      var relW = (args.path && args.path !== '.') ? args.path : '.';
      var r3 = await resolveSkillPathForCall(event, toolName, relW, ids);
      if (r3.error) return { ok: false, error: r3.error };
      if (!fs.existsSync(r3.abs) || !fs.statSync(r3.abs).isDirectory()) {
        return { ok: false, error: '目录不存在: ' + relW };
      }
      var tree = collectDirTree(r3.abs, {
        maxDepth: args.maxDepth,
        maxEntries: args.maxEntries,
        includeHidden: !!args.includeHidden
      });
      var head = '目录: ' + relW + '  (' + tree.dirCount + ' 个目录, ' + tree.fileCount + ' 个文件)';
      var body = tree.lines.length ? tree.lines.join('\n') : '(空目录)';
      if (tree.truncated) body += '\n...(条目过多，已截断)';
      return { ok: true, result: head + '\n' + body, path: relW };
    }
    if (toolName === 'scan_sensitive') {
      var relS = (args.path && args.path !== '.') ? args.path : '.';
      var r4 = await resolveSkillPathForCall(event, toolName, relS, ids);
      if (r4.error) return { ok: false, error: r4.error };
      if (!fs.existsSync(r4.abs) || !fs.statSync(r4.abs).isDirectory()) {
        return { ok: false, error: '目录不存在: ' + relS };
      }
      var scan = scanSensitiveDir(r4.abs, { maxDepth: args.maxDepth, maxEntries: args.maxEntries });
      var summary = '目录扫描完成：共 ' + scan.filesTotal + ' 个文件，实际读取 ' + scan.scanned.length + ' 个文本文件' +
        (scan.skippedBinary ? '（跳过二进制 ' + scan.skippedBinary + '）' : '') +
        (scan.skippedLarge ? '（跳过超大文件 ' + scan.skippedLarge + '）' : '') +
        (scan.truncated ? '（已截断）' : '') + '。';
      // scanned 数组含内容，仅供渲染层 DLP 检测使用，不直接作为模型可见结果
      return { ok: true, result: summary, path: relS, scanned: scan.scanned, filesTotal: scan.filesTotal };
    }
    return { ok: false, error: '未实现的工具: ' + toolName };
  } catch (err) {
    console.error('工具执行失败:', toolName, err);
    return { ok: false, error: err.message || '执行失败' };
  }
});

// 敏感数据扫描命中后，由渲染进程弹应用内自定义确认框（打码 / 跳过 / 取消），
// 不再使用原生 dialog（无法定制样式）。

// 发送前附件敏感数据预检：只读「允许访问的路径」内的文本文件（本地读取，用于 DLP 检测，
// 内容不发给模型）。二进制文件返回 binary:true；超大文件只取前 2MB 采样（truncated:true）。
var ATTACH_DLP_MAX_BYTES = 2 * 1024 * 1024; // 附件 DLP 预检单文件采样上限 2MB

ipcMain.handle('read-attachment-content', async (event, filePath) => {
  if (!isPathInWorkspace(filePath)) {
    return { ok: false, error: '路径不在允许访问的范围内，无法读取' };
  }
  var stat;
  try { stat = fs.statSync(filePath); } catch (e) { return { ok: false, error: '文件不存在或无法访问' }; }
  if (!stat.isFile()) return { ok: false, error: '不是文件' };
  var truncated = stat.size > ATTACH_DLP_MAX_BYTES;
  var readLen = Math.min(stat.size, ATTACH_DLP_MAX_BYTES);
  var fd;
  try {
    fd = fs.openSync(filePath, 'r');
    var buf = Buffer.alloc(readLen);
    var bytes = fs.readSync(fd, buf, 0, readLen, 0);
  } finally {
    if (fd != null) fs.closeSync(fd);
  }
  // 二进制嗅探（前 1KB 含 NUL 字节视为二进制，不做文本 DLP）
  for (var i = 0; i < Math.min(bytes, 1024); i++) {
    if (buf[i] === 0) return { ok: false, binary: true, size: stat.size };
  }
  return {
    ok: true,
    content: buf.toString('utf-8', 0, bytes),
    size: stat.size,
    truncated: truncated
  };
});

// 读取 model-config.json 配置文件
ipcMain.handle('load-model-config', async () => {
  var configPath = path.join(getConfigDir(), 'model-config.json');
  try {
    if (fs.existsSync(configPath)) {
      var raw = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('读取 model-config.json 失败:', err);
  }
  return null;
});

// 审计日志追加写入（隐私合规追溯）
ipcMain.handle('append-audit-log', async (event, filePath, content) => {
  try {
    var dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('审计日志写入失败:', err);
    return false;
  }
});

// 审计日志导出为 Excel/CSV 文件（HTML .xls 或带 BOM 的 CSV，on/reply 模式保证兼容性）
ipcMain.on('export-audit-log', async (event, payload) => {
  var window = BrowserWindow.fromWebContents(event.sender);
  var data = payload.data;
  var filter = payload.filter || 'all';
  var format = payload.format || 'xls';

  // 根据筛选类型与格式生成默认文件名
  var defaultName = 'audit-log-export';
  if (filter === 'api') defaultName = 'audit-log-api';
  else if (filter === 'action') defaultName = 'audit-log-action';
  defaultName += (format === 'csv' ? '.csv' : '.xls');

  var result = await dialog.showSaveDialog(window, {
    title: '导出审计日志',
    defaultPath: defaultName,
    filters: format === 'csv'
      ? [{ name: 'CSV 文件', extensions: ['csv'] }]
      : [{ name: 'Excel 文件', extensions: ['xls'] }]
  });

  if (result.canceled || !result.filePath) {
    event.reply('export-audit-log-reply', { success: false, canceled: true });
    return;
  }

  try {
    if (format === 'csv') {
      // CSV 加 UTF-8 BOM，保证 Excel 正确识别中文
      fs.writeFileSync(result.filePath, Buffer.from('\ufeff' + data, 'utf8'));
    } else {
      fs.writeFileSync(result.filePath, data, 'utf-8');
    }
    event.reply('export-audit-log-reply', { success: true, filePath: result.filePath });
  } catch (err) {
    console.error('导出失败:', err);
    event.reply('export-audit-log-reply', { success: false, error: err.message });
  }
});

// DLP 检测记录导出为 Excel/CSV 文件
ipcMain.on('export-dlp-log', async (event, payload) => {
  var window = BrowserWindow.fromWebContents(event.sender);
  var data = payload.data;
  var format = payload.format || 'xls';

  var result = await dialog.showSaveDialog(window, {
    title: '导出 DLP 检测记录',
    defaultPath: format === 'csv' ? 'dlp-log-export.csv' : 'dlp-log-export.xls',
    filters: format === 'csv'
      ? [{ name: 'CSV 文件', extensions: ['csv'] }]
      : [{ name: 'Excel 文件', extensions: ['xls'] }]
  });

  if (result.canceled || !result.filePath) {
    event.reply('export-dlp-log-reply', { success: false, canceled: true });
    return;
  }

  try {
    if (format === 'csv') {
      fs.writeFileSync(result.filePath, Buffer.from('\ufeff' + data, 'utf8'));
    } else {
      fs.writeFileSync(result.filePath, data, 'utf-8');
    }
    event.reply('export-dlp-log-reply', { success: true, filePath: result.filePath });
  } catch (err) {
    console.error('DLP 导出失败:', err);
    event.reply('export-dlp-log-reply', { success: false, error: err.message });
  }
});

// 使用报告导出为自包含 HTML 报告文件
// filename：可选的默认文件名（调用方指定，如用户画像分析报告用「Report+时间」命名）
ipcMain.on('export-report', async (event, payload) => {
  var window = BrowserWindow.fromWebContents(event.sender);
  var data = payload.data;

  var result = await dialog.showSaveDialog(window, {
    title: '导出使用报告',
    defaultPath: payload.filename || 'usage-report.html',
    filters: [{ name: 'HTML 报告', extensions: ['html'] }]
  });

  if (result.canceled || !result.filePath) {
    event.reply('export-report-reply', { success: false, canceled: true });
    return;
  }

  try {
    fs.writeFileSync(result.filePath, data, 'utf-8');
    event.reply('export-report-reply', { success: true, filePath: result.filePath });
  } catch (err) {
    console.error('报告导出失败:', err);
    event.reply('export-report-reply', { success: false, error: err.message });
  }
});

// 清空全部审计日志（audit-logs/ 目录下所有 JSONL 文件）
ipcMain.handle('clear-audit-logs', async () => {
  try {
    var logsDir = path.join(getDataDir(), 'audit-logs');
    if (!fs.existsSync(logsDir)) return { success: true };
    var files = fs.readdirSync(logsDir);
    for (var i = 0; i < files.length; i++) {
      if (files[i].endsWith('.jsonl')) {
        try {
          fs.unlinkSync(path.join(logsDir, files[i]));
        } catch (e) {}
      }
    }
    return { success: true };
  } catch (err) {
    console.error('清空审计日志失败:', err);
    return { success: false, error: err.message };
  }
});

// ===== 数据文件管理：打开数据目录 / 导出 / 导入（本地数据迁移、跨平台迁移） =====

// 递归复制目录
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  var entries = fs.readdirSync(src, { withFileTypes: true });
  for (var i = 0; i < entries.length; i++) {
    var s = path.join(src, entries[i].name);
    var d = path.join(dest, entries[i].name);
    if (entries[i].isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entries[i].isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

// 判断目录是否为典型的程序数据目录（用于导入时兼容直接选择 data 目录）
function looksLikeDataDir(dir) {
  var marks = ['ai-talk-conversations.json', 'token-stats.json', 'ai-talk-audit.jsonl', 'audit-logs'];
  for (var i = 0; i < marks.length; i++) {
    if (fs.existsSync(path.join(dir, marks[i]))) return true;
  }
  return false;
}

// 在系统文件管理器中打开程序数据目录
ipcMain.handle('open-data-dir', async () => {
  try {
    var errMsg = await shell.openPath(getDataDir());
    return errMsg ? { success: false, error: errMsg } : { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 导出全部本地数据（data/ + config/）到用户选择的位置，生成带时间戳的备份文件夹
ipcMain.handle('export-data-files', async (event) => {
  var win = BrowserWindow.fromWebContents(event.sender);
  var result = await dialog.showOpenDialog(win, {
    title: '选择数据导出位置',
    buttonLabel: '导出到此处',
    properties: ['openDirectory', 'createDirectory']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { success: false, canceled: true };
  }
  try {
    var ts = new Date();
    var pad = function (n) { return ('0' + n).slice(-2); };
    var stamp = ts.getFullYear() + '-' + pad(ts.getMonth() + 1) + '-' + pad(ts.getDate()) +
      '_' + pad(ts.getHours()) + '-' + pad(ts.getMinutes()) + '-' + pad(ts.getSeconds());
    var target = path.join(result.filePaths[0], 'AiTalk-数据备份-' + stamp);
    fs.mkdirSync(target, { recursive: true });
    copyDirRecursive(getDataDir(), path.join(target, 'data'));
    copyDirRecursive(getConfigDir(), path.join(target, 'config'));
    return { success: true, targetPath: target };
  } catch (err) {
    console.error('数据导出失败:', err);
    return { success: false, error: err.message };
  }
});

// 从用户选择的备份文件夹导入数据（覆盖当前数据，支持导出的备份结构与 data 目录本身）
ipcMain.handle('import-data-files', async (event) => {
  var win = BrowserWindow.fromWebContents(event.sender);
  var result = await dialog.showOpenDialog(win, {
    title: '选择要导入的数据备份文件夹',
    buttonLabel: '导入',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) {
    return { success: false, canceled: true };
  }
  var src = result.filePaths[0];
  try {
    var srcData = path.join(src, 'data');
    var srcConfig = path.join(src, 'config');
    var imported = { data: false, config: false };
    if (fs.existsSync(srcData)) {
      copyDirRecursive(srcData, getDataDir());
      imported.data = true;
    } else if (looksLikeDataDir(src)) {
      // 兼容：用户直接选择了 data 目录本身
      copyDirRecursive(src, getDataDir());
      imported.data = true;
    }
    if (fs.existsSync(srcConfig)) {
      copyDirRecursive(srcConfig, getConfigDir());
      imported.config = true;
    }
    if (!imported.data && !imported.config) {
      return { success: false, error: '所选文件夹中未找到可导入的数据（需要包含 data/ 或 config/ 子目录）' };
    }
    return { success: true, imported: imported };
  } catch (err) {
    console.error('数据导入失败:', err);
    return { success: false, error: err.message };
  }
});

/**
 * 审计日志永久保存：不做自动清理
 * （是否删除日志由用户在「数据管理」模块中手动决定）
 */

app.whenReady().then(() => {
  ensureDefaultConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
