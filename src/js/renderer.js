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
const poeButton = document.getElementById('poe');
const deepseekButton = document.getElementById('deepseek');
const claudeButton = document.getElementById('claude');


// 设置按钮点击事件监听器,加载网页
deepseekButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://chat.deepseek.com/");
});

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

poeButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://poe.com/");
});

claudeButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://claude.ai/");
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

// 获取隐藏按钮和侧边栏
const hideBtn = document.getElementById('hide-btn');
const barContainer = document.getElementById('bar-container');


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


// 隐藏侧边栏并加载 bar.html
hideBtn.addEventListener('click', function() {
  sidebar.style.display = 'none'; // 隐藏侧边栏
  webview.style.width = 'calc(100% - 50px)'; // 右侧区域调整宽度
  barContainer.style.display = 'block'; // 显示 barContainer

  // 加载 bar.html
  barContainer.innerHTML = '<iframe src="bar.html" style="width: 50px; height: 100vh; border: none;"></iframe>';
});

// 监听 bar.html 里的按钮点击事件，恢复侧边栏
window.addEventListener('message', function(event) {
  if (event.data === 'restoreSidebar') {
    sidebar.style.display = 'flex'; // 显示侧边栏
    webview.style.width = '100%'; // 恢复 webview 宽度
    barContainer.style.display = 'none'; // 隐藏 barContainer
    barContainer.innerHTML = ''; // 清空内容
  }
});
