/**
 * API 配置管理模块
 * 使用 LocalStorage 持久化存储
 */

var ApiConfig = (function () {
  var STORAGE_KEY = 'ai-talk-api-configs';
  var CURRENT_PROVIDER_KEY = 'ai-talk-current-provider';

  // 加载所有配置
  function loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // 保存所有配置
  function saveAll(configs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  }

  // 获取指定模型的配置
  function get(providerId) {
    var configs = loadAll();
    var cfg = configs[providerId] || {};
    var provider = AI_PROVIDERS[providerId];
    if (provider) {
      return {
        baseURL: cfg.baseURL || provider.baseURL,
        apiKey: cfg.apiKey || '',
        model: cfg.model || provider.defaultModel,
        temperature: cfg.temperature || 0.7,
        maxTokens: cfg.maxTokens || 4096
      };
    }
    return cfg;
  }

  // 保存指定模型的配置
  function save(providerId, config) {
    var configs = loadAll();
    var provider = AI_PROVIDERS[providerId];
    var oldConfig = configs[providerId] || {};
    // 审计日志：记录 API 配置变更
    var changed = oldConfig.apiKey !== config.apiKey ? 'apiKey_changed' :
                  oldConfig.model !== config.model ? 'model_changed' :
                  oldConfig.baseURL !== config.baseURL ? 'baseURL_changed' : 'config_saved';
    AuditLog.logUserAction({
      action: 'api_config_change',
      detail: JSON.stringify({ providerId: providerId, change: changed })
    });
    configs[providerId] = {
      baseURL: config.baseURL || (provider ? provider.baseURL : ''),
      apiKey: config.apiKey || '',
      model: config.model || (provider ? provider.defaultModel : ''),
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096
    };
    saveAll(configs);
  }

  // 获取当前选中的模型 ID
  function getCurrentProvider() {
    return localStorage.getItem(CURRENT_PROVIDER_KEY) || 'openai';
  }

  // 设置当前选中的模型 ID
  function setCurrentProvider(providerId) {
    localStorage.setItem(CURRENT_PROVIDER_KEY, providerId);
  }

  // 获取当前激活的完整配置（当前模型 + 已保存配置）
  function getActiveConfig() {
    var providerId = getCurrentProvider();
    return {
      providerId: providerId,
      config: get(providerId)
    };
  }

  // 更新当前 provider 的 model，不覆盖其他配置
  function setModel(providerId, model) {
    var current = get(providerId);
    current.model = model;
    save(providerId, current);
  }

  return {
    loadAll: loadAll,
    get: get,
    save: save,
    setModel: setModel,
    getCurrentProvider: getCurrentProvider,
    setCurrentProvider: setCurrentProvider,
    getActiveConfig: getActiveConfig
  };
})();
