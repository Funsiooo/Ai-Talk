/******** 渲染进程 renderer.js 在 index.html 被引入 *******/

// 启动时加载外部模型配置
window.electron.loadModelConfig().then(function (extConfig) {
  if (extConfig) {
    AI_PROVIDERS.mergeExternalConfig(extConfig);
  }
});

// 获取 webview 元素
const webview = document.getElementById('webview');
const sidebar = document.getElementById('sidebar');
const barContainer = document.getElementById('bar-container');

// 安全审计：拦截 webview 导航，记录外网访问 + 超时检测
// 用户主动点击侧边栏模型按钮的目标 URL（仅此场景的超时才会提示；模式页面/恢复等场景不提示）
var _userModelClickUrl = '';
(function () {
  var _origSetAttr = webview.setAttribute.bind(webview);
  var _loadTimer = null;
  var _pendingUrl = '';
  var _pendingByUser = false; // 本次加载是否为用户主动点击模型按钮

  // 监听加载完成事件，清除超时计时器
  webview.addEventListener('did-finish-load', function () {
    if (_loadTimer) {
      clearTimeout(_loadTimer);
      _loadTimer = null;
      _pendingUrl = '';
      _pendingByUser = false;
    }
  });

  // 监听加载失败事件，清除超时计时器
  webview.addEventListener('did-fail-load', function () {
    if (_loadTimer) {
      clearTimeout(_loadTimer);
      _loadTimer = null;
      _pendingUrl = '';
      _pendingByUser = false;
    }
  });

  // 监听 webview 内 hash 变化（second.html 按钮触发 API 模式切换）
  webview.addEventListener('did-navigate-in-page', function (e) {
    if (e.url && e.url.indexOf('#enter-api-mode') !== -1) {
      if (typeof enterAPIMode === 'function' && !isAPIMode) {
        enterAPIMode();
      }
    }
  });

  webview.setAttribute = function (name, value) {
    if (name === 'src' && value && value !== 'about:blank') {
      // 记录 webview 导航事件
      AuditLog.logUserAction({
        action: 'webview_navigate',
        detail: JSON.stringify({ url: value })
      });

      if (_loadTimer) {
        clearTimeout(_loadTimer);
        _loadTimer = null;
      }

      // 启动 8 秒超时计时器（仅对外网 URL）
      if (/^https?:\/\//.test(value)) {
        _pendingUrl = value;
        // 仅在「用户点击模型」时判定为需提示的加载（模式页面等其它来源不提示）
        _pendingByUser = !!(_userModelClickUrl && _userModelClickUrl === value);
        _userModelClickUrl = '';
        _loadTimer = setTimeout(function () {
          _loadTimer = null;
          if (_pendingByUser) {
            // 检测是否为需要代理的国外模型
            var foreignDomains = /(chatgpt|openai|gemini\.google|claude\.ai|poe\.com|perplexity|meta\.ai|x\.ai|grok|copilot\.microsoft|deepseek)/i;
            var isForeign = foreignDomains.test(_pendingUrl);
            if (isForeign) {
              showNotification('页面加载超时，海外模型需要开启代理才能访问。\n请检查网络代理设置后重试。');
            } else {
              showNotification('页面加载超时，请检查网络连接后重试。');
            }
          }
          _pendingUrl = '';
          _pendingByUser = false;
        }, 8000);
      }
    }
    return _origSetAttr(name, value);
  };
})();

// 新窗口关闭后自动恢复 webview（v1.0.2）
window.electron.restoreWebviewUrl((url) => {
  sidebar.style.display = 'flex';
  barContainer.style.display = 'none';
  barContainer.innerHTML = '';

  // 恢复 webview 原页面
  if (url) {
    webview.setAttribute('src', url);
  }
});

// 侧边栏模型加载事件
const kimiButton = document.getElementById('kimi');
const doubaoButton = document.getElementById('doubao');
const tyqwButton = document.getElementById('tyqw');
const tenxunButton = document.getElementById('tenxun');
const openaiButton = document.getElementById('openai');
const googleButton = document.getElementById('google');
const mimoButton = document.getElementById('mimo');
const zhipuButton = document.getElementById('zhipu');
const minimaxButton = document.getElementById('minimax');
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


// 点击侧边栏模型按钮加载官方页面；_userModelClickUrl 标记来源，超时提示仅此场景生效
function loadModelUrl(url) {
  _userModelClickUrl = url;
  webview.setAttribute('src', url);
}

deepseekButton.addEventListener('click', function() {
  loadModelUrl("https://chat.deepseek.com/");
});

kimiButton.addEventListener('click', function() {
  loadModelUrl("https://kimi.moonshot.cn/");
});

doubaoButton.addEventListener('click', function() {
  loadModelUrl("https://www.doubao.com/");
});

tyqwButton.addEventListener('click', function() {
  loadModelUrl("https://www.tongyi.com/");
});

tenxunButton.addEventListener('click', function() {
  loadModelUrl("https://yuanbao.tencent.com/chat/");
});

openaiButton.addEventListener('click', function() {
  loadModelUrl("https://chatgpt.com/");
});

googleButton.addEventListener('click', function() {
  loadModelUrl("https://gemini.google.com/");
});

mimoButton.addEventListener('click', function() {
  loadModelUrl("https://aistudio.xiaomimimo.com/#/c");
});

wxyyButton.addEventListener('click', function() {
  loadModelUrl("https://yiyan.baidu.com/");
});

poeButton.addEventListener('click', function() {
  loadModelUrl("https://poe.com/");
});

claudeButton.addEventListener('click', function() {
  loadModelUrl("https://claude.ai/");
});

manusButton.addEventListener('click', function() {
  loadModelUrl("https://manus.im/");
});

grokButton.addEventListener('click', function() {
  loadModelUrl("https://x.ai/grok");
});

copilotButton.addEventListener('click', function() {
  loadModelUrl("https://copilot.microsoft.com/");
});

metaButton.addEventListener('click', function() {
  loadModelUrl("https://www.meta.ai/");
});

perplexityButton.addEventListener('click', function() {
  loadModelUrl("https://www.perplexity.ai/");
});

zhipuButton.addEventListener('click', function() {
  loadModelUrl("https://www.zhipuai.cn/");
});

minimaxButton.addEventListener('click', function() {
  loadModelUrl("https://agent.minimaxi.com/");
});



deeplButton.addEventListener('click', function() {
  loadModelUrl("https://www.deepl.com/");
});

youdaoButton.addEventListener('click', function() {
  loadModelUrl("https://fanyi.youdao.com/#/TextTranslate");
});

sciencepalButton.addEventListener('click', function() {
  loadModelUrl("https://sciencepal.ai/");
});

bingButton.addEventListener('click', function() {
  loadModelUrl("https://www.bing.com/");
});




// 侧边栏设置按钮事件
const homeBtn = document.getElementById('home-btn');
const setProxyBtn = document.getElementById('set-proxy-btn');
const manualBtn = document.getElementById('manual-btn');
const versionBtn = document.getElementById('version-btn');
const browserButton = document.getElementById('browser-btn');

// 在 webview 中导航（API 模式下先退出）
function navigateWebview(url) {
  AuditLog.logUserAction({
    action: 'webview_navigate',
    detail: JSON.stringify({ url: url, method: 'src' })
  });
  if (isAPIMode) {
    leaveAPIMode();
  }
  webview.src = url;
}

homeBtn.addEventListener('click', () => {
  navigateWebview('second.html');
});

// AI Talk 标识（侧边栏 Logo / 历史页品牌）：点击回到主页（默认模式与 API 模式均适用）
[document.querySelector('.logo'), document.querySelector('.history-brand')].forEach(function (el) {
  if (el) {
    el.title = '回到主页';
    el.addEventListener('click', function () {
      navigateWebview('second.html');
    });
  }
});

// 模型广场：打开官方模型选择页（module.html）
document.getElementById('model-square-btn').addEventListener('click', () => {
  navigateWebview('module.html');
});

// 技能商店入口
var shopEntryBtn = document.getElementById('shop-entry-btn');
if (shopEntryBtn) {
  shopEntryBtn.addEventListener('click', () => {
    // 先把技能列表写入 localStorage（webview 内 shop.html 无 IPC 权限，通过共享 localStorage 读取）
    // 内置技能（memory/translate/optimize）由系统管理，不在商店展示；deletable 标记系统默认技能不可删除
    // 打开商店前先同步内置技能（新增内置技能无需重启应用），再失效缓存重新扫描磁盘
    window.electron.ensureBuiltinSkills().then(function () {
      window.Skills.invalidate();
      invalidateSkillMentionCache();
    }).catch(function () {
      window.Skills.invalidate();
      invalidateSkillMentionCache();
    }).then(function () {
      return Promise.all([
        window.Skills.getAll(),
        window.electron.getSystemSkillIds(),
        writeWorkspaceListToLocalStorage()
      ]).then(function (res) {
        var list = res[0] || [];
        var systemIds = res[1] || [];
        var shopSkills = (list || []).filter(function (s) { return s && !s.builtin; });
        for (var i = 0; i < shopSkills.length; i++) {
          shopSkills[i].deletable = systemIds.indexOf(shopSkills[i].id) === -1;
        }
        try {
          localStorage.setItem('ai-talk-skill-list', JSON.stringify(shopSkills));
        } catch (e) {
          console.warn('[Shop] 写入技能列表失败:', e);
        }
        navigateWebview('shop.html');
      }).catch(function () {
        navigateWebview('shop.html');
      });
    });
  });
}

// 把允许访问的工作区路径写入 localStorage（webview 内 shop.html 读取）
function writeWorkspaceListToLocalStorage() {
  return window.electron.getWorkspacePaths().then(function (paths) {
    try {
      localStorage.setItem('ai-talk-workspace-list', JSON.stringify(paths || []));
    } catch (e) {
      console.warn('[Shop] 写入工作区列表失败:', e);
    }
    return paths || [];
  }).catch(function () {
    return [];
  });
}

// 商店内点击「添加允许访问的路径」：主进程弹文件夹选择框
function handleShopAddWorkspace() {
  window.electron.chooseWorkspace().then(function () {
    writeWorkspaceListToLocalStorage().then(function () {
      // 带时间戳参数强制整页重新加载，刷新路径列表
      webview.src = 'shop.html?t=' + Date.now();
    });
  });
}

// 商店内点击「移除允许访问的路径」
function handleShopRemoveWorkspace(p) {
  window.electron.removeWorkspacePath(p).then(function () {
    writeWorkspaceListToLocalStorage().then(function () {
      webview.src = 'shop.html?t=' + Date.now();
    });
  });
}

// 商店内点击「引用此技能」：webview hash 回传技能 ID
webview.addEventListener('did-navigate-in-page', function (e) {
  if (!e.url) return;
  if (e.url.indexOf('#use-skill:') !== -1) {
    var m = e.url.split('#use-skill:')[1];
    if (m) {
      var skillId = decodeURIComponent(m.split('&')[0]);
      if (skillId) handleShopSkillSelect(skillId);
    }
    return;
  }
  if (e.url.indexOf('#close-shop') !== -1) {
    handleShopClose();
    return;
  }
  if (e.url.indexOf('#import-skill') !== -1) {
    handleSkillImport();
    return;
  }
  if (e.url.indexOf('#delete-skill:') !== -1) {
    var m2 = e.url.split('#delete-skill:')[1];
    if (m2) {
      handleSkillDelete(decodeURIComponent(m2.split('&')[0]));
    }
    return;
  }
  if (e.url.indexOf('#set-workspace') !== -1) {
    handleShopAddWorkspace();
    return;
  }
  if (e.url.indexOf('#remove-workspace:') !== -1) {
    var m3 = e.url.split('#remove-workspace:')[1];
    if (m3) {
      handleShopRemoveWorkspace(decodeURIComponent(m3.split('&')[0]));
    }
    return;
  }
});

// 技能商店：导入 / 删除

// 导入/删除后刷新技能缓存与商店列表，并通过 toast 提示结果
function refreshShopAfterChange(message) {
  window.Skills.reload().then(function () {
    invalidateSkillMentionCache();
    return window.Skills.getAll();
  }).then(function (list) {
    return window.electron.getSystemSkillIds().then(function (systemIds) {
      var shopSkills = (list || []).filter(function (s) { return s && !s.builtin; });
      for (var i = 0; i < shopSkills.length; i++) {
        shopSkills[i].deletable = (systemIds || []).indexOf(shopSkills[i].id) === -1;
      }
      try {
        localStorage.setItem('ai-talk-skill-list', JSON.stringify(shopSkills));
      } catch (e) {
        console.warn('[Shop] 写入技能列表失败:', e);
      }
      return writeWorkspaceListToLocalStorage();
    }).then(function () {
      if (message) {
        localStorage.setItem('ai-talk-shop-toast', JSON.stringify(message));
      }
      // 带时间戳参数强制整页重新加载，避免 hash 残留导致的误触发/不刷新
      webview.src = 'shop.html?t=' + Date.now();
    });
  }).catch(function () {
    if (message) {
      localStorage.setItem('ai-talk-shop-toast', JSON.stringify(message));
    }
    webview.src = 'shop.html?t=' + Date.now();
  });
}

// 导入技能：主进程弹出文件选择框，支持 .md / .zip
function handleSkillImport() {
  window.electron.importSkill().then(function (result) {
    if (!result) return;
    if (result.canceled) {
      // 用户取消：清除 hash，保证下次点击导入按钮仍可触发
      webview.src = 'shop.html?t=' + Date.now();
      return;
    }
    var message;
    if (result.success) {
      var names = (result.imported || []).map(function (it) { return it.name; });
      var text = '已导入技能：' + names.join('、');
      if (result.skipped && result.skipped.length > 0) {
        text += '（跳过 ' + result.skipped.length + ' 个无效/重名文件）';
      }
      message = { type: 'success', text: text };
    } else {
      message = { type: 'error', text: result.error || '导入失败' };
    }
    refreshShopAfterChange(message);
  }).catch(function (err) {
    refreshShopAfterChange({
      type: 'error',
      text: '导入失败：' + (err && err.message ? err.message : '未知错误')
    });
  });
}

