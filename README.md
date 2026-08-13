# <img src="/Users/ooooo/Files/tools/notebooks/images/title-6538184.png" alt="Ai_Talk" style="width: 60px;">**<span style="font-size: 30px; vertical-align: middle;">Hello, Let's Ai Talk !</span>**

<p align="left">
  <img alt="GitHub License" src="https://img.shields.io/github/license/Funsiooo/Ai-Talk?color=%23%2067b93d">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/Funsiooo/Ai-Talk?color=%23%2067b93d">
  <img alt="GitHub Downloads (all assets, all releases)" src="https://img.shields.io/github/downloads/Funsiooo/Ai-Talk/total">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/Funsiooo/Ai-talk">
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/Funsiooo/Ai-Talk">
</p>


## 📔 简介

**Ai Talk** 是面向 **个人** 与 **企业** 的双场景 AI 对话客户端。基于 Electron 实现跨平台统一体验，聚合主流大模型及私有化 API，开箱即用。内置 **DLP 数据防泄漏** 与 **操作审计追踪**，兼顾 AI 效率与数据安全合规。macOS · Windows · Linux 全平台覆盖，安装即运行。

</br>

**✨ 特色功能**

<table width="100%" border="0" cellpadding="14" cellspacing="8">
  <tr>
    <td align="center" valign="middle" style="border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="./assets/md1.svg" width="28" height="28" alt="DLP 防泄漏">
      <div style="font-weight: 600; margin-top: 6px;">DLP 防泄漏</div>
    </td>
    <td align="center" valign="middle" style="border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="./assets/md2.svg" width="28" height="28" alt="操作审计">
      <div style="font-weight: 600; margin-top: 6px;">操作审计</div>
    </td>
    <td align="center" valign="middle" style="border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="./assets/md3.svg" width="28" height="28" alt="会话增强">
      <div style="font-weight: 600; margin-top: 6px;">会话增强</div>
    </td>
    <td align="center" valign="middle" style="border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="./assets/md4.svg" width="28" height="28" alt="Skill 扩展">
      <div style="font-weight: 600; margin-top: 6px;">Skill 扩展</div>
    </td>
    <td align="center" valign="middle" style="border: 1px solid #e1e4e8; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      <img src="./assets/md5.svg" width="28" height="28" alt="多模型聚合">
      <div style="font-weight: 600; margin-top: 6px;">多模型聚合</div>
    </td>
  </tr>
</table>
<br/>

![md6](/Users/ooooo/Files/tools/notebooks/images/md6.png)

## 📟 功能介绍

### 默认模式

直接接入大模型官方入口服务，开箱即用。模型输出中的参考链接可在应用内直接打开浏览。默认模式支持会话分身。

![default](/Users/ooooo/Files/tools/notebooks/images/md7.png)

### API 模式

适用于企业内部模型 API 接入。应用带自带会话记忆系统（不会跨会话记忆，可跨会话引用内容）和上下文压缩。

✨ 默认开启 **"敏感数据监控外发"** 检测，外发敏感数据给AI 大模型前会自动告警提示；若用户仍选择发送，将对敏感内容进行脱敏发送。检测规则支持通过自定义正则表达式匹配企业内部的敏感数据类型，灵活适配不同企业的合规需求。

![api](/Users/ooooo/Files/tools/notebooks/images/md8.png)

#### 敏感数据外发检测（DLP）

API 模式下，系统在数据外发前自动扫描内容，匹配敏感信息模式（如身份证号、手机号、银行卡号、企业自定义规则等）。检测命中时：

- 完整明文展示命中的敏感内容，让用户清楚知晓即将发送的数据；
- 用户可选择**阻止发送**或**继续发送**；
- 若选择继续发送，系统对敏感数据进行脱敏处理后再外发。

检测规则通过 `config/dlp-rules.json` 管理，支持自定义正则表达式，可匹配任何企业内部定义的敏感数据类型。

![data](/Users/ooooo/Files/tools/notebooks/images/md9.png)

![data2](/Users/ooooo/Files/tools/notebooks/images/md10.png)

![data2](/Users/ooooo/Files/tools/notebooks/images/md11.png)

#### 操作审计日志

系统记录完整操作日志，满足合规审计要求：

