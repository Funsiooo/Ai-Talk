const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

// 按当前平台动态构建 makers 列表，避免引入不可安装的包
var makers = [];

// 通用：ZIP 打包（macOS + Linux，Windows 用 MSI 替代）
makers.push({
  name: '@electron-forge/maker-zip',
  platforms: ['darwin', 'linux']
});

// macOS: DMG 镜像
if (process.platform === 'darwin') {
  makers.push({
    name: '@electron-forge/maker-dmg',
    platforms: ['darwin'],
    config: {
      name: 'Ai-Talk-v1.0.3',
      icon: './assets/logo.icns',
      format: 'UDZO',
      overwrite: true,
      // [DMG 背景图] 直接引用 assets/dmg.png
      background: path.join(__dirname, 'assets', 'dmg.png'),
      iconSize: 80,
      window: {
        // [DMG 窗口尺寸] 与背景图 658×380 一致，缩少高度让图标居中
        size: { width: 658, height: 380 }
      },
      // [DMG 图标布局] 垂直居中于 380px 窗口
      contents: function (opts) {
        return [
          { x: 192, y: 145, type: 'file', path: opts.appPath },
          { x: 448, y: 145, type: 'link', path: '/Applications' }
        ];
      }
    }
  });
}

// Windows: MSI 安装包（支持自定义安装目录）
if (process.platform === 'win32') {
  makers.push({
    name: '@electron-forge/maker-wix',
    platforms: ['win32'],
    config: {
      name: 'Ai-Talk-v1.0.3',
      manufacturer: 'Funsiooo',
      description: 'Multi-model AI desktop client',
      // 必须与打包产物的真实 exe 名一致（packagerConfig.name = 'Ai Talk' → 'Ai Talk.exe'）。
      // WiX 会以该名字在安装根目录生成 Squirrel stub 启动器，stub 按「自身文件名」在
      // app-<版本>/ 子目录中查找真实 exe 并启动；名字不一致会导致点击快捷方式后静默无反应。
      exe: 'Ai Talk',
      icon: path.join(__dirname, 'assets', 'logo.ico'),
      language: 2052, // 中文简体
      codepage: 65001, // UTF-8，支持中文路径
      arch: 'x64', // 与打包目标架构一致（electron-wix-msi 默认 x86，会把 x64 应用装进 Program Files (x86)）
      ui: {
        chooseDirectory: true // 允许用户选择安装目录
      },
      features: {
        autoUpdate: false,
        autoLaunch: false
      }
    }
  });
}

// Linux: deb + rpm
if (process.platform === 'linux') {
  makers.push({
    name: '@electron-forge/maker-deb',
    platforms: ['linux'],
    config: { name: 'Ai-Talk-1.0.3' }
  });
  makers.push({
    name: '@electron-forge/maker-rpm',
    platforms: ['linux'],
    config: { name: 'Ai-Talk-1.0.3' }
  });
}

module.exports = {
  packagerConfig: {
    name: 'Ai Talk',
    asar: {
      unpackDir: 'assets'
    },
    extraResources: [
      {
        from: path.join(__dirname, 'config'),
        to: 'config'
      }
    ],
    icon: './assets/logo' // 不带后缀，Electron Forge 按平台自动选择 .ico/.icns/.png
  },
  rebuildConfig: {},
  makers: makers,
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {}
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
};