// 删除技能：系统默认技能由主进程拦截，不可删除
function handleSkillDelete(skillId) {
  if (!skillId) return;
  window.electron.deleteSkill(skillId).then(function (result) {
    var message;
    if (result && result.success) {
      message = { type: 'success', text: '已删除技能' };
    } else {
      message = { type: 'error', text: (result && result.error) || '删除失败' };
    }
    refreshShopAfterChange(message);
  }).catch(function (err) {
    refreshShopAfterChange({
      type: 'error',
      text: '删除失败：' + (err && err.message ? err.message : '未知错误')
    });
  });
}

// 关闭技能商店：返回 API 对话模式
function handleShopClose() {
  if (typeof enterAPIMode === 'function' && !isAPIMode) {
    enterAPIMode();
  }
  webview.setAttribute('src', 'second.html');
}

// 从商店引用技能：回到 API 对话模式并加入技能引用
function handleShopSkillSelect(skillId) {
  AuditLog.logUserAction({
    action: 'skill_reference_from_shop',
    detail: JSON.stringify({ skillId: skillId })
  });
  if (typeof enterAPIMode === 'function' && !isAPIMode) {
    enterAPIMode();
  }
  // 后台切回默认页，避免下次打开 webview 时停留在商店（保持审计记录一致）
  webview.setAttribute('src', 'second.html');
  window.Skills.get(skillId).then(function (skill) {
    if (skill) {
      addSkillChip(skill);
      if (chatInput) chatInput.focus();
    } else {
      console.warn('[Shop] 未找到技能:', skillId);
    }
  });
}

manualBtn.addEventListener('click', () => {
  navigateWebview('../../assets/Readme.pdf');
});

// 打开代理设置弹窗
setProxyBtn.addEventListener('click', () => {
  window.electron.openProxyDialog();
});

// 打开版本信息弹窗
versionBtn.addEventListener('click', () => {
  window.electron.openVersionDialog();
});

browserButton.addEventListener('click', function () {
  if (isAPIMode) {
    leaveAPIMode();
  }

  let url = '';

  try {
    url = webview.getURL();
  } catch (e) {
    url = webview.getAttribute('src') || '';
  }

  if (!url || url === 'about:blank') {
    console.warn('webview 当前没有 URL。');
    return;
  }

  // 1) 分离到新的 BrowserWindow（会话保持）
  window.electron.detachWebview(url);
  // 审计日志：记录会话分身事件
  AuditLog.logUserAction({
    action: 'webview_detach',
    detail: JSON.stringify({ url: url })
  });

  // 2) 清空 webview
  webview.stop();
  webview.setAttribute('src', 'about:blank');
});

// 数据面板切换

var dataPanelBtn = document.getElementById('data-panel-btn');
var dataPanelEl = document.getElementById('data-panel');
var isDataPanelOpen = false;
// 记录打开数据面板之前的模式状态
var _prevWasAPIMode = false;

function openDataPanel() {
  if (isDataPanelOpen) return;
  isDataPanelOpen = true;
  _prevWasAPIMode = isAPIMode;

  // 隐藏右侧所有视图
  webview.style.display = 'none';
  if (apiChatContainer) apiChatContainer.style.display = 'none';

  // 显示数据面板并渲染
  if (dataPanelEl) {
    dataPanelEl.style.display = 'flex';
    if (window.DataPanel && window.DataPanel.render) {
      window.DataPanel.render();
    }
  }
}

function closeDataPanel() {
  if (!isDataPanelOpen) return;
  isDataPanelOpen = false;

  // 隐藏数据面板
  if (dataPanelEl) dataPanelEl.style.display = 'none';

  // 恢复之前的视图
  if (_prevWasAPIMode) {
    webview.style.display = 'none';
    if (apiChatContainer) apiChatContainer.style.display = 'flex';
  } else {
    webview.style.display = '';
    if (apiChatContainer) apiChatContainer.style.display = 'none';
  }
}

if (dataPanelBtn) {
  dataPanelBtn.addEventListener('click', function () {
    if (isDataPanelOpen) {
      closeDataPanel();
    } else {
      openDataPanel();
    }
  });
}

// 数据面板关闭按钮事件（延迟绑定，因为 data-panel.html 是后来加载的）
document.addEventListener('click', function (e) {
  if (e.target.id === 'dp-close-btn' || (e.target.closest && e.target.closest('#dp-close-btn'))) {
    closeDataPanel();
  }
});

// 侧边栏对话模式下拉切换

var dialogueTrigger = document.getElementById('dialogue-trigger');
var dialogueToggleBtn = document.getElementById('dialogue-toggle-btn');
var dialogueDropdown = document.getElementById('dialogue-dropdown');
var dialogueModeLabel = document.getElementById('dialogue-mode-label');

dialogueTrigger.addEventListener('click', function (e) {
  // 阻止冒泡，避免误触其他下拉
  e.stopPropagation();
  var isOpen = dialogueDropdown.style.display === 'block';
  dialogueDropdown.style.display = isOpen ? 'none' : 'block';
  if (isOpen) {
    dialogueToggleBtn.classList.remove('open');
  } else {
    dialogueToggleBtn.classList.add('open');
  }
});

dialogueDropdown.addEventListener('click', function (e) {
  var option = e.target.closest('.dialogue-option');
  if (!option) return;
  var mode = option.getAttribute('data-mode');

  var allOptions = dialogueDropdown.querySelectorAll('.dialogue-option');
  allOptions.forEach(function (opt) { opt.classList.remove('active'); });
  option.classList.add('active');

  if (mode === 'api') {
    dialogueModeLabel.textContent = 'API 模式';
    enterAPIMode();
  } else {
    dialogueModeLabel.textContent = '默认模式';
    leaveAPIMode();
  }

  // 关闭下拉
  dialogueDropdown.style.display = 'none';
  dialogueToggleBtn.classList.remove('open');
});

// 点击页面其他地方关闭下拉
document.addEventListener('click', function (e) {
  if (!dialogueTrigger.contains(e.target)) {
    dialogueDropdown.style.display = 'none';
    dialogueToggleBtn.classList.remove('open');
  }
});

// 外部调用 leaveAPIMode 时同步更新 UI
var _originalLeaveAPIMode = leaveAPIMode;
leaveAPIMode = function () {
  _originalLeaveAPIMode();
  dialogueModeLabel.textContent = '默认模式';
  var allOptions = dialogueDropdown.querySelectorAll('.dialogue-option');
  allOptions.forEach(function (opt) {
    opt.classList.remove('active');
    if (opt.getAttribute('data-mode') === 'web') opt.classList.add('active');
  });
  updateModeToggleButton();
};

// 外部调用 enterAPIMode 时同步更新 UI
var _originalEnterAPIMode = enterAPIMode;
enterAPIMode = function () {
  _originalEnterAPIMode();
  dialogueModeLabel.textContent = 'API 模式';
  var allOptions = dialogueDropdown.querySelectorAll('.dialogue-option');
  allOptions.forEach(function (opt) {
    opt.classList.remove('active');
    if (opt.getAttribute('data-mode') === 'api') opt.classList.add('active');
  });
  updateModeToggleButton();
};


// API 对话模式

// DOM 元素引用
var sidebarModelView = document.getElementById('sidebar-model-view');
var sidebarHistoryView = document.getElementById('sidebar-history-view');
var apiChatContainer = document.getElementById('api-chat-container');
var chatInput = document.getElementById('chat-input');
var btnSend = document.getElementById('btn-send');
var chatModelSelect = document.getElementById('chat-model-select');
var chatProviderSelect = document.getElementById('chat-provider-select');
var chatWelcomeText = document.getElementById('chat-welcome-text');
var modalOverlay = document.getElementById('api-config-overlay');
var apiChatBtn = document.getElementById('api-chat-btn');
var apiModeBtnLabel = document.getElementById('api-mode-btn-label');
var apiModeBtnIcon = document.getElementById('api-mode-btn-icon');
var apiModeToggleItem = document.getElementById('api-mode-toggle-item');

var isAPIMode = false;

// 自定义下拉组件（原生 select 隐藏保留值/事件，UI 由此渲染）

// 判断选项是否支持联网搜索（model 下拉 value 为 providerId::model）
function isWebSearchOption(value, customId) {
  if (!value) return false;
  var pid = customId === 'chat-model-custom' ? String(value).split('::')[0] : String(value);
  var p = AI_PROVIDERS[pid];
  return !!(p && p.supportsWebSearch);
}

// 测量文本宽度（用于下拉按钮宽度自适应）
function measureTextWidth(text, font) {
  var s = document.createElement('span');
  s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:' + font + ';';
  s.textContent = text;
  document.body.appendChild(s);
  var w = s.getBoundingClientRect().width;
  document.body.removeChild(s);
  return w;
}

// 渲染自定义下拉 UI（按钮 + 面板），原生 select 保持 value/disabled 状态
function renderCustomSelect(customId, selectEl) {
  var customEl = document.getElementById(customId);
  if (!customEl || !selectEl) return;

  customEl.innerHTML = '';
  customEl.classList.toggle('cs-disabled', !!selectEl.disabled);

  // 收集选项数据（支持 optgroup 分组，同一厂商只保留一个标题）
  var list = [];
  var lastHeader = null;
  for (var i = 0; i < selectEl.options.length; i++) {
    var o = selectEl.options[i];
    var parent = o.parentNode;
    var inGroup = parent && parent.tagName === 'OPTGROUP';
    if (inGroup) {
      var gLabel = String(parent.label || '').replace(/（可联网）$/, '');
      if (lastHeader !== gLabel) {
        list.push({ isHeader: true, label: gLabel });
        lastHeader = gLabel;
      }
    }
    list.push({ isHeader: false, value: o.value, text: o.textContent, web: isWebSearchOption(o.value, customId) });
  }

  // 按钮：显示当前选中项纯文本
  var curOpt = selectEl.options[selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0];
  var curText = curOpt ? curOpt.textContent : '';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cs-btn';
  var textSpan = document.createElement('span');
  textSpan.className = 'cs-text';
  textSpan.textContent = curText;
  var arrow = document.createElement('span');
  arrow.className = 'cs-arrow';
  arrow.textContent = '▾';
  btn.appendChild(textSpan);
  btn.appendChild(arrow);
  customEl.appendChild(btn);

  // 按钮宽度随选中文本自适应（箭头跟随文本，不按最长选项）
  var style = getComputedStyle(btn);
  var font = style.fontSize + ' ' + style.fontFamily;
  var minW = customId === 'chat-model-custom' ? 60 : 48;
  btn.style.width = Math.max(minW, measureTextWidth(curText, font) + 32) + 'px';

  // 面板：选项列表（含蓝色可联网徽标）
  var panel = document.createElement('div');
  panel.className = 'cs-panel';
  for (var j = 0; j < list.length; j++) {
    var it = list[j];
    if (it.isHeader) {
      var gl = document.createElement('div');
      gl.className = 'cs-group-label';
      gl.textContent = it.label;
      panel.appendChild(gl);
      continue;
    }
    var item = document.createElement('div');
    item.className = 'cs-item' + (it.value === selectEl.value ? ' selected' : '');
    if (it.value !== undefined) item.dataset.value = it.value;
    var nameSpan = document.createElement('span');
    nameSpan.className = 'cs-item-name';
    nameSpan.textContent = it.text;
    item.appendChild(nameSpan);
    if (it.web) {
      // 名称与徽标之间保留一个空格，避免文本层粘连
      item.appendChild(document.createTextNode(' '));
      var badge = document.createElement('span');
      badge.className = 'cs-web';
      badge.textContent = '可联网';
      item.appendChild(badge);
    }
    panel.appendChild(item);
  }
  customEl.appendChild(panel);
}

// 自定义下拉交互（展开/选中/外部点击关闭）
document.addEventListener('click', function (e) {
  var cs = e.target.closest('.custom-select');
  var openList = document.querySelectorAll('.custom-select.open');
  for (var i = 0; i < openList.length; i++) {
    if (!cs || openList[i] !== cs) openList[i].classList.remove('open');
  }
  if (!cs) return;
  if (cs.classList.contains('cs-disabled')) return;
  if (e.target.closest('.cs-btn')) {
    cs.classList.toggle('open');
    return;
  }
  if (e.target.closest('.cs-item')) {
    var item = e.target.closest('.cs-item');
    var selectId = cs.id === 'chat-model-custom' ? 'chat-model-select' : 'chat-provider-select';
    var selectEl = document.getElementById(selectId);
    if (selectEl && item.dataset.value) {
      selectEl.value = item.dataset.value;
      selectEl.dispatchEvent(new Event('change'));
    }
    cs.classList.remove('open');
  }
});

// 填充头部提供商下拉框
function updateProviderSelect() {
  if (!chatProviderSelect) return;

  var currentId = ApiConfig.getCurrentProvider();
  var hasSelected = localStorage.getItem('ai-talk-current-provider');
  var allConfigs = ApiConfig.loadAll();

  chatProviderSelect.innerHTML = '';

  // 遍历所有提供商，全部显示（不再显示「未配置 API」占位项）
  var providerIds = Object.keys(AI_PROVIDERS);
  for (var i = 0; i < providerIds.length; i++) {
    var pid = providerIds[i];
    var provider = AI_PROVIDERS[pid];
    // 跳过非提供商条目（如 mergeExternalConfig 函数）
    if (!provider.name) continue;
    var saved = allConfigs[pid] || {};

    var opt = document.createElement('option');
    opt.value = pid;
    opt.textContent = provider.name;
    if (pid === currentId) opt.selected = true;
    chatProviderSelect.appendChild(opt);
  }

  // 从未选过提供商时默认选中 DeepSeek
  if (!hasSelected) {
    chatProviderSelect.value = 'deepseek';
    ApiConfig.setCurrentProvider('deepseek');
    updateProviderInfo('deepseek');
  } else {
    updateProviderInfo(currentId);
  }
}