- 程序发送与访问行为记录
- DLP 检测记录（命中内容、脱敏内容、用户决策）
- Token 消耗量统计
- 请求 URL、模型名称、响应状态、耗时等

日志以明文存储，可在应用内 "**数据面板**" 中查看与导出。

![md12](/Users/ooooo/Files/tools/notebooks/images/md12.png)

#### 技能商店（Skill）

支持通过技能商店导入自定义 Skill。技能以标准格式编写，可声明允许访问的目录范围。

- 在安全沙箱内执行，仅允许读取授权目录
- 只读、不可写入，未授权目录一律拒绝读取

![skill](/Users/ooooo/Files/tools/notebooks/images/skill-6538184.jpg)

#### 会话记忆与上下文管理

API 模式下内置会话记忆系统，支持跨会话引用历史内容（默认不跨会话记忆），并具备上下文压缩机制，在超出窗口时自动精简，保持连贯性并降低 Token 消耗。

![14](/Users/ooooo/Files/tools/notebooks/images/md14.png)



#### Prompt 模板库

内置 Prompt 模板库，支持自定义模板与分类管理，减少常用提示词的重复输入；并提供 Prompt 优化能力，帮助用户将需求表述得更清晰、更准确。

![15](/Users/ooooo/Files/tools/notebooks/images/md15.png)

#### 联网搜索

部分模型支持联网搜索,选择可联网的模型后，点击联网搜索按钮即可进行联网搜索。

![16](/Users/ooooo/Files/tools/notebooks/images/md16.png)

## 🔐 数据与安全

- 程序数据**本地存储**（会话记录、配置文件、日志）
- 可通过复制目录实现跨设备数据迁移
- 敏感数据检测在本地完成，DLP 判定与脱敏处理均不依赖外部服务。
- skill 执行全程只读，受 "允许访问的路径" 沙箱约束。

| 平台      | 路径                                     |
| --------- | ---------------------------------------- |
| macOS DMG | `~/Library/Application Support/Ai Talk/` |
| Windows   | `%APPDATA%/Ai Talk/`                     |
| Linux     | `~/.config/Ai Talk/`                     |



## ⌨️ 源码启动

- 安装 Node.js

```
https://nodejs.org/zh-cn/download
```

- 下载项目源码

```
git clone https://github.com/Funsiooo/Ai-Talk.git
```

- 安装 Electron

```
cd Ai-Talk
npm install electron --save-dev -d --registry=https://registry.npmmirror.com
```

- Ai Talk 目录下执行

```
npm start
```



## 📦 打包指南

- 安装 Node.js

```
https://nodejs.org/zh-cn/download
```

- 下载项目源码

```
git clone https://github.com/Funsiooo/Ai-Talk.git
```

- 安装 electron

```
cd Ai-Talk
npm install electron --save-dev -d --registry=https://registry.npmmirror.com
```

- 安装 electron-forge/cli

```
npm install --save-dev @electron-forge/cli -d --registry=https://registry.npmmirror.com
```

- macOS 需要安装 maker-dmg

```
npm install --save-dev @electron-forge/maker-dmg -d --registry=https://registry.npmmirror.com
```

- Windows：MSI 打包需要安装 WiX Toolset v3

```
下载地址：https://github.com/wixtoolset/wix3/releases/tag/wix3112rtm
建议使用 `wix311-binaries.zip`，解压后将 `bin` 目录路径添加到系统环境变量 PATH 中
```

- Linux：deb / rpm 打包

```
npm install --save-dev @electron-forge/maker-deb @electron-forge/maker-rpm -d --registry=https://registry.npmmirror.com
```

- 执行打包（输出文件位于 `out/` 目录）

```
npm run build
```

> **Note：** 打包过程中若出现报错可忽略。若打包失败，可尝试执行 `npm cache clean --force` 清理缓存后重试。	



## 🛎️ FQA

Mca 用户在下载安装后出现以下报错。这是由于新版 macOS 系统默认禁止安装第三方未验证的应用，且系统隐藏了“任何来源”的选项。用户需先在终端执行以下命令，重新启用该选项，之后再次打开应用即可正常使用。

```
sudo spctl --master-disable
```

[![img](/Users/ooooo/Files/tools/notebooks/images/fqa.png)](https://github.com/Funsiooo/Ai-Talk/blob/main/assets/fqa.png)

