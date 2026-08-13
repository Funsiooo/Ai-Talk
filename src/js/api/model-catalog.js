/******** 官方模型目录：侧边栏 renderer.js 与 module.html 共用 ********
 * 1) 定义全部官方模型（id/名称/图标/官网地址）与分组；
 * 2) 常用模型（“我的常用”）经 localStorage 持久化，两个页面共享同一 key；
 * 3) 侧边栏只渲染常用模型，module.html 提供全部模型并支持拖拽替换常用入口。
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'ai_talk_fav_models';
  var MAX_FAV = 6;

  // 官方模型列表（与左侧边栏、module.html 完全一致）
  var MODELS = [
    { id: 'deepseek',        name: '深度求索 DeepSeek',   icon: '../../assets/deepseek.svg', url: 'https://chat.deepseek.com/' },
    { id: 'tyqw',            name: '阿里 通义千问',        icon: '../../assets/tyqw.png',      url: 'https://www.tongyi.com/' },
    { id: 'tenxun',          name: '腾讯 元宝',            icon: '../../assets/tenxun.png',    url: 'https://yuanbao.tencent.com/chat/' },
    { id: 'doubao',          name: '字节 豆包',            icon: '../../assets/doubao.png',    url: 'https://www.doubao.com/' },
    { id: 'kimi',            name: '月之暗面 Kimi',        icon: '../../assets/kimi.ico',      url: 'https://kimi.moonshot.cn/' },
    { id: 'zhipu',           name: '智谱 GLM',             icon: '../../assets/zhipu.png',     url: 'https://www.zhipuai.cn/' },
    { id: 'minimax',         name: 'Minimax Ai',           icon: '../../assets/minimax.png',   url: 'https://agent.minimaxi.com/' },
    { id: 'mimo',            name: '小米 Mimo',            icon: '../../assets/mimo.png',      url: 'https://aistudio.xiaomimimo.com/#/c' },
    { id: 'wxyy',            name: '百度 文心一言',        icon: '../../assets/wxyy.ico',      url: 'https://yiyan.baidu.com/' },
    { id: 'openai',          name: 'OpenAI ChatGPT',       icon: '../../assets/chatgpt.ico',   url: 'https://chatgpt.com/' },
    { id: 'google',          name: 'Google Gemini',        icon: '../../assets/google.svg',    url: 'https://gemini.google.com/' },
    { id: 'perplexity',      name: 'Perplexity AI',        icon: '../../assets/perplexity.ico', url: 'https://www.perplexity.ai/' },
    { id: 'claude',          name: 'Anthropic Claude',     icon: '../../assets/claude.png',    url: 'https://claude.ai/' },
    { id: 'grok',            name: 'xAI Grok',             icon: '../../assets/grok.ico',      url: 'https://x.ai/grok' },
    { id: 'poe',             name: 'Quora Poe',            icon: '../../assets/poe.svg',       url: 'https://poe.com/' },
    { id: 'meta',            name: 'Meta Ai',              icon: '../../assets/meta.ico',      url: 'https://www.meta.ai/' },
    { id: 'manus',           name: '蝴蝶效应 Manus',       icon: '../../assets/manus.ico',     url: 'https://manus.im/' },
    { id: 'sciencepal',      name: 'Sciencepal Ai',        icon: '../../assets/sciencepal.png', url: 'https://sciencepal.ai/' },
    { id: 'copilot',         name: 'Microsoft Copilot',    icon: '../../assets/copilot.ico',   url: 'https://copilot.microsoft.com/' },
    { id: 'deepl',           name: 'DeepL Translator',     icon: '../../assets/deepl.png',     url: 'https://www.deepl.com/' },
    { id: 'youdaoranslator', name: '网易 有道翻译',        icon: '../../assets/youdao.ico',    url: 'https://fanyi.youdao.com/#/TextTranslate' },
    { id: 'bing',            name: '必应 Bing',            icon: '../../assets/bing.ico',      url: 'https://www.bing.com/' }
  ];

  // 分组（module.html 展示顺序）
  var GROUPS = [
    { name: '对话大模型', ids: ['deepseek', 'tyqw', 'tenxun', 'doubao', 'kimi', 'zhipu', 'minimax', 'mimo', 'wxyy'] },
    { name: '国际 AI',   ids: ['openai', 'google', 'perplexity', 'claude', 'grok', 'poe', 'meta', 'manus', 'sciencepal', 'copilot'] },
    { name: '翻译工具',  ids: ['deepl', 'youdaoranslator'] },
    { name: '搜索引擎',  ids: ['bing'] }
  ];

  // 默认常用（新用户首次打开时展示，用户可自行拖拽调整）
  var DEFAULT_FAV = ['deepseek', 'kimi', 'doubao', 'openai', 'google'];

  function getModel(id) {
    for (var i = 0; i < MODELS.length; i++) {
      if (MODELS[i].id === id) return MODELS[i];
    }
    return null;
  }

  // 读取常用模型（过滤非法/重复 id，最多 MAX_FAV 个）
  function loadFav() {
    var saved = null;
    try {
      saved = JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      saved = null;
    }
    if (!Array.isArray(saved) || saved.length === 0) saved = DEFAULT_FAV.slice();

    var seen = {};
    var out = [];
    for (var i = 0; i < saved.length && out.length < MAX_FAV; i++) {
      var id = saved[i];
      if (getModel(id) && !seen[id]) {
        seen[id] = true;
        out.push(id);
      }
    }
    return out;
  }

  function saveFav(list) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_FAV)));
    } catch (e) { /* 存储不可用时静默降级 */ }
  }

  global.MODEL_CATALOG = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_FAV: MAX_FAV,
    MODELS: MODELS,
    GROUPS: GROUPS,
    DEFAULT_FAV: DEFAULT_FAV,
    getModel: getModel,
    loadFav: loadFav,
    saveFav: saveFav
  };
})(window);
