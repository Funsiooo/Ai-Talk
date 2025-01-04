/******** 渲染进程 renderer.js 在 index.html 被引入 *******/

// 获取 webview 元素
const webview = document.getElementById('webview');


/**************** 测边栏加载模型事件规则 *****************/ 
// 获取大模型按钮元素
const kimiButton = document.getElementById('kimi');
const doubaoButton = document.getElementById('doubao');
const tyqwButton = document.getElementById('tyqw');
const tenxunButton = document.getElementById('tenxun');
const openaiButton = document.getElementById('openai');
const googleButton = document.getElementById('google');
const wxyyButton = document.getElementById('wxyy');
const PoeButton = document.getElementById('poe');


// 设置按钮点击事件监听器,加载网页
kimiButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://kimi.moonshot.cn/");
});

doubaoButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://www.doubao.com/");
});

tyqwButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://tongyi.aliyun.com/");
});

tenxunButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://yuanbao.tencent.com/chat/");
});

openaiButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://chatgpt.com/");
});

googleButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://gemini.google.com/");
});

wxyyButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://yiyan.baidu.com/");
});

PoeButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://poe.com/");
});

/**************** 测边栏设置按钮事件规则 *****************/ 
// 获取”回到主页“按钮
const homeBtn = document.getElementById('home-btn');
// 获取”网络设置“按钮
const setProxyBtn = document.getElementById('set-proxy-btn');
// 获取“用户手册”按钮
const manualBtn = document.getElementById('manual-btn');
// 获取“版本信息”按钮
const versionBtn = document.getElementById('version-btn');


/* 监听按钮点击事件,加载指定 html */
homeBtn.addEventListener('click', () => {
  webview.src = 'second.html';
});

manualBtn.addEventListener('click', () => {
  webview.src = '../../assets/Readme.pdf';
});

// 添加点击事件，将请求 openProxyDialog 发送给 preload.js
setProxyBtn.addEventListener('click', () => {
  window.electron.openProxyDialog();
});

// 添加点击事件，将监听 openVersionDialog 发送给 preload.js
versionBtn.addEventListener('click', () => {
  window.electron.openVersionDialog();
});