// 更新当前提供商相关的 UI（标题、模型列表、Logo）
function updateProviderInfo(providerId) {
  var provider = AI_PROVIDERS[providerId];
  var headerLogo = document.getElementById('chat-provider-logo');

  if (!provider) {
    // 未配置 API：显示默认 logo
    if (headerLogo) {
      headerLogo.src = '../../assets/zdy.png';
      headerLogo.style.display = 'block';
    }
    if (chatWelcomeText) {
      chatWelcomeText.textContent = '请先配置 API Key 开始对话';
    }
    return;
  }

  if (headerLogo && provider.logo && provider.logo.startsWith('../../assets/')) {
    headerLogo.src = provider.logo;
  }

  if (chatWelcomeText) {
    chatWelcomeText.textContent = '向 ' + provider.name + ' 发送消息开始对话';
  }

  updateChatModelSelect(providerId);

  ChatManager.setProviderLogo(provider.logo);

  // 刷新联网搜索按钮状态（provider/模型切换时）
  updateWebSearchBtnState();

  // 同步顶部栏提供商自定义下拉 UI（选中态/宽度）
  renderCustomSelect('chat-provider-custom', chatProviderSelect);
}

// 提供商下拉框切换事件
if (chatProviderSelect) {
  chatProviderSelect.addEventListener('change', function () {
    var newProviderId = this.value;
    if (newProviderId) {
      ApiConfig.setCurrentProvider(newProviderId);
    }
    // 审计日志：记录提供商切换
    AuditLog.logUserAction({ action: 'provider_switch', detail: newProviderId || 'none' });
    updateProviderInfo(newProviderId);
  });
}

function getProviderModelOptions(providerId) {
  var provider = AI_PROVIDERS[providerId];
  var saved = ApiConfig.get(providerId);
  var options = provider && provider.models ? provider.models.slice() : [];
  var savedModel = saved && saved.model ? saved.model.trim() : '';

  if (savedModel && options.indexOf(savedModel) === -1) {
    options.unshift(savedModel);
  }
  if (!options.length && provider && provider.defaultModel) {
    options.push(provider.defaultModel);
  }
  return options;
}

// 获取所有已配置 API Key 的 provider 及其模型，返回 [{providerId, providerName, logo, models[]}]
function getConfiguredProviders() {
  var result = [];
  var ids = Object.keys(AI_PROVIDERS);
  for (var i = 0; i < ids.length; i++) {
    var cfg = ApiConfig.get(ids[i]);
    if (cfg.apiKey) {
      var p = AI_PROVIDERS[ids[i]];
      if (p) {
        result.push({
          providerId: ids[i],
          providerName: p.name,
          logo: p.logo,
          models: getProviderModelOptions(ids[i])
        });
      }
    }
  }
  return result;
}

function updateChatModelSelect(providerId) {
  if (!chatModelSelect) return;
  var currentProvider = providerId || ApiConfig.getCurrentProvider();
  var currentConfig = ApiConfig.get(currentProvider);
  var savedModel = currentConfig && currentConfig.model ? currentConfig.model.trim() : '';
  var hasKey = !!(currentConfig && currentConfig.apiKey);
  var configured = getConfiguredProviders();

  chatModelSelect.innerHTML = '';

  // 未配置任何 API Key 的空状态
  if (configured.length === 0) {
    var emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '未配置 API Key';
    chatModelSelect.appendChild(emptyOpt);
    chatModelSelect.disabled = true;
    renderCustomSelect('chat-model-custom', chatModelSelect);
    return;
  }

  // 当前 provider 无 API Key 时，添加提示选项
  if (!hasKey) {
    var warnOpt = document.createElement('option');
    warnOpt.value = '';
    warnOpt.textContent = '请先配置 API Key';
    warnOpt.disabled = true;
    chatModelSelect.appendChild(warnOpt);
  }

  for (var pi = 0; pi < configured.length; pi++) {
    var cp = configured[pi];
    // 用 optgroup 按 provider 分组
    var group = document.createElement('optgroup');
    group.label = cp.providerName;

    for (var mi = 0; mi < cp.models.length; mi++) {
      var opt = document.createElement('option');
      opt.value = cp.providerId + '::' + cp.models[mi];
      opt.textContent = cp.models[mi];
      group.appendChild(opt);
    }
    chatModelSelect.appendChild(group);
  }

  chatModelSelect.disabled = false;

  // 选中当前 provider 的已保存模型
  var targetValue = currentProvider + '::' + savedModel;
  var found = false;
  for (var si = 0; si < chatModelSelect.options.length; si++) {
    if (chatModelSelect.options[si].value === targetValue) {
      chatModelSelect.selectedIndex = si;
      found = true;
      break;
    }
  }
  // 当前 provider 无 Key，默认选中提示项
  if (!hasKey && !found && chatModelSelect.options.length > 0) {
    chatModelSelect.selectedIndex = 0;
    found = true;
  }
  // fallback: 选第一个有效选项
  if (!found) {
    for (var si2 = 0; si2 < chatModelSelect.options.length; si2++) {
      if (chatModelSelect.options[si2].value) {
        chatModelSelect.selectedIndex = si2;
        break;
      }
    }
  }

  // 同步当前 provider 的 saved model（如果下拉中有对应值）
  var currentVal = chatModelSelect.value;
  if (currentVal) {
    var parts = currentVal.split('::');
    if (parts[0] === currentProvider && parts[1] && parts[1] !== savedModel) {
      ApiConfig.setModel(currentProvider, parts[1]);
    }
  }

  // 同步输入框模型自定义下拉 UI（选中态/宽度/可联网徽标）
  renderCustomSelect('chat-model-custom', chatModelSelect);
}

function updateModeToggleButton() {
  if (!apiModeBtnLabel || !apiModeBtnIcon) return;

  if (isAPIMode) {
    apiModeBtnLabel.textContent = '默认模式';
    apiModeBtnIcon.src = '../../assets/default.svg';
    if (apiModeToggleItem) apiModeToggleItem.classList.add('mode-active');
  } else {
    apiModeBtnLabel.textContent = 'API 模式';
    apiModeBtnIcon.src = '../../assets/api.svg';
    if (apiModeToggleItem) apiModeToggleItem.classList.remove('mode-active');
  }
}

// 模式切换

// 进入 API 对话模式
function enterAPIMode() {
  // 关闭数据面板（如果打开）
  if (typeof closeDataPanel === 'function') closeDataPanel();
  // 审计日志：记录模式切换
  AuditLog.logUserAction({ action: 'mode_switch', detail: 'default -> api' });
  isAPIMode = true;

  // 切换侧边栏视图
  sidebarModelView.style.display = 'none';
  sidebarHistoryView.style.display = 'flex';

  // 切换右侧内容
  webview.style.display = 'none';
  apiChatContainer.style.display = 'flex';

  // 填充头部提供商下拉框
  updateProviderSelect();

  // 刷新历史记录列表
  ChatManager.updateHistoryList();

  // 恢复上次会话
  var lastConvId = localStorage.getItem('ai-talk-current-conv');
  if (lastConvId) {
    ChatManager.loadConversation(lastConvId);
  }
}

// 退出 API 对话模式
function leaveAPIMode() {
  // 关闭数据面板（如果打开）
  if (typeof closeDataPanel === 'function') closeDataPanel();
  // 审计日志：记录模式切换
  AuditLog.logUserAction({ action: 'mode_switch', detail: 'api -> default' });
  isAPIMode = false;

  // 恢复侧边栏视图
  sidebarHistoryView.style.display = 'none';
  sidebarModelView.style.display = '';

  // 恢复右侧内容
  apiChatContainer.style.display = 'none';
  webview.style.display = '';
}

apiChatBtn.addEventListener('click', function () {
  if (isAPIMode) {
    leaveAPIMode();
  } else {
    enterAPIMode();
  }
});

document.getElementById('btn-new-chat').addEventListener('click', async function () {
  AuditLog.logUserAction({ action: 'new_conversation' });
  if (window.clearReferenceChips) window.clearReferenceChips();
  await ChatManager.newConversation();
  ChatManager.updateHistoryList();
});

// 语言选择器（回答语言）

var langSelectorWrap = document.getElementById('lang-selector-wrap');
var btnLangSelect = document.getElementById('btn-lang-select');
var langLabel = document.getElementById('lang-label');
var langDropdown = document.getElementById('lang-dropdown');
var selectedLang = ''; // 空字符串表示不指定语言

btnLangSelect.addEventListener('click', function (e) {
  e.stopPropagation();
  var isOpen = langDropdown.style.display === 'block';
  langDropdown.style.display = isOpen ? 'none' : 'block';
});

langDropdown.addEventListener('click', function (e) {
  var option = e.target.closest('.lang-option');
  if (!option) return;
  var lang = option.getAttribute('data-lang');
  selectedLang = lang;
  var allOpts = langDropdown.querySelectorAll('.lang-option');
  allOpts.forEach(function (o) { o.classList.remove('selected'); });
  option.classList.add('selected');
  if (lang) {
    langLabel.textContent = lang;
    btnLangSelect.classList.add('active');
  } else {
    langLabel.textContent = '语言';
    btnLangSelect.classList.remove('active');
  }
  langDropdown.style.display = 'none';
});

// 点击外部关闭
document.addEventListener('click', function (e) {
  if (!langSelectorWrap.contains(e.target)) {
    langDropdown.style.display = 'none';
  }
});

// 消息发送

// 联网搜索按钮状态管理
var webSearchBtn = document.getElementById('web-search-btn');

// 获取当前实际生效的 provider（底部模型选择器优先，支持跨 provider 格式 providerId::model）
function getActiveWebSearchProvider() {
  if (chatModelSelect && chatModelSelect.value) {
    var val = chatModelSelect.value;
    var sepIdx = val.indexOf('::');
    if (sepIdx !== -1) return val.substring(0, sepIdx);
  }
  return ApiConfig.getCurrentProvider();
}

// 根据当前模型刷新联网搜索按钮可用状态（不支持则禁用并灰显）
function updateWebSearchBtnState() {
  if (!webSearchBtn) return;
  var providerId = getActiveWebSearchProvider();
  var provider = AI_PROVIDERS[providerId];
  var supported = !!(provider && provider.supportsWebSearch);
  webSearchBtn.disabled = !supported;
  webSearchBtn.classList.toggle('disabled', !supported);
  if (!supported) webSearchBtn.classList.remove('active');
  webSearchBtn.title = supported ? '联网搜索' : '当前模型不支持联网搜索';
}

function isWebSearchEnabled() {
  return !!(webSearchBtn && !webSearchBtn.disabled && webSearchBtn.classList.contains('active'));
}

if (webSearchBtn) {
  webSearchBtn.addEventListener('click', function () {
    if (this.disabled) return;
    this.classList.toggle('active');
  });
}

// 附件（文件/文件夹）

var chatAttachments = []; // { path, name, kind: 'file'|'dir' }
var btnAttachFile = document.getElementById('btn-attach-file');

// 取路径最后一段作为显示名
function pathBaseName(p) {
  p = String(p || '').replace(/[\\/]+$/, '');
  var i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return i === -1 ? p : p.substring(i + 1);
}

var ATTACH_ICON_FILE = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
var ATTACH_ICON_DIR = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';

// 附件 chip 与 @技能/@会话 引用合并到同一行渲染（统一走 renderChips）
function renderAttachmentChips() {
  renderChips();
}

function clearAttachments() {
  chatAttachments = [];
  renderAttachmentChips();
}

if (btnAttachFile) {
  btnAttachFile.addEventListener('click', function () {
    window.electron.chooseAttachments().then(function (res) {
      if (!res || res.canceled) return;
      var items = res.items || [];
      if (items.length === 0) return;
      var outside = res.outside || [];
      var addedItems = [];
      // 添加附件并记录（附件以路径引用形式参与对话，不读取文件内容）
      function addItems(list) {
        list.forEach(function (it) {
          chatAttachments.push({ path: it.path, name: pathBaseName(it.path), kind: it.kind });
          addedItems.push(it);
        });
      }
      // 全部在允许范围内：直接添加
      if (outside.length === 0) {
        addItems(items);
        renderAttachmentChips();
        logAttachAction(addedItems);
        return;
      }
      // 有路径不在允许范围内：自定义弹窗确认后添加（替代原生框架弹窗，无 logo，按钮黑色居中）
      window.showConfirmDialog({
        title: '路径不在允许访问范围内',
        message: '选择的路径不在「技能商店 → 允许访问的路径」中：\n' + outside.join('\n') +
          '\n\n以下路径将作为引用添加到对话中（不发送文件内容）：\n' +
          items.map(function (it) { return it.path; }).join('\n') +
          '\n\n允许访问的路径可在技能商店中设置。',
        buttons: [
          { label: '取消', value: false },
          { label: '仍然添加', value: true, primary: true }
        ],
        defaultId: 0
      }).then(function (confirmed) {
        if (confirmed) {
          addItems(items);
        } else {
          // 仅添加允许范围内的
          addItems(items.filter(function (it) { return outside.indexOf(it.path) === -1; }));
        }
        renderAttachmentChips();
        logAttachAction(addedItems);
      });
    });
  });
}

