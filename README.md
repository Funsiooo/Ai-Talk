# <img src="./assets/logo.png" alt="示例图片" style="width: 85px;"> Ai Talk

<p align="left">
  <img alt="GitHub License" src="https://img.shields.io/github/license/Funsiooo/Ai-Talk?color=%23%2067b93d">
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/Funsiooo/Ai-talk">
</p>


## 📔 简介

**Ai Talk** 是一款集合了多种大语言模型应用的开源桌面客户端，基于 Electron 构建。当前支持以下大模型：OpenAI ChatGPT、Google Gemini、Quora Poe、月之暗面 Kimi、字节 豆包、阿里 通义千问、腾讯 元宝、百度 文心一言。 **项目地址：https://github.com/Funsiooo/Ai-Talk **。



> 📑   **Note：**OpenAi ChatGPT、Google Gemini 、Quora Poe 需要设置网络代理才能正常访问。



## 📟 功能介绍

**界面：**程序主要由两部分组成：左侧的侧边栏和右侧的显示区域。点击左侧的某个大模型，右侧将加载该大模型的官方页面，您即可开始对话。

![image-20250101174632810](/Users/ooooo/Files/tools/notebooks/images/example1.png)

![image-20241231162813581](/Users/ooooo/Files/tools/notebooks/images/example2-6002009.png)

**网络代理：**由于 **OpenAI ChatGPT** 、 **Google Gemini** 、**Quora Poe** 模型需要访问国外网站，因此在使用之前，需要在左侧侧边栏下方的 “网络设置” 中配置代理网络。目前只支持 **HTTP** 和 **HTTPS** 协议。配置步骤如下：



> - 点击 “网络设置” ，在弹窗输入代理地址，如：本地开启了 7890 端口为代理网络端口，填入 http://127.0.0.1:7890 
> - 点击 “设置代理” ，完成网络设置
> - 如网络设置输入错误，点击 “清除代理” 即可恢复程序默认设置
> - 设置完毕后点击 “关闭” 

![image-20241231162813581](/Users/ooooo/Files/tools/notebooks/images/example3-6002009.png)



## 📸 大模型使用规则

> 月之暗面 Kimi

消息条数限制：免费使用，不限次数。



> 通义千问

消息条数限制：免费使用，不限次数。



> 字节 豆包

消息条数限制：免费使用，不限次数。



> 腾讯 元宝

消息条数限制：免费使用，不限次数。



> 百度 文心一言

消息条数限制：3.5 模型免费使用，其它模型存在次数限制。



> OpenAi ChatGPT

消息条数限制：免费套餐用户在 5 小时内只能使用 GPT-4o 的有限次数，使用完毕回退其它模型，如：GPT-3.5 。【 官方文档链接：https://help.openai.com/en/articles/9275245-using-chatgpt-s-free-tier-faq#h_43513320b9】



> Google  Gemini

消息条数限制：1.5 flash 免费使用，存在次数限额，限额不详。【官方文档：https://gemini.google.com/faq】



> Quora Poe

消息条数限制：存在次数限额，限额不详。



## ⌨️ 源码启动

- 安装 nodejs

```
https://nodejs.org/zh-cn/download
```



- 安装 electron

```
npm install electron --save-dev -d --registry=https://registry.npmmirror.com
```



- Ai Talk 目录下执行

```
npm start
```



## 📦 打包

- 安装 node.js

```
https://nodejs.org/zh-cn/download
```



- 安装 electron

```
npm install electron --save-dev -d --registry=https://registry.npmmirror.com
```



- 安装 electron-forge/cli

```
npm install --save-dev @electron-forge/cli -d --registry=https://registry.npmmirror.com
```



- Ai Talk 目录下执行，打包文件存放在 out 目录下（打包过程中若出现报错可忽略）

```
npm run build
```

![](./assets/build.png)



## 🔑 客户端下载

<table style="width: 100%">
  <tr>
    <td width="25%" align="center">
      <b>Windows</b>
    </td>
    <td width="25%" align="center" colspan="2">
      <b>MacOS</b>
    </td>
    <td width="25%" align="center">
      <b>Linux</b>
    </td>
  </tr>
  <tr style="text-align: center">
    <td align="center" valign="middle">
      <a href='https://github.com/Funsiooo/chunsou'>
        <img src='./assets/windows.png' style="height:24px; width: 24px" />
        <br />
        <b>Setup.exe</b>
      </a>
    </td>
    <td align="center" valign="middle">
      <a href='https://github.com/Funsiooo/chunsou'>
        <img src='./assets/mac.png' style="height:24px; width: 24px" />
        <br />
        <b>Intel</b>
      </a>
    </td>
    <td align="center" valign="middle">
      <a href='https://github.com/Funsiooo/chunsou'>
        <img src='./assets/mac.png' style="height:24px; width: 24px" />
        <br />
        <b>M1/M2</b>
      </a>
    </td>
    <td align="center" valign="middle">
      <a href='https://github.com/Funsiooo/chunsou'>
        <img src='./assets/linux.png' style="height:24px; width: 24px" />
        <br />
        <b>AppImage</b>
      </a>
    </td>
  </tr>
</table>




## ☕ 请作者喝杯咖啡

<img src="./assets/wechat.png" alt="示例图片" style="width: 500px; float: left; ">



## ✨ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Funsiooo/Ai-Talk&type=Date)](https://star-history.com/#Funsiooo/Ai-Talk&Date)
