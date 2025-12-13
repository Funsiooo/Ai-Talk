const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')

let mainWindow;
let proxyWindow;
let versionWindow
let detachedWindows = new Set(); // 用于跟踪所有detach-webview创建的窗口

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1260,
    height: 840,
    icon: 'assets/logo.ico',
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

  // 主窗口关闭时，关闭所有detach-webview创建的窗口
  mainWindow.on('closed', () => {
    closeAllDetachedWindows();
    mainWindow = null;
  });


}

// 创建用于输入代理的自定义窗口
function createProxyWindow() {
  proxyWindow = new BrowserWindow({
    width: 370,
    height: 250,
    icon: 'assets/logo.ico',
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
ipcMain.handle('set-proxy', (event, proxyAddress) => {
  mainWindow.webContents.session.setProxy({
    proxyRules: `http=${proxyAddress};https=${proxyAddress}`,
    proxyBypassRules: '<local>' // 可选：不通过代理的地址
  }).then(() => {
    mainWindow.webContents.reload(); // 设置代理后重新加载页面
  }).catch(err => {
    console.error('设置代理失败:', err);
    dialog.showErrorBox('设置代理失败', '无法设置代理: ' + err.message);
  });
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
    icon: 'assets/logo.ico',
    webPreferences: {
      session: ses,
      nodeIntegration: false,
      contextIsolation: true
    }
  });

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


// 创建用于输入显示“关于程序”的自定义窗口
function createVersionWindow() {
  versionWindow = new BrowserWindow({
    width: 500,
    height: 685,
    icon: 'assets/logo.ico',
    parent: mainWindow,
    modal: true,
    show: false,  // 初始时不显示
    webPreferences: {
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

app.whenReady().then(() => {
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