// 记录附件引用日志（用户调用路径，用于审计追溯）
function logAttachAction(items) {
  try {
    AuditLog.logUserAction({
      action: 'attach_files',
      detail: JSON.stringify((items || []).map(function (it) {
        return { name: pathBaseName(it.path), path: it.path, kind: it.kind };
      }))
    });
  } catch (e) {}
}

// 发送前附件敏感数据外发预检：对「允许访问的路径」内的文本附件做本地 DLP 检测
// （内容仅在本机检测，不发送给模型）。命中敏感数据时弹窗让用户选择：
//   mask  → 继续发送，后续模型读取命中内容自动打码
//   skip  → 不发送含敏感数据的文件
//   cancel→ 取消本次发送
// 工作区外的附件模型本就读不了（无外发风险），跳过检测；文件夹由会话内 scan_sensitive 覆盖。
function preflightAttachments(attachments) {
  var files = (attachments || []).filter(function (a) { return a.kind === 'file'; });
  if (files.length === 0) return Promise.resolve({ continue: true, attachments: attachments });
  var jobs = files.map(function (a) {
    return window.electron.readAttachmentContent(a.path).then(function (res) {
      if (!res || !res.ok) return { item: a, dlp: null };
      if (typeof runDlpCheck !== 'function') return { item: a, dlp: null };
      var r = runDlpCheck(res.content);
      return { item: a, dlp: (r && r.found) ? r : null, truncated: !!res.truncated };
    }).catch(function () {
      return { item: a, dlp: null };
    });
  });
  return Promise.all(jobs).then(function (results) {
    var hits = [];
    var hitPaths = {};
    var truncated = false;
    for (var i = 0; i < results.length; i++) {
      var rr = results[i];
      if (!rr.dlp || !rr.dlp.found) continue;
      hitPaths[rr.item.path] = true;
      if (rr.truncated) truncated = true;
      for (var j = 0; j < rr.dlp.items.length; j++) {
        hits.push({
          file: rr.item.name,
          path: rr.item.path,
          rule: rr.dlp.items[j].name,
          severity: rr.dlp.items[j].severity,
          value: rr.dlp.items[j].value,
          masked: rr.dlp.items[j].masked
        });
      }
    }
    if (hits.length === 0) return { continue: true, attachments: attachments };
    // 与对话模式一致的 HTML 告警弹窗：继续发送（自动打码）/ 跳过敏感文件 / 取消发送
    // 日志记录与文本 DLP 一致：仅在用户决策后记一条（masked/skip/cancel），不记录弹窗中间态
    return showAttachmentDlpWarning(hits, truncated).then(function (decision) {
      var action = (decision && decision.action) || 'skip';
      var ignoredValues = (decision && decision.ignoredValues) || [];
      if (action === 'cancel') return { continue: false };
      if (action === 'skip') {
        return {
          continue: true,
          attachments: (attachments || []).filter(function (a) { return !hitPaths[a.path]; }),
          sensitiveMode: 'skip'
        };
      }
      return { continue: true, attachments: attachments, sensitiveMode: 'mask', ignoredValues: ignoredValues };
    });
  });
}

// 设置按钮为发送/停止状态
function setSendBtnState(sending) {
  if (sending) {
    btnSend.textContent = '停止';
    btnSend.classList.add('btn-stop');
    btnSend.disabled = false;
  } else {
    btnSend.textContent = '发送';
    btnSend.classList.remove('btn-stop');
    btnSend.disabled = false;
  }
}

// 执行真正的发送：文本内容 DLP 检查 → 调用 ChatManager.sendMessage
function performSend(content, attachments, refConvIds, refConvTitles, langInstruction, skillIds, sendOptions) {
  var finish = function (finalContent, attachRefs) {
    // 文本内容 DLP 敏感数据检查
    var dlpResult = runDlpCheck(finalContent);
    if (dlpResult && dlpResult.found) {
      _dlpPendingContent = finalContent;
      _dlpPendingRefConvIds = refConvIds;
      _dlpPendingRefConvTitles = refConvTitles;
      _dlpPendingLangInstruction = langInstruction;
      _dlpPendingSkillIds = skillIds;
      _dlpPendingAttachmentRefs = attachRefs || [];
      _dlpPendingSensitiveMode = sendOptions || null;
      showDlpWarning(dlpResult);
      return;
    }
    clearAttachments();
    setSendBtnState(true);
    ChatManager.sendMessage(finalContent, refConvIds, langInstruction, refConvTitles, isWebSearchEnabled(), skillIds, attachRefs || [], sendOptions).finally(function () {
      setSendBtnState(false);
    });
  };
  finish(content, attachments);
}

btnSend.addEventListener('click', function () {
  if (btnSend.textContent === '停止') {
    ChatManager.stopMessage();
    setSendBtnState(false);
    return;
  }

  var content = chatInput.value.trim();
  var attachments = chatAttachments.slice();
  if (!content && attachments.length === 0) return;

  // 发送前附件敏感数据预检（本地 DLP，命中则弹窗让用户选择处理方式），确认后再发送
  preflightAttachments(attachments).then(function (pf) {
    if (!pf.continue) return; // 用户取消发送：保留输入与附件，可修改后重试
    chatInput.value = '';
    chatInput.style.height = 'auto';
    resetAutoExpandedInput();
    // 语言指令：作为隐藏 system 消息发送，不污染用户可见内容
    var langInstruction = selectedLang ? LANG_INSTRUCTION_TEMPLATE.replace('{lang}', selectedLang) : '';
    // 先保存引用 ID，再清除 chips（防止 sendMessage 读取时已被清空）
    var refConvIds = window.getReferenceConvIds ? window.getReferenceConvIds() : [];
    var refConvTitles = window.getReferenceChipTitles ? window.getReferenceChipTitles() : [];
    var skillIds = window.getReferenceSkillIds ? window.getReferenceSkillIds() : [];
    if (window.clearReferenceChips) window.clearReferenceChips();
    performSend(content, pf.attachments || attachments, refConvIds, refConvTitles, langInstruction, skillIds,
      pf.sensitiveMode ? { sensitiveMode: pf.sensitiveMode, ignoredValues: pf.ignoredValues || [] } : undefined);
  }).catch(function () {
    // 预检异常时仍按原逻辑发送
    chatInput.value = '';
    chatInput.style.height = 'auto';
    resetAutoExpandedInput();
    var langInstruction = selectedLang ? LANG_INSTRUCTION_TEMPLATE.replace('{lang}', selectedLang) : '';
    var refConvIds = window.getReferenceConvIds ? window.getReferenceConvIds() : [];
    var refConvTitles = window.getReferenceChipTitles ? window.getReferenceChipTitles() : [];
    var skillIds = window.getReferenceSkillIds ? window.getReferenceSkillIds() : [];
    if (window.clearReferenceChips) window.clearReferenceChips();
    // 预检异常时仍发送，但按“跳过敏感文件”策略保护后续工具读取
    performSend(content, attachments, refConvIds, refConvTitles, langInstruction, skillIds, { sensitiveMode: 'skip' });
  });
});

// @mention 历史会话引用

var mentionDropdown = document.getElementById('mention-dropdown');
var mentionList = document.getElementById('mention-list');
var referenceChipsEl = document.getElementById('reference-chips');

var mentionActive = false;        // 下拉框是否打开
var mentionMode = 'conv';         // 下拉模式：'conv' 历史会话 | 'skill' 技能
var mentionStartPos = -1;         // @ 在 textarea 中的位置
var mentionQuery = '';            // @ 后面的筛选文本
var mentionSelectedIdx = 0;       // 下拉列表选中索引
var mentionFilteredConvs = [];    // 当前筛选后的会话列表
var skillFiltered = [];           // 当前筛选后的技能列表
var referenceChips = [];          // [{ id, title }]
var skillChips = [];              // [{ id, name }]

// 技能列表缓存（@skill 下拉需要同步渲染，首次加载后缓存）
var _allSkills = [];
var _skillsLoadPromise = null;
function ensureSkillsLoaded() {
  if (!_skillsLoadPromise) {
    _skillsLoadPromise = window.Skills.getAll().then(function (list) {
      _allSkills = list || [];
      return _allSkills;
    }).catch(function () {
      _allSkills = [];
      return _allSkills;
    });
  }
  return _skillsLoadPromise;
}
ensureSkillsLoaded();

// 技能变更（导入/删除/同步）后重置 @skill 下拉缓存，保证新技能立即可见
function invalidateSkillMentionCache() {
  _skillsLoadPromise = null;
  _allSkills = [];
}

