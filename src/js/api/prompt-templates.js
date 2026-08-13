/**
 * Prompt 模版管理模块
 * 文件持久化存储 + localStorage 备份，支持 CRUD + 点击填入输入框
 */
var PromptTemplates = (function () {
  'use strict';

  var STORAGE_KEY = 'ai-talk-prompt-templates';
  var _filePath = null;
  var templates = [];

  function getFilePath() {
    if (_filePath) return Promise.resolve(_filePath);
    return window.electron.getConfigPath().then(function (configPath) {
      _filePath = configPath + '/prompt-templates.json';
      return _filePath;
    });
  }

  /**
   * 同步从 localStorage 加载（立即可用，不阻塞 UI）
   */
  function loadSync() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        templates = JSON.parse(raw);
      }
    } catch (e) {
      templates = [];
    }
  }

  /**
   * 异步从文件加载（可靠存储，覆盖 localStorage 数据）
   */
  function loadFromFile() {
    return getFilePath().then(function (filePath) {
      return window.electron.readFile(filePath);
    }).then(function (raw) {
      if (raw) {
        templates = JSON.parse(raw);
        // 同步回 localStorage
        try { localStorage.setItem(STORAGE_KEY, raw); } catch (e) {}
      }
      return templates;
    }).catch(function () {
      // 文件不存在或读取失败，保留 localStorage 数据
      return templates;
    });
  }

  /**
   * 持久化保存（localStorage 同步 + 文件异步）
   */
  function save() {
    var data = JSON.stringify(templates, null, 2);
    // 同步写入 localStorage 作为缓存
    try { localStorage.setItem(STORAGE_KEY, data); } catch (e) {}
    // 异步写入文件
    getFilePath().then(function (filePath) {
      return window.electron.writeFile(filePath, data);
    }).catch(function (e) {
      console.error('[PromptTemplates] 文件保存失败:', e);
    });
  }

  function generateId() {
    return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  /**
   * 新增模版
   */
  function add(title, content) {
    var tpl = {
      id: generateId(),
      title: title || '未命名模版',
      content: content || '',
      createdAt: Date.now()
    };
    templates.unshift(tpl);
    save();
    return tpl;
  }

  /**
   * 删除模版
   */
  function remove(id) {
    templates = templates.filter(function (t) { return t.id !== id; });
    save();
  }

  /**
   * 更新模版
   */
  function update(id, title, content) {
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === id) {
        templates[i].title = title || templates[i].title;
        templates[i].content = content || templates[i].content;
        break;
      }
    }
    save();
  }

  /**
   * 获取所有模版
   */
  function getAll() {
    return templates.slice();
  }

  /**
   * 获取单个模版
   */
  function getById(id) {
    for (var i = 0; i < templates.length; i++) {
      if (templates[i].id === id) return templates[i];
    }
    return null;
  }

  /**
   * 强制重新从文件加载
   */
  function reload() {
    return loadFromFile();
  }

  // ===== 初始化 =====
  // localStorage 同步加载，随后异步用文件数据覆盖
  loadSync();
  loadFromFile();

  return {
    add: add,
    remove: remove,
    update: update,
    getAll: getAll,
    getById: getById,
    reload: reload
  };
})();
