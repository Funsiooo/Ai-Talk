/******** 渲染进程 renderer.js 在 index.html 被引入 *******/

// 获取 webview 元素
const webview = document.getElementById('webview');

// 实现将新窗口关闭后自动恢复到 Electron 中 v1.0.2
window.electron.restoreWebviewUrl((url) => {
  sidebar.style.display = 'flex';
  barContainer.style.display = 'none';
  barContainer.innerHTML = '';

  // 恢复 webview 原页面
  if (url) {
    webview.setAttribute('src', url);
  }
});

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

const manusButton = document.getElementById('manus');
const grokButton = document.getElementById('grok');
const copilotButton = document.getElementById('copilot');
const metaButton = document.getElementById('meta');
const perplexityButton = document.getElementById('perplexity');
const deeplButton = document.getElementById('deepl');
const youdaoButton = document.getElementById('youdaoranslator');
const sciencepalButton = document.getElementById('sciencepal');
const bingButton = document.getElementById('bing');


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
  webview.setAttribute('src', "https://www.tongyi.com/");
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

manusButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://manus.im/");
});

grokButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://x.ai/grok");
});

copilotButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://copilot.microsoft.com/");
});

metaButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://www.meta.ai/");
});

perplexityButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://www.perplexity.ai/");
});


deeplButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://www.deepl.com/");
});

youdaoButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://fanyi.youdao.com/#/TextTranslate");
});

sciencepalButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://sciencepal.ai/");
});

bingButton.addEventListener('click', function() {
  webview.setAttribute('src', "https://www.bing.com/");
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
// const hideBtn = document.getElementById('hide-btn');
const barContainer = document.getElementById('bar-container');
// 获取浏览器分身
const browserButton = document.getElementById('browser-btn');


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

browserButton.addEventListener('click', function () {
  let url = '';

  try {
    url = webview.getURL();
  } catch (e) {
    url = webview.getAttribute('src') || '';
  }

  if (!url) {
    console.warn("webview 当前没有 URL。");
    return;
  }

  // 1) 分离到新的 BrowserWindow（会话保持）
  window.electron.detachWebview(url);

  // 2) 清空 webview
  webview.stop();
  webview.setAttribute('src', 'about:blank');
});