// 加载全部会话
function loadMentionConversations() {
  // 直接从 localStorage 读，避免异步竞态
  try {
    var raw = localStorage.getItem('ai-talk-conversations');
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function buildMentionList(convs, query) {
  var q = (query || '').toLowerCase();
  mentionFilteredConvs = [];
  var html = '';

  // 第一步：按标题 + 内容匹配
  var titleMatches = [];
  var contentMatches = [];
  for (var i = 0; i < convs.length; i++) {
    var c = convs[i];
    if (c.id === ChatManager.getCurrentId()) continue;
    if (!c.messages || c.messages.length === 0) continue;
    var title = (c.title || '新会话').toLowerCase();

    if (!q) {
      // 无筛选词，显示全部
      mentionFilteredConvs.push(c);
    } else if (title.indexOf(q) !== -1) {
      // 标题匹配
      titleMatches.push(c);
    } else {
      // 标题不匹配时，尝试搜索消息内容
      var matchedPreview = '';
      for (var m = 0; m < c.messages.length; m++) {
        var msgContent = (c.messages[m].content || '').toLowerCase();
        var idx = msgContent.indexOf(q);
        if (idx !== -1) {
          // 截取匹配位置前后各 30 字符作为预览
          var full = c.messages[m].content || '';
          var start = Math.max(0, idx - 25);
          var end = Math.min(full.length, idx + q.length + 25);
          matchedPreview = (start > 0 ? '...' : '') +
            full.substring(start, end).replace(/\n/g, ' ') +
            (end < full.length ? '...' : '');
          c._matchPreview = matchedPreview;
          break;
        }
      }
      if (matchedPreview) {
        contentMatches.push(c);
      }
    }
  }

  // 合并：标题匹配优先，内容匹配其次
  if (q) {
    mentionFilteredConvs = titleMatches.concat(contentMatches);
  }

  if (mentionFilteredConvs.length === 0) {
    html = '<div class="mention-empty">无匹配会话</div>';
  } else {
    for (var j = 0; j < mentionFilteredConvs.length; j++) {
      var conv = mentionFilteredConvs[j];
      var date = new Date(conv.updatedAt);
      var timeStr = (date.getMonth() + 1) + '/' + date.getDate();
      var cls = j === mentionSelectedIdx ? ' active' : '';

      var msgCount = conv.messages ? conv.messages.length : 0;
      var previewHtml = '';
      if (conv._matchPreview) {
        previewHtml = '<span class="mention-item-preview">' +
          escapeHtmlText(conv._matchPreview) + '</span>';
      }

      html += '<div class="mention-item' + cls + '" data-idx="' + j + '">' +
        '<div class="mention-item-icon">' +
        '<img src="../../assets/quote.svg" alt="" class="mention-item-icon-img">' +
        '</div>' +
        '<div class="mention-item-info">' +
        '<span class="mention-item-title">' + escapeHtmlText(conv.title || '新会话') + '</span>' +
        '<span class="mention-item-meta">' + msgCount + ' 条消息 · ' + timeStr + '</span>' +
        previewHtml +
        '</div>' +
        '</div>';
    }
  }
  mentionList.innerHTML = html;
}

// 判断 @ 后的输入是否为技能触发词（@skill）
function isSkillQuery(query) {
  return /^skill/i.test(query || '');
}

// 构建技能下拉列表（同步渲染，数据来自 _allSkills 缓存）
function buildSkillMentionList(q) {
  var query = (q || '').toLowerCase();
  skillFiltered = [];
  var used = {};
  for (var i = 0; i < skillChips.length; i++) {
    used[skillChips[i].id] = true;
  }
  for (var j = 0; j < _allSkills.length; j++) {
    var s = _allSkills[j];
    // 内置技能由系统管理，不参与 @skill 引用
    if (!s || !s.id || s.builtin || used[s.id]) continue;
    if (query) {
      var hay = ((s.name || '') + ' ' + (s.description || '')).toLowerCase();
      if (hay.indexOf(query) === -1) continue;
    }
    skillFiltered.push(s);
  }
  var html = '';
  if (skillFiltered.length === 0) {
    html = '<div class="mention-empty">无匹配技能</div>';
  } else {
    for (var k = 0; k < skillFiltered.length; k++) {
      var sk = skillFiltered[k];
      var cls = k === mentionSelectedIdx ? ' active' : '';
      html += '<div class="mention-item' + cls + '" data-skill-idx="' + k + '">' +
        '<div class="mention-item-icon">' +
        '<img src="../../assets/shop.svg" alt="" class="mention-item-icon-img">' +
        '</div>' +
        '<div class="mention-item-info">' +
        '<span class="mention-item-title">@' + escapeHtmlText(sk.name || sk.id) + '</span>' +
        '<span class="mention-item-meta">' + escapeHtmlText(sk.description || '技能') + '</span>' +
        '</div>' +
        '</div>';
    }
  }
  mentionList.innerHTML = html;
}

// 显示下拉面板
function showMentionDropdown(query) {
  mentionDropdown.style.display = 'block';
  mentionActive = true;
  mentionSelectedIdx = 0;
  // @skill 触发技能列表
  if (isSkillQuery(query)) {
    mentionMode = 'skill';
    ensureSkillsLoaded().then(function () {
      if (mentionActive && mentionMode === 'skill') {
        buildSkillMentionList(query.substring(5));
      }
    });
    return;
  }
  mentionMode = 'conv';
  var convs = loadMentionConversations();
  // 排除已引用的会话
  var refIds = {};
  for (var i = 0; i < referenceChips.length; i++) {
    refIds[referenceChips[i].id] = true;
  }
  convs = convs.filter(function (c) { return !refIds[c.id]; });
  buildMentionList(convs, query || '');
}

// 隐藏下拉面板
function hideMentionDropdown() {
  mentionDropdown.style.display = 'none';
  mentionActive = false;
  mentionMode = 'conv';
  mentionStartPos = -1;
  mentionQuery = '';
  mentionSelectedIdx = 0;
  mentionFilteredConvs = [];
  skillFiltered = [];
}

// 选中某个技能（加入 chip）
function selectSkill(skill) {
  addSkillChip(skill);
  hideMentionDropdown();
  chatInput.focus();
}

// 添加技能引用（商店 / @skill 共用）
function addSkillChip(skill) {
  if (!skill || !skill.id) return;
  for (var i = 0; i < skillChips.length; i++) {
    if (skillChips[i].id === skill.id) return;
  }
  skillChips.push({ id: skill.id, name: skill.name || skill.id });
  renderChips();
}

// 选中某个会话（加入 chip）
function selectMentionConversation(conv) {
  for (var i = 0; i < referenceChips.length; i++) {
    if (referenceChips[i].id === conv.id) return;
  }
  referenceChips.push({ id: conv.id, title: conv.title || '新会话' });
  renderChips();
  hideMentionDropdown();
  chatInput.focus();
}

// 渲染 chip 标签行（@技能 / @会话 / 附件 合并为同一行展示）
function renderChips() {
  if (!referenceChipsEl) return;
  var hasAny = referenceChips.length > 0 || skillChips.length > 0 || chatAttachments.length > 0;
  if (!hasAny) {
    referenceChipsEl.style.display = 'none';
    referenceChipsEl.innerHTML = '';
    return;
  }
  referenceChipsEl.style.display = 'flex';
  var html = '';
  for (var i = 0; i < skillChips.length; i++) {
    var sc = skillChips[i];
    html += '<span class="mention-chip skill-chip" data-skill-id="' + sc.id + '">' +
      '<span class="mention-chip-text">@' + escapeHtmlText(sc.name) + '</span>' +
      '<button class="mention-chip-remove" data-skill-idx="' + i + '" title="移除引用">×</button>' +
      '</span>';
  }
  for (var j = 0; j < referenceChips.length; j++) {
    var chip = referenceChips[j];
    html += '<span class="mention-chip" data-conv-id="' + chip.id + '">' +
      '<span class="mention-chip-text">@' + escapeHtmlText(chip.title) + '</span>' +
      '<button class="mention-chip-remove" data-idx="' + j + '" title="移除引用">×</button>' +
      '</span>';
  }
  referenceChipsEl.innerHTML = html;

  // 附件 chip 追加到同一行（样式区分类型）
  chatAttachments.forEach(function (a, idx) {
    var chip = document.createElement('span');
    chip.className = 'attachment-chip';
    chip.title = a.path;
    var icon = document.createElement('span');
    icon.className = 'attachment-chip-icon';
    icon.innerHTML = a.kind === 'dir' ? ATTACH_ICON_DIR : ATTACH_ICON_FILE;
    var name = document.createElement('span');
    name.className = 'attachment-chip-name';
    name.textContent = a.name + (a.kind === 'dir' ? '/（文件夹）' : '');
    var remove = document.createElement('button');
    remove.className = 'attachment-chip-remove';
    remove.textContent = '×';
    remove.title = '移除附件';
    remove.addEventListener('click', function () {
      chatAttachments.splice(idx, 1);
      renderChips();
    });
    chip.appendChild(icon);
    chip.appendChild(name);
    chip.appendChild(remove);
    referenceChipsEl.appendChild(chip);
  });

  var removeBtns = referenceChipsEl.querySelectorAll('.mention-chip-remove');
  for (var k = 0; k < removeBtns.length; k++) {
    removeBtns[k].addEventListener('click', function (e) {
      e.stopPropagation();
      var skillIdxAttr = this.getAttribute('data-skill-idx');
      if (skillIdxAttr !== null) {
        skillChips.splice(parseInt(skillIdxAttr, 10), 1);
      } else {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        referenceChips.splice(idx, 1);
      }
      renderChips();
    });
  }
}

// 获取当前引用会话 ID 列表（供 ChatManager 使用）
window.getReferenceConvIds = function () {
  var ids = [];
  for (var i = 0; i < referenceChips.length; i++) {
    ids.push(referenceChips[i].id);
  }
  return ids;
};

// 获取当前引用会话标题（供消息渲染引用来源用）
window.getReferenceChipTitles = function () {
  var result = [];
  for (var i = 0; i < referenceChips.length; i++) {
    result.push({ id: referenceChips[i].id, title: referenceChips[i].title });
  }
  return result;
};

// 获取当前引用技能 ID 列表（供 ChatManager 注入 systemPrompt）
window.getReferenceSkillIds = function () {
  var ids = [];
  for (var i = 0; i < skillChips.length; i++) {
    ids.push(skillChips[i].id);
  }
  return ids;
};

// 清除所有引用（发送后/新建会话时调用）
window.clearReferenceChips = function () {
  referenceChips = [];
  skillChips = [];
  renderChips();
};

// Enter 发送 / Shift+Enter 换行 / @mention 导航
chatInput.addEventListener('keydown', function (e) {
  // @mention 导航模式
  if (mentionActive) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (mentionMode === 'skill') {
        mentionSelectedIdx = Math.min(mentionSelectedIdx + 1, skillFiltered.length - 1);
        buildSkillMentionList(mentionQuery.substring(5));
      } else {
        mentionSelectedIdx = Math.min(mentionSelectedIdx + 1, mentionFilteredConvs.length - 1);
        buildMentionList(mentionFilteredConvs, mentionQuery); // 传入已筛选列表
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (mentionMode === 'skill') {
        mentionSelectedIdx = Math.max(mentionSelectedIdx - 1, 0);
        buildSkillMentionList(mentionQuery.substring(5));
      } else {
        mentionSelectedIdx = Math.max(mentionSelectedIdx - 1, 0);
        buildMentionList(mentionFilteredConvs, mentionQuery);
      }
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mentionMode === 'skill') {
        if (skillFiltered.length > 0 && mentionSelectedIdx >= 0) {
          var savedPos = mentionStartPos;
          selectSkill(skillFiltered[mentionSelectedIdx]);
          // 清除 textarea 中的 @skillquery 文本
          var val = chatInput.value;
          var before = val.substring(0, savedPos - 1); // 去掉 @
          var afterPos = chatInput.selectionStart;
          var after = val.substring(afterPos);
          chatInput.value = before + after;
        } else {
          hideMentionDropdown();
        }
      } else if (mentionFilteredConvs.length > 0 && mentionSelectedIdx >= 0) {
        var savedPos = mentionStartPos;
        selectMentionConversation(mentionFilteredConvs[mentionSelectedIdx]);
        // 清除 textarea 中的 @query 文本
        var val = chatInput.value;
        var before = val.substring(0, savedPos - 1); // 去掉 @
        var afterPos = chatInput.selectionStart;
        var after = val.substring(afterPos);
        chatInput.value = before + after;
      } else {
        hideMentionDropdown();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      hideMentionDropdown();
      return;
    }
    // 其他键继续输入用于筛选
    return;
  }

  // 正常发送模式
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    btnSend.click();
  }
});

// 输入框自动调整高度 + @mention 检测
 chatInput.addEventListener('input', function () {
   chatInput.style.height = 'auto';
   var card = document.querySelector('.chat-input-card');
   var isExpanded = card && card.classList.contains('expanded');
   if (isExpanded) {
     // 展开态：最小 120px，最大 760px
     chatInput.style.height = Math.max(120, Math.min(chatInput.scrollHeight, 760)) + 'px';
     // 自动进入的展开态：内容减少到阈值以下时自动收起
     if (autoInputExpanded && chatInput.scrollHeight <= 150) {
       autoInputExpanded = false;
       applyInputExpanded(false);
       chatInput.style.height = 'auto';
       chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
     }
   } else {
     chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
     // 内容超过阈值（如输入多行代码）时自动进入展开态：
     // 输入框随内容继续增高（最大 760px），且展开卡片为浮层不挤压消息区，避免窗口变形
     if (chatInput.scrollHeight > 150) {
       autoInputExpanded = true;
       applyInputExpanded(true);
       chatInput.style.height = Math.max(120, Math.min(chatInput.scrollHeight, 760)) + 'px';
     }
   }

  // @mention 检测
  if (!mentionActive) {
    var pos = chatInput.selectionStart;
    var textBefore = chatInput.value.substring(0, pos);
    // 检测 @ 是否在行首或空格后
    var atIdx = textBefore.lastIndexOf('@');
    if (atIdx >= 0) {
      var charBeforeAt = atIdx > 0 ? textBefore.charAt(atIdx - 1) : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || atIdx === 0) {
        mentionStartPos = atIdx + 1;
        mentionQuery = textBefore.substring(mentionStartPos);
        showMentionDropdown(mentionQuery);
      }
    }
  } else {
    // 下拉已打开，实时筛选
    var pos2 = chatInput.selectionStart;
    var textBefore2 = chatInput.value.substring(0, pos2);
    var afterAt = textBefore2.substring(mentionStartPos);
    // 如果 @ 后的文本含空格，关闭下拉
    if (afterAt.indexOf(' ') >= 0 || afterAt.indexOf('\n') >= 0 || pos2 < mentionStartPos) {
      hideMentionDropdown();
    } else {
      mentionQuery = afterAt;
      if (mentionMode === 'skill') {
        mentionSelectedIdx = 0;
        buildSkillMentionList(afterAt.substring(5));
      } else if (isSkillQuery(afterAt)) {
        // 输入过程中出现 @skill 前缀，实时切换到技能模式
        mentionMode = 'skill';
        mentionSelectedIdx = 0;
        buildSkillMentionList(afterAt.substring(5));
      } else {
        var convs = loadMentionConversations();
        var refIds = {};
        for (var i = 0; i < referenceChips.length; i++) {
          refIds[referenceChips[i].id] = true;
        }
        convs = convs.filter(function (c) { return !refIds[c.id]; });
        mentionSelectedIdx = 0;
        buildMentionList(convs, mentionQuery);
      }
    }
  }
});

// 点击输入框外部关闭下拉
document.addEventListener('click', function (e) {
  if (mentionActive) {
    var target = e.target;
    if (!mentionDropdown.contains(target) && target !== chatInput) {
      hideMentionDropdown();
    }
  }
});

// 下拉项点击选择
mentionList.addEventListener('click', function (e) {
  var item = e.target.closest('.mention-item');
  if (!item) return;
  // 技能项
  var skillIdxAttr = item.getAttribute('data-skill-idx');
  if (skillIdxAttr !== null) {
    var sIdx = parseInt(skillIdxAttr, 10);
    if (sIdx >= 0 && sIdx < skillFiltered.length) {
      var savedPos = mentionStartPos;
      selectSkill(skillFiltered[sIdx]);
      // 清除 textarea 中的 @skillquery
      var val = chatInput.value;
      var before = val.substring(0, savedPos - 1);
      chatInput.value = before;
    }
    return;
  }
  // 会话项
  var idx = parseInt(item.getAttribute('data-idx'), 10);
  if (idx >= 0 && idx < mentionFilteredConvs.length) {
    var savedPos = mentionStartPos;
    selectMentionConversation(mentionFilteredConvs[idx]);
    // 清除 textarea 中的 @query
    var val = chatInput.value;
    var before = val.substring(0, savedPos - 1);
    chatInput.value = before;
  }
});

