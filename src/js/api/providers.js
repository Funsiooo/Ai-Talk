/**
 * AI 模型提供商定义
 * 可通过 config/model-config.json 覆盖默认配置
 */

var AI_PROVIDERS = {

  // ==== OpenAI ====
  openai: {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    logo: '../../assets/chatgpt.ico',
    baseURL: 'https://api.openai.com/v1',
    apiPath: '/chat/completions',
    defaultModel: 'gpt-5.6-terra',
    models: ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.5-instant', 'gpt-5.4', 'gpt-5.4-mini', 'o3-mini'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== DeepSeek ====
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    logo: '../../assets/deepseek.svg',
    baseURL: 'https://api.deepseek.com',
    apiPath: '/chat/completions',
    defaultModel: 'deepseek-v4-pro',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== Kimi / Moonshot ====
  kimi: {
    id: 'kimi',
    name: 'Kimi',
    logo: '../../assets/kimi.ico',
    baseURL: 'https://api.moonshot.cn/v1',
    apiPath: '/chat/completions',
    defaultModel: 'kimi-k2.6',
    models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2', 'moonshot-v1-128k', 'moonshot-v1-32k'],
    authType: 'bearer',
    apiFormat: 'openai',
    supportsWebSearch: true,
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      // kimi-k2 系列为推理模型，官方仅允许 temperature=1（其他值会报 invalid temperature）
      var isK2Model = /^kimi-k2/i.test(model || '');
      var body = {
        model: model,
        messages: messages,
        temperature: isK2Model ? 1 : (options.temperature || 0.7),
        max_tokens: options.maxTokens || 4096
      };
      // 联网搜索：Moonshot 内置 $web_search 工具
      if (options && options.enableWebSearch) {
        body.tools = [{ type: 'builtin_function', function: { name: '$web_search' } }];
      }
      return body;
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 智谱 GLM ====
  zhipu: {
    id: 'zhipu',
    name: '智谱 GLM',
    logo: '../../assets/zhipu.png',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiPath: '/chat/completions',
    defaultModel: 'glm-5',
    models: ['glm-5.2', 'glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4-flash', 'glm-4-long', 'glm-z1-air'],
    authType: 'bearer',
    apiFormat: 'openai',
    supportsWebSearch: true,
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      var body = {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
      // 联网搜索：智谱 web_search 工具
      if (options && options.enableWebSearch) {
        body.tools = [{ type: 'web_search', web_search: { enable: true } }];
      }
      return body;
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 通义千问 ====
  tongyi: {
    id: 'tongyi',
    name: '通义千问',
    logo: '../../assets/tyqw.png',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiPath: '/chat/completions',
    defaultModel: 'qwen3-max',
    models: ['qwen3.6-plus', 'qwen3.5-plus', 'qwen3-max', 'qwen3-plus', 'qwen3-235b-a22b-instruct', 'qwq-32b', 'qwen-coder-plus', 'qwen-max', 'qwen-turbo'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 豆包 ====
  doubao: {
    id: 'doubao',
    name: '豆包',
    logo: '../../assets/doubao.png',
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    apiPath: '/chat/completions',
    defaultModel: 'doubao-seed-2-1-pro-260628',
    models: ['doubao-seed-2-1-pro-260628', 'doubao-seed-2-1-turbo-260628', 'doubao-seed-evolving', 'doubao-seed-2-0-pro-260215', 'doubao-seed-2-0-lite-260428', 'doubao-seed-2-0-mini-260428', 'doubao-seed-2-0-code-preview-260215', 'doubao-pro-32k'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== MiniMax ====
  minimax: {
    id: 'minimax',
    name: 'MiniMax',
    logo: '../../assets/minimax.png',
    baseURL: 'https://api.minimax.chat/v1',
    apiPath: '/chat/completions',
    defaultModel: 'MiniMax-M3',
    models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1', 'MiniMax-01', 'abab6.5s-chat'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 硅基流动 ====
  siliconflow: {
    id: 'siliconflow',
    name: '硅基流动',
    logo: '../../assets/gjld.png',
    baseURL: 'https://api.siliconflow.cn/v1',
    apiPath: '/chat/completions',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen2.5-72B-Instruct', 'deepseek-ai/DeepSeek-V3', 'meta-llama/Meta-Llama-3.1-8B-Instruct'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== Anthropic Claude ====
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    logo: '../../assets/claude.png',
    baseURL: 'https://api.anthropic.com/v1',
    apiPath: '/messages',
    defaultModel: 'claude-sonnet-5',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5', 'claude-haiku-4-5-20251001', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-sonnet-4-6'],
    authType: 'x-api-key',
    apiFormat: 'anthropic',
    supportsWebSearch: true,
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      };
    },
    buildRequestBody: function (messages, model, options) {
      // 分离 system 消息（合并多条 system 消息为一条）
      var systemParts = [];
      var userAssistantMsgs = [];
      for (var i = 0; i < messages.length; i++) {
        if (messages[i].role === 'system') {
          systemParts.push(messages[i].content);
        } else {
          userAssistantMsgs.push({
            role: messages[i].role,
            content: messages[i].content
          });
        }
      }
      var body = {
        model: model,
        max_tokens: options.maxTokens || 4096,
        messages: userAssistantMsgs
      };
      if (systemParts.length > 0) {
        body.system = systemParts.join('\n\n');
      }
      // 联网搜索：Anthropic 服务端 web_search 工具
      if (options && options.enableWebSearch) {
        body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }];
      }
      return body;
    },
    parseResponse: function (data) {
      if (data.content && data.content.length > 0) {
        var texts = [];
        for (var i = 0; i < data.content.length; i++) {
          if (data.content[i].type === 'text') {
            texts.push(data.content[i].text);
          }
        }
        return texts.join('');
      }
      return '';
    }
  },

  // ==== Google Gemini ====
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    logo: '../../assets/gemini.png',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    apiPath: '/models/{model}:generateContent',
    defaultModel: 'gemini-3-pro',
    models: ['gemini-3.1-pro', 'gemini-3-pro', 'gemini-3-flash', 'gemini-3-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    authType: 'query',
    apiFormat: 'gemini',
    supportsWebSearch: true,
    getUrl: function (baseURL, model, apiKey) {
      var path = '/models/' + model + ':generateContent';
      return baseURL + path + '?key=' + encodeURIComponent(apiKey);
    },
    headers: function () {
      return {
        'Content-Type': 'application/json'
      };
    },
    buildRequestBody: function (messages, model, options) {
      var contents = [];
      var systemParts = [];
      for (var i = 0; i < messages.length; i++) {
        var msg = messages[i];
        if (msg.role === 'system') {
          systemParts.push(msg.content);
        } else {
          var role = msg.role === 'assistant' ? 'model' : 'user';
          contents.push({
            role: role,
            parts: [{ text: msg.content }]
          });
        }
      }
      var body = {
        contents: contents,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxTokens || 4096
        }
      };
      if (systemParts.length > 0) {
        body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] };
      }
      // 联网搜索：Gemini 内置 Google 搜索（grounding）
      if (options && options.enableWebSearch) {
        body.tools = [{ google_search: {} }];
      }
      return body;
    },
    parseResponse: function (data) {
      if (data.candidates && data.candidates.length > 0) {
        var candidate = data.candidates[0];
        if (candidate.content && candidate.content.parts) {
          var texts = [];
          for (var i = 0; i < candidate.content.parts.length; i++) {
            if (candidate.content.parts[i].text !== undefined) {
              texts.push(candidate.content.parts[i].text);
            }
          }
          return texts.join('');
        }
      }
      return '';
    }
  },

  // ==== Ollama ====
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    logo: '../../assets/ollama.png',
    baseURL: 'http://localhost:11434/v1',
    apiPath: '/chat/completions',
    defaultModel: 'llama3',
    models: ['llama3', 'llama3.1', 'qwen2.5', 'mistral', 'gemma2', 'phi3'],
    authType: 'none',
    apiFormat: 'openai',
    headers: function () {
      return {
        'Content-Type': 'application/json'
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096,
        stream: false
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 小米 MiMo ====
  mimo: {
    id: 'mimo',
    name: '小米 MiMo',
    logo: '../../assets/mimo.png',
    baseURL: 'https://api.xiaomimimo.com/v1',
    apiPath: '/chat/completions',
    defaultModel: 'MiMo-7B-Instruct',
    models: ['MiMo-7B-Instruct', 'MiMo-14B-Instruct'],
    authType: 'bearer',
    apiFormat: 'openai',
    headers: function (apiKey) {
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      };
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  },

  // ==== 自定义模型 ====
  custom: {
    id: 'custom',
    name: '自定义模型',
    logo: '../../assets/zdy.png',
    baseURL: 'http://localhost:11434/v1',
    apiPath: '/chat/completions',
    defaultModel: '',
    models: [],
    authType: 'bearer',
    apiFormat: 'openai',
    isCustom: true,
    headers: function (apiKey) {
      var h = { 'Content-Type': 'application/json' };
      if (apiKey) {
        h['Authorization'] = 'Bearer ' + apiKey;
      }
      return h;
    },
    buildRequestBody: function (messages, model, options) {
      return {
        model: model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4096
      };
    },
    parseResponse: function (data) {
      return data.choices && data.choices[0]
        ? data.choices[0].message.content
        : '';
    }
  }
};

/**
 * 从 model-config.json 合并用户自定义配置
 * @param {Object} externalConfig - 外部 JSON 配置对象
 */
AI_PROVIDERS.mergeExternalConfig = function (externalConfig) {
  if (!externalConfig) return;
  var providerIds = Object.keys(externalConfig);
  for (var i = 0; i < providerIds.length; i++) {
    var pid = providerIds[i];
    if (pid.indexOf('_') === 0) continue; // 跳过注释字段
    if (AI_PROVIDERS[pid] && externalConfig[pid]) {
      var ext = externalConfig[pid];
      var provider = AI_PROVIDERS[pid];
      if (ext.baseURL) provider.baseURL = ext.baseURL;
      if (ext.apiPath) provider.apiPath = ext.apiPath;
      if (ext.defaultModel) provider.defaultModel = ext.defaultModel;
      if (ext.models && Array.isArray(ext.models)) provider.models = ext.models;
      if (ext.name) provider.name = ext.name;
    }
  }
};