// HTML 转义
function escapeHtmlText(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Prompt 模版面板

var promptPanel = document.getElementById('prompt-panel');
var promptToggleBtn = document.getElementById('prompt-toggle-btn');
var promptPanelClose = document.getElementById('prompt-panel-close');
var promptTemplateList = document.getElementById('prompt-template-list');
var promptAddBtn = document.getElementById('prompt-add-btn');
var isPromptPanelExpanded = false;

// Modal 元素
var promptModalOverlay = document.getElementById('prompt-modal-overlay');
var promptModalTitle = document.getElementById('prompt-modal-title');
var promptModalName = document.getElementById('prompt-modal-name');
var promptModalContent = document.getElementById('prompt-modal-content');
var promptModalSave = document.getElementById('prompt-modal-save-btn');
var promptModalCancel = document.getElementById('prompt-modal-cancel-btn');
var promptModalClose = document.getElementById('prompt-modal-close-btn');
var editingTplId = null; // 编辑模式下的模版 ID

// 渲染模版列表
function renderPromptTemplates() {
  var templates = PromptTemplates.getAll();
  var html = '';
  if (templates.length === 0) {
    html = '<div class="prompt-empty">暂无模版</div>';
  } else {
    for (var i = 0; i < templates.length; i++) {
      var tpl = templates[i];
      var preview = tpl.content.substring(0, 40);
      html += '<div class="prompt-template-item" data-id="' + tpl.id + '">' +
        '<div class="prompt-template-body">' +
          '<div class="prompt-template-title">' + escapeHtmlText(tpl.title) + '</div>' +
          '<div class="prompt-template-preview">' + escapeHtmlText(preview) + (tpl.content.length > 40 ? '...' : '') + '</div>' +
        '</div>' +
        '<div class="prompt-template-actions">' +
          '<button class="prompt-tpl-btn prompt-tpl-edit" data-id="' + tpl.id + '" title="编辑">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
          '</button>' +
          '<button class="prompt-tpl-btn prompt-tpl-del" data-id="' + tpl.id + '" title="删除">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
        '</div>' +
        '</div>';
    }
  }
  promptTemplateList.innerHTML = html;

  var bodies = promptTemplateList.querySelectorAll('.prompt-template-body');
  for (var j = 0; j < bodies.length; j++) {
    bodies[j].addEventListener('click', function () {
      var tplId = this.parentNode.getAttribute('data-id');
      var tpl = PromptTemplates.getById(tplId);
      if (tpl && chatInput) {
        chatInput.value = tpl.content;
        chatInput.focus();
        chatInput.dispatchEvent(new Event('input'));
      }
    });
  }

  var editBtns = promptTemplateList.querySelectorAll('.prompt-tpl-edit');
  for (var k = 0; k < editBtns.length; k++) {
    editBtns[k].addEventListener('click', function (e) {
      e.stopPropagation();
      var tplId = this.getAttribute('data-id');
      openPromptModal(tplId);
    });
  }

  var delBtns = promptTemplateList.querySelectorAll('.prompt-tpl-del');
  for (var m = 0; m < delBtns.length; m++) {
    delBtns[m].addEventListener('click', function (e) {
      e.stopPropagation();
      var tplId = this.getAttribute('data-id');
      window.showConfirmDialog({
        title: '删除 Prompt 模版',
        message: '确定删除该模版吗？删除后不可恢复。',
        buttons: [
          { label: '取消', value: false },
          { label: '删除', value: true, primary: true }
        ],
        defaultId: 0
      }).then(function (ok) {
        if (ok) {
          PromptTemplates.remove(tplId);
          renderPromptTemplates();
        }
      });
    });
  }
}

// 切换面板展开/折叠
function togglePromptPanel() {
  isPromptPanelExpanded = !isPromptPanelExpanded;
  if (isPromptPanelExpanded) {
    promptPanel.classList.add('expanded');
    promptToggleBtn.style.display = 'none';
    renderPromptTemplates();
  } else {
    promptPanel.classList.remove('expanded');
    promptToggleBtn.style.display = 'flex';
  }
}

function collapsePromptPanel() {
  if (isPromptPanelExpanded) {
    togglePromptPanel();
  }
}

// 打开新建/编辑 Modal
function openPromptModal(tplId) {
  editingTplId = tplId || null;
  if (tplId) {
    var tpl = PromptTemplates.getById(tplId);
    if (tpl) {
      promptModalTitle.textContent = '编辑 Prompt 模版';
      promptModalName.value = tpl.title;
      promptModalContent.value = tpl.content;
    }
  } else {
    promptModalTitle.textContent = '新建 Prompt 模版';
    promptModalName.value = '';
    promptModalContent.value = '';
  }
  // 初始化优化提供商为当前会话提供商
  _optimizeProviderId = ApiConfig.getCurrentProvider() || '';
  updateOptimizeProviderLogo();
  promptModalOverlay.style.display = 'flex';
  promptModalName.focus();
}

// 优化使用的提供商 ID（独立于会话提供商）
var _optimizeProviderId = '';

function escapeHtmlText(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 刷新优化按钮旁边的 Logo
function updateOptimizeProviderLogo() {
  var img = document.getElementById('optimize-provider-logo-img');
  if (!img) return;
  var provider = AI_PROVIDERS[_optimizeProviderId];
  if (provider && provider.logo && provider.logo.startsWith('../../assets/')) {
    img.src = provider.logo;
  } else {
    img.src = '../../assets/zdy.png';
  }
}

// 提供商 Logo 点击：显示/隐藏下拉
document.addEventListener('click', function (e) {
  var logoBtn = e.target.closest ? e.target.closest('#optimize-provider-logo') : null;
  if (logoBtn) {
    e.stopPropagation();
    var dd = document.getElementById('optimize-provider-dropdown');
    if (!dd) return;
    if (dd.style.display === 'block') {
      dd.style.display = 'none';
      return;
    }
    var html = '';
    var providerIds = Object.keys(AI_PROVIDERS);
    for (var i = 0; i < providerIds.length; i++) {
      var pid = providerIds[i];
      var p = AI_PROVIDERS[pid];
      if (!p.name) continue;
      var logo = (p.logo && p.logo.startsWith('../../assets/')) ? p.logo : '../../assets/zdy.png';
      var activeClass = pid === _optimizeProviderId ? ' active' : '';
      html += '<div class="optimize-provider-item' + activeClass + '" data-pid="' + pid + '">' +
        '<img src="' + logo + '" alt="">' +
        '<span>' + escapeHtmlText(p.name) + '</span>' +
        '</div>';
    }
    dd.innerHTML = html;
    dd.style.display = 'block';
    return;
  }
  // 选择某个提供商
  var item = e.target.closest ? e.target.closest('.optimize-provider-item') : null;
  if (item) {
    var pid = item.getAttribute('data-pid');
    if (pid) {
      _optimizeProviderId = pid;
      updateOptimizeProviderLogo();
    }
    var dd = document.getElementById('optimize-provider-dropdown');
    if (dd) dd.style.display = 'none';
    return;
  }
  // 点击其他地方关闭下拉
  if (!logoBtn) {
    var dd = document.getElementById('optimize-provider-dropdown');
    if (dd && dd.style.display === 'block') {
      dd.style.display = 'none';
    }
  }
});

// 关闭 Modal
function closePromptModal() {
  promptModalOverlay.style.display = 'none';
  editingTplId = null;
}

// 提示词优化 Meta-Prompt（从 skills 加载，此变量为兜底值）
var PROMPT_OPTIMIZE_SYSTEM = '你是一个Prompt优化专家。请优化以下提示词，使其更清晰、更结构化、更易于AI理解。\n\n优化要求：\n1. 明确角色定位和任务目标\n2. 补充必要的输出格式和约束条件\n3. 语言精炼，消除歧义\n4. 保持原始意图不变\n5. 输出语言必须与输入语言保持一致，不要翻译\n\n请直接输出优化后的提示词，不要添加解释或前缀。';
var LANG_INSTRUCTION_TEMPLATE = '请在本次对话中始终使用 {lang} 进行回答，无论用户使用何种语言提问';

// 语言选项硬编码兜底（skills 加载成功后覆盖）
var LANG_FALLBACK_OPTIONS = [
  { value: '', label: '跟随（不指定）' },
  { value: '中文', label: '中文' },
  { value: '英文', label: '英文' },
  { value: '日文', label: '日文' },
  { value: '韩文', label: '韩文' },
  { value: '法文', label: '法文' },
  { value: '德文', label: '德文' },
  { value: '西班牙文', label: '西班牙文' },
  { value: '俄文', label: '俄文' }
];

// 初始化 skills（异步覆盖硬编码兜底值）
(function initSkills() {
  Skills.get('optimize').then(function (skill) {
    if (skill && skill.systemPrompt) {
      PROMPT_OPTIMIZE_SYSTEM = skill.systemPrompt;
    }
  }).catch(function () {});

  Skills.get('translate').then(function (skill) {
    if (skill && skill.instructionTemplate) {
      LANG_INSTRUCTION_TEMPLATE = skill.instructionTemplate;
    }
    if (skill && skill.languages) {
      renderLangOptions(skill.languages);
    }
  }).catch(function () {});
})();

// 动态渲染语言下拉选项
function renderLangOptions(languages) {
  if (!langDropdown) return;
  var currentLang = selectedLang;
  langDropdown.innerHTML = '';
  for (var i = 0; i < languages.length; i++) {
    var div = document.createElement('div');
    div.className = 'lang-option' + (languages[i].value === currentLang ? ' selected' : '');
    div.setAttribute('data-lang', languages[i].value);
    div.textContent = languages[i].label;
    langDropdown.appendChild(div);
  }
}

// 立即用硬编码兜底渲染语言选项（skills 加载后会覆盖）
renderLangOptions(LANG_FALLBACK_OPTIONS);

// 全局通知弹窗（替代原生 alert，去除 Electron Logo）
function showNotification(msg) {
  var overlay = document.getElementById('global-notify-overlay');
  var msgEl = document.getElementById('global-notify-msg');
  if (!overlay || !msgEl) { alert(msg); return; }
  msgEl.textContent = msg;
  overlay.style.display = 'flex';
}

document.addEventListener('click', function (e) {
  if (e.target.id === 'global-notify-ok-btn') {
    var overlay = document.getElementById('global-notify-overlay');
    if (overlay) overlay.style.display = 'none';
  }
});

// 全局确认弹窗（替代原生 confirm / 框架弹窗，按钮黑色居中）
// opts: { title, message, buttons: [{ label, value, primary? }], defaultId }
// 返回 Promise，resolve 被点击按钮的 value
window.showConfirmDialog = function (opts) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('global-confirm-overlay');
    var titleEl = document.getElementById('global-confirm-title');
    var msgEl = document.getElementById('global-confirm-msg');
    var btnsEl = document.getElementById('global-confirm-btns');
    if (!overlay || !msgEl || !btnsEl) {
      var fallback = (opts.buttons && opts.buttons[0]) ? opts.buttons[0].value : true;
      resolve(fallback);
      return;
    }
    var buttons = opts.buttons || [];
    titleEl.textContent = opts.title || '';
    msgEl.textContent = opts.message || '';
    btnsEl.innerHTML = '';
    var done = false;
    function finish(val) {
      if (done) return;
      done = true;
      overlay.style.display = 'none';
      btnsEl.innerHTML = '';
      resolve(val);
    }
    buttons.forEach(function (b, i) {
      var btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = b.primary ? 'btn btn-primary' : 'btn btn-secondary';
      btn.addEventListener('click', function () { finish(b.value); });
      btnsEl.appendChild(btn);
    });
    if (opts.defaultId != null && buttons[opts.defaultId]) {
      var def = btnsEl.children[opts.defaultId];
      if (def) def.focus();
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        var last = buttons.length ? buttons[buttons.length - 1].value : false;
        finish(last);
      }
    });
    overlay.style.display = 'flex';
  });
};

// 提示词优化
function optimizePrompt() {
  var content = promptModalContent.value.trim();
  if (!content) {
    showNotification('请先输入 Prompt 内容');
    return;
  }

  var providerId = _optimizeProviderId || ApiConfig.getCurrentProvider();
  if (!providerId) {
    showNotification('请先选择优化使用的模型供应商（点击左侧 Logo）');
    return;
  }

  var config = ApiConfig.get(providerId);
  if (!config.apiKey) {
    showNotification('请先在「API 配置」中为当前供应商设置 API Key');
    return;
  }

  var provider = AI_PROVIDERS[providerId];
  if (!provider) {
    showNotification('未找到供应商配置');
    return;
  }

  var optimBtn = document.getElementById('prompt-optimize-btn');
  if (!optimBtn) return;

  var originalText = optimBtn.textContent;
  optimBtn.textContent = '优化中...';
  optimBtn.classList.add('optimizing');

  // systemPrompt 为空时提示
  if (!PROMPT_OPTIMIZE_SYSTEM) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');
    showNotification('Skill 加载失败，请重启应用');
    return;
  }

  var messages = [
    { role: 'system', content: PROMPT_OPTIMIZE_SYSTEM },
    { role: 'user', content: content }
  ];

  // 获取优化模型：优先选中的提供商 model 列表 → 已保存配置 → 默认模型 → 当前会话模型
  var optimizeModel = (provider.models && provider.models[0]) ? provider.models[0].id : '';
  if (!optimizeModel) optimizeModel = config.model || '';
  if (!optimizeModel) optimizeModel = provider.defaultModel || '';
  if (!optimizeModel) {
    try {
      var msel = document.getElementById('chat-model-select');
      if (msel && msel.value) optimizeModel = msel.value;
    } catch (e) {}
  }
  if (!optimizeModel) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');
    showNotification('无法确定优化模型，请在 API 配置中设置 Model');
    return;
  }

  var requestBody;
  try {
    requestBody = provider.buildRequestBody(messages, optimizeModel, {
      temperature: 0.3,
      maxTokens: config.maxTokens || 2048
    });
  } catch (e) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');
    showNotification('构造请求失败: ' + e.message);
    return;
  }

  var url;
  try {
    url = provider.getUrl
      ? provider.getUrl(config.baseURL, optimizeModel, config.apiKey)
      : config.baseURL + provider.apiPath;
  } catch (e) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');
    showNotification('构造 URL 失败: ' + e.message);
    return;
  }

  var requestId = Math.random().toString(36).substring(2, 10);

  window.electron.apiFetch({
    url: url,
    method: 'POST',
    headers: provider.headers(config.apiKey),
    body: requestBody,
    requestId: requestId
  }).then(function (result) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');

    if (result.aborted) return;

    if (!result.ok || !result.data) {
      var errMsg = result.error;
      if (!errMsg && result.data && result.data.error) {
        errMsg = (typeof result.data.error === 'string')
          ? result.data.error
          : (result.data.error.message || JSON.stringify(result.data.error));
      }
      if (!errMsg) errMsg = '状态码 ' + (result.status || '未知');
      showNotification('优化请求失败: ' + errMsg);
      AuditLog.logUserAction({
        action: 'prompt_optimize',
        detail: JSON.stringify({
          status: 'error',
          provider: providerId,
          model: optimizeModel,
          originalLength: content.length,
          error: errMsg
        })
      });
      return;
    }

    var optimizedContent = '';
    try {
      optimizedContent = provider.parseResponse(result.data) || '';
    } catch (parseErr) {
      optimizedContent = (result.data.choices && result.data.choices[0] &&
        result.data.choices[0].message && result.data.choices[0].message.content) || '';
    }

    if (!optimizedContent) {
      showNotification('未能从 API 响应中提取优化结果');
      return;
    }

    promptModalContent.value = optimizedContent.trim();
    promptModalContent.dispatchEvent(new Event('input'));

    AuditLog.logUserAction({
        action: 'prompt_optimize',
        detail: JSON.stringify({
          status: 'success',
          provider: providerId,
          model: optimizeModel,
          originalLength: content.length,
          optimizedLength: optimizedContent.length,
          originalPreview: content.substring(0, 80),
          optimizedPreview: optimizedContent.trim().substring(0, 80)
        })
    });
  }).catch(function (err) {
    optimBtn.textContent = originalText;
    optimBtn.classList.remove('optimizing');
    showNotification('优化请求异常: ' + (err.message || err));
    AuditLog.logUserAction({
      action: 'prompt_optimize',
      detail: JSON.stringify({
        status: 'error',
        provider: providerId,
        model: optimizeModel,
        originalLength: content.length,
        error: err.message || String(err)
      })
    });
  });
}

// 保存模版
function savePromptModal() {
  var title = promptModalName.value.trim();
  var content = promptModalContent.value.trim();
  if (!title) { showNotification('请输入模版名称'); return; }
  if (!content) { showNotification('请输入 Prompt 内容'); return; }

  if (editingTplId) {
    PromptTemplates.update(editingTplId, title, content);
  } else {
    PromptTemplates.add(title, content);
  }
  renderPromptTemplates();
  closePromptModal();
}

if (promptToggleBtn) {
  promptToggleBtn.addEventListener('click', function () { togglePromptPanel(); });
}

// DLP 敏感数据外发监控

var dlpToggleBtn = document.getElementById('dlp-toggle-btn');
var dlpEnabled = true; // 默认开启

// 初始化 DLP 状态（仅当用户手动关闭过才为 false）
try {
  var savedDlp = localStorage.getItem('ai-talk-dlp-enabled');
  if (savedDlp === 'false') dlpEnabled = false;
} catch (e) {}
if (dlpEnabled && dlpToggleBtn) {
  dlpToggleBtn.classList.add('active');
  dlpToggleBtn.title = '敏感数据外发监控：已开启';
}

// DLP 开关切换
if (dlpToggleBtn) {
  dlpToggleBtn.addEventListener('click', function () {
    dlpEnabled = !dlpEnabled;
    if (dlpEnabled) {
      dlpToggleBtn.classList.add('active');
      dlpToggleBtn.title = '敏感数据外发监控：已开启';
    } else {
      dlpToggleBtn.classList.remove('active');
      dlpToggleBtn.title = '敏感数据外发监控';
    }
    try { localStorage.setItem('ai-talk-dlp-enabled', dlpEnabled.toString()); } catch (e) {}
    AuditLog.logUserAction({
      action: 'dlp_toggle',
      detail: dlpEnabled ? 'enabled' : 'disabled'
    });
  });
}

// DLP 扫描函数：返回 null 表示通过，否则返回扫描结果
// opts 透传给 SensitiveDataChecker.scan，如 { context: 'dirListing' } 标记目录清单场景
function runDlpCheck(content, opts) {
  if (!dlpEnabled || !content) return null;
  return SensitiveDataChecker.scan(content, opts);
}

// 显示 DLP 警告弹窗
var _dlpPendingContent = null;
var _dlpPendingRefConvIds = null;
var _dlpPendingRefConvTitles = null;
var _dlpPendingScanResult = null;
var _dlpOriginalScanResult = null; // 文本模式弹窗打开时的完整命中快照（删除误检项前），用于审计追溯
var _dlpPendingLangInstruction = null;
var _dlpPendingSkillIds = null;
var _dlpPendingAttachmentRefs = null;
var _dlpPendingSensitiveMode = null; // 发送前附件预检决定的敏感处理策略（mask/skip），DLP 弹窗续发时透传
var _dlpMode = 'text'; // 当前 DLP 弹窗模式：'text'（文本发送检测）/ 'attachment'（发送前附件预检）
var _dlpAttachmentDecision = null; // 附件模式下的决策回调（resolve {action:'mask'|'skip'|'cancel'}）
var _dlpAttachmentTruncated = false;
var _dlpAttachmentHits = null; // 附件模式下的命中明细（供决策时构造与文本一致的审计记录）
var _dlpAttachmentIgnoredValues = []; // 附件模式下用户点「删除」移除（误检）的敏感值，发送时透传给 chat.js 跳过打码

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 渲染 DLP 弹窗的发现项列表：每行带「删除」按钮，供用户移除误检项
// （删除后该项不再视为敏感数据：文本模式不再打码，附件模式透传给 chat.js 跳过该值的检测）
function renderDlpFindings() {
  var findingsEl = document.getElementById('dlp-findings');
  if (!findingsEl) return;
  var list = _dlpMode === 'attachment' ? (_dlpAttachmentHits || []) : (_dlpPendingScanResult ? _dlpPendingScanResult.items : []);
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var h = list[i];
    var severityLabel = h.severity === 'high' ? '高风险' : '中风险';
    var severityClass = h.severity === 'high' ? 'dlp-finding-severity' : 'dlp-finding-severity medium';
    if (_dlpMode === 'attachment') {
      html += '<div class="dlp-finding-item">' +
        '<div class="dlp-finding-head">' +
        '<div class="dlp-finding-type">' + escHtml(h.file) + ' · ' + escHtml(h.rule) + '</div>' +
        '<button type="button" class="dlp-remove-btn" data-index="' + i + '">删除</button>' +
        '</div>' +
        '<div class="dlp-finding-value">命中内容: ' + escHtml(h.value || '') + '</div>' +
        '<div class="' + severityClass + '">' + severityLabel + '</div>' +
        '</div>';
    } else {
      html += '<div class="dlp-finding-item">' +
        '<div class="dlp-finding-head">' +
        '<div class="dlp-finding-type">' + escHtml(h.name) + '</div>' +
        '<button type="button" class="dlp-remove-btn" data-index="' + i + '">删除</button>' +
        '</div>' +
        '<div class="dlp-finding-value">' + escHtml(h.value) + '</div>' +
        '<div class="' + severityClass + '">' + severityLabel + '</div>' +
        '</div>';
    }
  }
  if (list.length === 0) {
    html = '<div class="dlp-findings-empty">未发现敏感数据，可正常发送。</div>';
  }
  findingsEl.innerHTML = html;
}

// 计算文本扫描结果的敏感项风险计数（删除误检项后重算）
function recountDlpScanResult(scanResult) {
  if (!scanResult || !scanResult.items) return;
  scanResult.highCount = 0;
  scanResult.mediumCount = 0;
  for (var i = 0; i < scanResult.items.length; i++) {
    if (scanResult.items[i].severity === 'high') scanResult.highCount++;
    else scanResult.mediumCount++;
  }
}

// 深拷贝扫描结果（数组与条目对象均复制），保证弹窗期间删除误检项不影响原始命中快照
function cloneDlpScanResult(scanResult) {
  if (!scanResult) return null;
  return {
    highCount: scanResult.highCount,
    mediumCount: scanResult.mediumCount,
    items: (scanResult.items || []).map(function (it) {
      var copy = {};
      for (var k in it) copy[k] = it[k];
      return copy;
    })
  };
}

function showDlpWarning(scanResult) {
  var overlay = document.getElementById('dlp-warning-overlay');
  var findingsEl = document.getElementById('dlp-findings');
  if (!overlay || !findingsEl) return;
  // 恢复文本模式下的标题/描述/按钮文案
  var titleEl = document.getElementById('dlp-modal-title');
  var descEl = document.getElementById('dlp-modal-desc');
  var proceedBtn = document.getElementById('dlp-proceed-btn');
  var cancelBtn = document.getElementById('dlp-cancel-btn');
  var skipBtn = document.getElementById('dlp-attach-skip-btn');
  if (titleEl) titleEl.textContent = '检测到敏感数据';
  if (descEl) descEl.innerHTML = '已开启<strong>敏感数据外发监控</strong>，发送内容中发现以下可能包含敏感信息的项目，误检项可点「删除」排除，请确认是否继续发送：';
  if (proceedBtn) { proceedBtn.textContent = '仍要发送'; proceedBtn.style.display = 'inline-block'; }
  if (cancelBtn) { cancelBtn.textContent = '返回修改'; cancelBtn.style.display = 'inline-block'; }
  if (skipBtn) skipBtn.style.display = 'none';

  // 暂存扫描结果，供展示与决策时使用；删除误检项后 items 随之裁剪
  // 同时保存删除前的完整命中快照，供审计日志追溯
  _dlpPendingScanResult = scanResult;
  _dlpOriginalScanResult = cloneDlpScanResult(scanResult);
  _dlpMode = 'text';
  renderDlpFindings();
  overlay.style.display = 'flex';
}

// 发送前附件预检命中后的告警弹窗（样式与文本 DLP 弹窗一致）：
// 返回 Promise，resolve {action:'mask'|'skip'|'cancel'}
function showAttachmentDlpWarning(hits, truncated) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('dlp-warning-overlay');
    var findingsEl = document.getElementById('dlp-findings');
    if (!overlay || !findingsEl) return resolve({ action: 'skip' });
    _dlpAttachmentDecision = resolve;
    _dlpAttachmentTruncated = !!truncated;
    _dlpAttachmentIgnoredValues = [];
    _dlpAttachmentHits = hits;
    _dlpMode = 'attachment';
    _dlpPendingScanResult = null;

    var titleEl = document.getElementById('dlp-modal-title');
    var descEl = document.getElementById('dlp-modal-desc');
    var proceedBtn = document.getElementById('dlp-proceed-btn');
    var cancelBtn = document.getElementById('dlp-cancel-btn');
    var skipBtn = document.getElementById('dlp-attach-skip-btn');
    if (titleEl) titleEl.textContent = '附件含敏感数据';
    if (descEl) {
      descEl.innerHTML = '已开启<strong>敏感数据外发监控</strong>，所选文件中检测到敏感数据' +
        (_dlpAttachmentTruncated ? '（超大文件仅采样前 2MB）' : '') +
        '，误检项可点「删除」排除，请选择处理方式：';
    }
    if (proceedBtn) { proceedBtn.textContent = '继续发送（自动打码）'; proceedBtn.style.display = 'inline-block'; }
    if (skipBtn) { skipBtn.style.display = 'inline-block'; }
    if (cancelBtn) { cancelBtn.textContent = '取消发送'; cancelBtn.style.display = 'inline-block'; }

    renderDlpFindings();
    overlay.style.display = 'flex';
  });
}

function hideDlpWarning() {
  var overlay = document.getElementById('dlp-warning-overlay');
  if (overlay) overlay.style.display = 'none';
  _dlpPendingContent = null;
  _dlpPendingRefConvIds = null;
  _dlpPendingRefConvTitles = null;
  _dlpPendingScanResult = null;
  _dlpOriginalScanResult = null;
  _dlpPendingLangInstruction = null;
  _dlpPendingSkillIds = null;
  _dlpPendingAttachmentRefs = null;
  _dlpPendingSensitiveMode = null;
  _dlpMode = 'text';
  _dlpAttachmentDecision = null;
  _dlpAttachmentTruncated = false;
  _dlpAttachmentHits = null;
  _dlpAttachmentIgnoredValues = [];
}

// 生成 DLP 检测详情：记录命中类型、命中内容与真实发送值（取删除误检项前的完整命中列表）。
// sent 表示该命中项实际发送出去的形态：未删除的项被脱敏（掩码值），被用户判定误检删除的项按原值明文发送。
// 不暴露计数、风险等级、脱敏配置等其他信息。
function buildDlpDetail(scanResult, originalScanResult) {
  var source = (originalScanResult && originalScanResult.items && originalScanResult.items.length > 0) ? originalScanResult : scanResult;
  var items = source && source.items ? source.items : [];
  // 当前（删除误检项后）仍保留的命中位置 → 这些项发送时会被脱敏
  var keptIndexes = {};
  var curItems = scanResult && scanResult.items ? scanResult.items : [];
  for (var ki = 0; ki < curItems.length; ki++) {
    keptIndexes[curItems[ki].index] = true;
  }
  var hits = items.map(function (it) {
    var sentMasked = keptIndexes[it.index] === true;
    return { type: it.name, content: it.value, sent: sentMasked ? (it.masked || '') : it.value };
  });
  return JSON.stringify({ hits: hits });
}

// 生成附件预检 DLP 命中详情字符串（与文本 DLP 记录同构，items 额外带 file 便于追溯）
// ignoredValues 可选：用户在弹窗中点「删除」排除（误检）的敏感值，一并记录便于追溯
function buildAttachmentDlpDetail(hits, ignoredValues) {
  var high = 0;
  var medium = 0;
  var types = [];
  var items = (hits || []).map(function (h) {
    if (h.severity === 'high') high++; else medium++;
    if (types.indexOf(h.rule) === -1) types.push(h.rule);
    return { file: h.file, name: h.rule, severity: h.severity, value: h.value || '', masked: h.masked || '' };
  });
  var detail = { source: 'attachment', highCount: high, mediumCount: medium, types: types, items: items };
  if (ignoredValues && ignoredValues.length > 0) detail.removedValues = ignoredValues;
  return JSON.stringify(detail);
}

// 对发送内容进行脱敏：将检测到的敏感值替换为掩码版本
// 从后往前替换，避免索引偏移
function desensitizeContent(content, scanResult) {
  var result = content;
  var items = scanResult.items.slice().sort(function (a, b) { return b.index - a.index; });
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    result = result.substring(0, item.index) + item.masked + result.substring(item.index + item.value.length);
  }
  return result;
}

// DLP 弹窗按钮事件（延迟绑定，chat.html 后加载）
document.addEventListener('click', function (e) {
  // 删除误检项：从当前命中列表移除，该项不再作脱敏处理
  var removeBtn = e.target.closest && e.target.closest('.dlp-remove-btn');
  if (removeBtn) {
    var ridx = parseInt(removeBtn.getAttribute('data-index'), 10);
    if (!isNaN(ridx)) {
      if (_dlpMode === 'attachment') {
        var hitArr = _dlpAttachmentHits || [];
        if (ridx >= 0 && ridx < hitArr.length) {
          var removedHit = hitArr.splice(ridx, 1)[0];
          if (removedHit && removedHit.value) _dlpAttachmentIgnoredValues.push(removedHit.value);
        }
      } else {
        var scanRes = _dlpPendingScanResult;
        if (scanRes && scanRes.items && ridx >= 0 && ridx < scanRes.items.length) {
          scanRes.items.splice(ridx, 1);
          recountDlpScanResult(scanRes);
        }
      }
      renderDlpFindings();
    }
    return;
  }
  // 仍要发送（文本模式）/ 继续发送·自动打码（附件模式）
  if (e.target.id === 'dlp-proceed-btn' || (e.target.closest && e.target.closest('#dlp-proceed-btn'))) {
    if (_dlpMode === 'attachment') {
      var decision = _dlpAttachmentDecision;
      var attachHits = _dlpAttachmentHits;
      var ignoredValues = (_dlpAttachmentIgnoredValues || []).slice();
      _dlpAttachmentDecision = null;
      hideDlpWarning();
      if (decision) decision({ action: 'mask', ignoredValues: ignoredValues });
      // 审计日志：记录附件预检 + 用户选择继续（自动打码），detail 与文本 DLP 记录同构，附已排除的误检值
      AuditLog.logUserAction({
        action: 'attach_dlp_masked',
        detail: buildAttachmentDlpDetail(attachHits, ignoredValues)
      });
      return;
    }
    var content = _dlpPendingContent;
    var refConvIds = _dlpPendingRefConvIds;
    var refConvTitles = _dlpPendingRefConvTitles;
    var langInstruction = _dlpPendingLangInstruction;
    var skillIds = _dlpPendingSkillIds || [];
    var scanResult = _dlpPendingScanResult;
    // hideDlpWarning 会清空模块状态，先捕获删除前的命中快照，供审计日志追溯
    var originalScanResult = _dlpOriginalScanResult;
    var pendingAttachRefs = _dlpPendingAttachmentRefs || [];
    var pendingSendOptions = _dlpPendingSensitiveMode;
    // 脱敏处理：将敏感值替换为掩码版本再发送
    var safeContent = scanResult ? desensitizeContent(content, scanResult) : content;
    hideDlpWarning();
    if (content) {
      clearAttachments();
      setSendBtnState(true);
      ChatManager.sendMessage(safeContent, refConvIds, langInstruction, refConvTitles, isWebSearchEnabled(), skillIds, pendingAttachRefs, pendingSendOptions).finally(function () {
        setSendBtnState(false);
      });
    }
    // 审计日志：记录 DLP 警告 + 用户确认发送（仅记录命中类型与命中内容）
    AuditLog.logUserAction({
      action: 'dlp_send_masked',
      detail: scanResult ? buildDlpDetail(scanResult, originalScanResult) : '用户选择忽略警告继续发送'
    });
    return;
  }
  // 跳过含敏感数据的文件（仅附件模式）
  if (e.target.id === 'dlp-attach-skip-btn' || (e.target.closest && e.target.closest('#dlp-attach-skip-btn'))) {
    var decision2 = _dlpAttachmentDecision;
    var attachHits2 = _dlpAttachmentHits;
    _dlpAttachmentDecision = null;
    hideDlpWarning();
    if (decision2) decision2({ action: 'skip' });
    AuditLog.logUserAction({
      action: 'attach_dlp_skip',
      detail: buildAttachmentDlpDetail(attachHits2)
    });
    return;
  }
  // 返回修改（文本模式）/ 取消发送（附件模式）/ 关闭
  if (e.target.id === 'dlp-cancel-btn' || e.target.id === 'dlp-modal-close-btn' ||
      (e.target.closest && (e.target.closest('#dlp-cancel-btn') || e.target.closest('#dlp-modal-close-btn')))) {
    if (_dlpMode === 'attachment') {
      var decision3 = _dlpAttachmentDecision;
      var attachHits3 = _dlpAttachmentHits;
      _dlpAttachmentDecision = null;
      hideDlpWarning();
      if (decision3) decision3({ action: 'cancel' });
      AuditLog.logUserAction({
        action: 'attach_dlp_cancel',
        detail: buildAttachmentDlpDetail(attachHits3)
      });
      return;
    }
    // 审计日志：记录 DLP 警告 + 用户取消（hideDlpWarning 在日志后执行，模块状态仍完整）
    AuditLog.logUserAction({
      action: 'dlp_blocked',
      detail: _dlpPendingScanResult ? buildDlpDetail(_dlpPendingScanResult, _dlpOriginalScanResult) : '用户选择返回修改'
    });
    hideDlpWarning();
    if (chatInput) chatInput.focus();
    return;
  }
});

if (promptPanelClose) {
  promptPanelClose.addEventListener('click', function () { collapsePromptPanel(); });
}

if (promptAddBtn) {
  promptAddBtn.addEventListener('click', function () { openPromptModal(null); });
}

if (promptModalSave) {
  promptModalSave.addEventListener('click', function () { savePromptModal(); });
}
if (promptModalCancel) {
  promptModalCancel.addEventListener('click', function () { closePromptModal(); });
}
if (promptModalClose) {
  promptModalClose.addEventListener('click', function () { closePromptModal(); });
}
if (document.getElementById('prompt-optimize-btn')) {
  document.getElementById('prompt-optimize-btn').addEventListener('click', function () { optimizePrompt(); });
}
if (promptModalOverlay) {
  promptModalOverlay.addEventListener('click', function (e) {
    if (e.target === promptModalOverlay) closePromptModal();
  });
}

// 初始渲染
renderPromptTemplates();

// 输入框展开/折叠

var btnExpandInput = document.getElementById('btn-expand-input');
var isInputExpanded = false;
var autoInputExpanded = false; // 自动进入的展开态（内容超过阈值触发），内容减少后自动收起

// 发送后重置：自动展开态收回，回到单行输入
function resetAutoExpandedInput() {
  if (autoInputExpanded) {
    autoInputExpanded = false;
    applyInputExpanded(false);
  }
}

// 应用输入框展开/收起状态（同步卡片类、inner 定位、按钮图标与提示）
function applyInputExpanded(expanded) {
  var card = document.querySelector('.chat-input-card');
  var inner = document.querySelector('.chat-input-inner');
  if (expanded) {
    if (btnExpandInput) btnExpandInput.classList.add('expanded');
    if (card) card.classList.add('expanded');
    // 去掉 chat-input-inner 的 relative，让卡片 relative 于 #chat-main 定位
    if (inner) inner.style.position = 'static';
    if (btnExpandInput) btnExpandInput.title = '收起输入框';
  } else {
    if (btnExpandInput) btnExpandInput.classList.remove('expanded');
    if (card) card.classList.remove('expanded');
    // 恢复 relative
    if (inner) inner.style.position = 'relative';
    if (btnExpandInput) btnExpandInput.title = '展开输入框';
  }
}

if (btnExpandInput) {
  btnExpandInput.addEventListener('click', function () {
    isInputExpanded = !isInputExpanded;
    autoInputExpanded = false; // 手动操作后由用户控制，不再自动收起
    applyInputExpanded(isInputExpanded);
    // 触发 input 事件重新计算高度
    chatInput.dispatchEvent(new Event('input'));
  });
}

if (chatModelSelect) {
  chatModelSelect.addEventListener('change', function () {
    var val = this.value;
    if (!val) return;
    var parts = val.split('::');
    var providerId = parts[0];
    var modelName = parts[1];
    if (!providerId || !modelName) return;
    // 切换 provider 并更新 UI
    ApiConfig.setCurrentProvider(providerId);
    ApiConfig.setModel(providerId, modelName);
    // 同步头部 provider 下拉框
    if (chatProviderSelect && chatProviderSelect.value !== providerId) {
      chatProviderSelect.value = providerId;
    }
    updateProviderInfo(providerId);
  });
}

// Modal 配置管理

var configProviderSelect = document.getElementById('config-provider-select');
var configProviderLogo = document.getElementById('config-provider-logo');
var configBaseUrl = document.getElementById('config-base-url');
var configApiKey = document.getElementById('config-api-key');
var configModel = document.getElementById('config-model');
var configStatus = document.getElementById('config-status');
var configModelHint = document.getElementById('config-model-hint');

// 初始化提供商下拉框（从 AI_PROVIDERS 动态填充）
function initProviderSelect() {
  if (!configProviderSelect) return;
  configProviderSelect.innerHTML = '';
  var ids = Object.keys(AI_PROVIDERS);
  for (var i = 0; i < ids.length; i++) {
    var pid = ids[i];
    var p = AI_PROVIDERS[pid];
    // 跳过非提供商条目（如 mergeExternalConfig 函数）
    if (!p.name) continue;
    var opt = document.createElement('option');
    opt.value = pid;
    opt.textContent = p.name;
    configProviderSelect.appendChild(opt);
  }
}

// 更新提供商选择器旁边的 logo 图标
function updateProviderLogo(providerId) {
  if (!configProviderLogo) return;
  var p = AI_PROVIDERS[providerId];
  if (p && p.logo && p.logo.startsWith('../../assets/')) {
    configProviderLogo.src = p.logo;
    configProviderLogo.style.display = 'block';
  } else {
    configProviderLogo.style.display = 'none';
  }
}

initProviderSelect();

function openConfigModal() {
  var providerId = ApiConfig.getCurrentProvider();
  configProviderSelect.value = providerId;
  updateProviderLogo(providerId);
  loadConfigForm(providerId);
  modalOverlay.style.display = 'flex';
}

function closeConfigModal() {
  modalOverlay.style.display = 'none';
}

// 根据模型加载配置模板到表单
function loadConfigForm(providerId) {
  var provider = AI_PROVIDERS[providerId];
  var saved = ApiConfig.get(providerId);

  configBaseUrl.value = saved.baseURL || (provider ? provider.baseURL : '');
  configApiKey.value = saved.apiKey || '';
  configModel.value = saved.model || (provider ? provider.defaultModel : '');
  // 自定义模型允许不填 API Key（本地模型可能无需认证）
  // Ollama 等无认证模型也跳过
  var noAuth = provider && (provider.isCustom || provider.authType === 'none');
  if (noAuth) {
    configApiKey.placeholder = provider.authType === 'none' ? '无需 API Key' : '本地模型可留空';
    configApiKey.parentElement.style.opacity = '0.5';
    configModel.placeholder = provider ? (provider.defaultModel || '例如: llama3, qwen2.5, claude-3-opus...') : '';
  } else {
    configApiKey.placeholder = 'sk-...';
    configApiKey.parentElement.style.opacity = '1';
    configModel.placeholder = provider ? provider.defaultModel : '';
  }

  // 模型提示
  if (provider && provider.isCustom) {
    configModelHint.textContent = '支持 OpenAI/Anthropic 兼容 API 格式';
  } else if (provider && provider.models && provider.models.length > 0) {
    configModelHint.textContent = '可选: ' + provider.models.join(', ');
  } else {
    configModelHint.textContent = '';
  }

  // 状态提示
  configStatus.style.color = '#28a745';
  if (noAuth) {
    configStatus.textContent = provider.authType === 'none' ? '本地模型（无需认证）' : '已配置';
  } else if (saved.apiKey) {
    configStatus.textContent = '已配置 (API Key: ' + maskApiKey(saved.apiKey) + ')';
  } else {
    configStatus.textContent = '未配置 API Key';
    configStatus.style.color = '#e74c3c';
  }

  if (isAPIMode) {
    updateProviderSelect();
  }
}

// 掩码 API Key 只显示前后几位
function maskApiKey(key) {
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// 模型选择变更
configProviderSelect.addEventListener('change', function () {
  updateProviderLogo(this.value);
  loadConfigForm(this.value);
});

// "API 配置" 按钮（历史视图中的）
document.getElementById('btn-open-config').addEventListener('click', function () {
  openConfigModal();
});

document.getElementById('modal-close-btn').addEventListener('click', function () {
  closeConfigModal();
});

document.getElementById('config-cancel-btn').addEventListener('click', function () {
  closeConfigModal();
});

// 点击遮罩关闭
modalOverlay.addEventListener('click', function (e) {
  if (e.target === modalOverlay) {
    closeConfigModal();
  }
});

// 保存配置
document.getElementById('config-save-btn').addEventListener('click', function () {
  var providerId = configProviderSelect.value;
  var apiKey = configApiKey.value.trim();
  var model = configModel.value.trim();
  var provider = AI_PROVIDERS[providerId];

  // 自定义模型 + 无认证模型允许不填 API Key
  var noAuth = provider && (provider.isCustom || provider.authType === 'none');
  if (!noAuth) {
    if (!apiKey) {
      showNotification('API Key 不能为空');
      return;
    }
  }

  if (!model) {
    showNotification('Model 不能为空');
    return;
  }

  ApiConfig.save(providerId, {
    baseURL: configBaseUrl.value.trim(),
    apiKey: apiKey,
    model: model
  });
  ApiConfig.setCurrentProvider(providerId);

  // 更新聊天头部
  if (provider && isAPIMode) {
    updateProviderSelect();
  }

  // 更新状态
  configStatus.textContent = '配置已保存';
  configStatus.style.color = '#28a745';

  closeConfigModal();
});
