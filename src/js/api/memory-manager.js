/**
 * 记忆管理器
 * 自动压缩长对话历史，优化跨会话引用的 Token 消耗
 */
var MemoryManager = (function () {
  var _config = null;
  var _summarizing = {}; // { convId: true } 防重入

  /**
   * 加载记忆 skill 配置
   */
  function getConfig() {
    if (_config) return Promise.resolve(_config);
    return window.Skills.get('memory').then(function (skill) {
      if (skill) {
        _config = {
          keepRecent: (skill.config && skill.config.keepRecent) || 6,
          triggerThreshold: (skill.config && skill.config.triggerThreshold) || 10,
          summaryTemperature: (skill.config && skill.config.summaryTemperature) || 0.2,
          summaryPrompt: skill.summaryPrompt || '',
          refSummaryPrompt: skill.refSummaryPrompt || '',
          contextWindow: (skill.config && skill.config.contextWindow) || 128000,
          reserveRatio: (skill.config && skill.config.reserveRatio) || 0.75,
          triggerTokenThreshold: (skill.config && skill.config.triggerTokenThreshold) || 20000,
          maxSingleTokenLength: (skill.config && skill.config.maxSingleTokenLength) || 6000
        };
      } else {
        // 默认配置（skill 未找到时）
        _config = {
          keepRecent: 6,
          triggerThreshold: 10,
          summaryTemperature: 0.2,
          summaryPrompt: '请用200字以内总结以下对话的核心内容和关键结论。只输出摘要。',
          refSummaryPrompt: '请用150字以内总结以下对话的核心内容。只输出摘要。',
          contextWindow: 128000,
          reserveRatio: 0.75,
          triggerTokenThreshold: 20000,
          maxSingleTokenLength: 6000
        };
      }
      return _config;
    });
  }

  /**
   * 各 provider 的默认上下文窗口（token）
   * 若 provider 定义中显式声明 contextWindow，则以 provider 的为准
   */
  var _PROVIDER_CONTEXT_WINDOWS = {
    openai: 128000,
    deepseek: 64000,
    kimi: 128000,
    zhipu: 128000,
    tongyi: 131072,
    doubao: 32768,
    minimax: 16384,
    siliconflow: 32768,
    anthropic: 200000,
    gemini: 1000000,
    ollama: 32768,
    mimo: 32768,
    custom: 32768
  };

  /**
   * 粗略估算 Token 数量（中文 1 字 ≈ 1 token，英文 4 字符 ≈ 1 token）
   */
  function approxTokenCount(text) {
    if (!text) return 0;
    var chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    var otherChars = text.length - chineseChars;
    return chineseChars + Math.ceil(otherChars / 4);
  }

  /**
   * 调用 API 生成摘要
   * @param {string} conversationText - 要摘要的对话文本
   * @param {string} promptType - 'summary' | 'refSummary'
   */
  async function callSummarizeApi(conversationText, promptType) {
    var cfg = await getConfig();
    var activeConfig = window.ApiConfig.getActiveConfig();
    var providerId = activeConfig.providerId;
    var config = activeConfig.config;
    var provider = window.AI_PROVIDERS[providerId];

    if (!provider || !config.apiKey) {
      console.warn('[Memory] 无可用 API 配置，跳过摘要');
      return null;
    }

    var systemPrompt = promptType === 'refSummary' ? cfg.refSummaryPrompt : cfg.summaryPrompt;
    if (!systemPrompt) {
      systemPrompt = '请总结以下对话的核心内容。只输出摘要，不要加任何前缀或解释。';
    }

    var url;
    if (provider.getUrl) {
      url = provider.getUrl(config.baseURL, config.model, config.apiKey);
    } else {
      url = config.baseURL + provider.apiPath;
    }

    // 摘要请求使用简短格式
    var summaryMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conversationText }
    ];

    var body = provider.buildRequestBody(summaryMessages, config.model, {
      temperature: cfg.summaryTemperature,
      maxTokens: 500
    });

    try {
      var result = await window.electron.apiFetch({
        url: url,
        method: 'POST',
        headers: provider.headers(config.apiKey),
        body: body,
        requestId: 'mem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)
      });

      if (result.ok && result.data) {
        var content = provider.parseResponse(result.data);
        return content || null;
      }
    } catch (e) {
      console.warn('[Memory] 摘要 API 调用失败:', e.message);
    }
    return null;
  }

  /**
   * 对单个会话生成并缓存摘要
   */
  async function summarizeConversation(convId) {
    if (_summarizing[convId]) return; // 已在摘要中
    _summarizing[convId] = true;

    try {
      var allConvs = await window.ChatManager._loadConversations();
      var conv = null;
      for (var i = 0; i < allConvs.length; i++) {
        if (allConvs[i].id === convId) { conv = allConvs[i]; break; }
      }
      if (!conv || conv.messages.length === 0) { delete _summarizing[convId]; return; }

      // 构建对话文本
      var textParts = [];
      for (var j = 0; j < conv.messages.length; j++) {
        var roleLabel = conv.messages[j].role === 'user' ? '用户' : 'AI';
        textParts.push(roleLabel + '：' + conv.messages[j].content);
      }
      var convText = textParts.join('\n');

      var summary = await callSummarizeApi(convText, 'refSummary');
      if (summary) {
        // 更新会话对象的 memory
        if (!conv.memory) conv.memory = {};
        conv.memory.summary = summary;
        conv.memory.summarizedUpTo = conv.messages.length;
        conv.memory.lastSummaryType = 'ref';
        conv.memory.lastUpdated = Date.now();

        // 持久化
        await window.ChatManager._saveConversations(allConvs);
        console.log('[Memory] 会话 ' + convId + ' 摘要已更新 (' + approxTokenCount(summary) + ' tokens)');
      }
    } catch (e) {
      console.warn('[Memory] 摘要生成异常:', e.message);
    }
    delete _summarizing[convId];
  }

  /**
   * 对当前会话进行增量摘要（只摘要 1 到 (total - keepRecent) 条消息）
   */
  async function summarizeCurrentConversation(convId) {
    if (_summarizing[convId]) return;
    _summarizing[convId] = true;

    try {
      var cfg = await getConfig();
      var allConvs = await window.ChatManager._loadConversations();
      var conv = null;
      for (var i = 0; i < allConvs.length; i++) {
        if (allConvs[i].id === convId) { conv = allConvs[i]; break; }
      }
      if (!conv) { delete _summarizing[convId]; return; }

      var total = conv.messages.length;
      var keepRecent = cfg.keepRecent;

      // 不满足触发条件
      if (total < cfg.triggerThreshold) { delete _summarizing[convId]; return; }

      // 检查是否需要更新：已有摘要 + 新增未超过 2 条 → 跳过
      if (conv.memory && conv.memory.summary && conv.memory.summarizedUpTo) {
        var newMsgs = total - conv.memory.summarizedUpTo;
        if (newMsgs <= 2) { delete _summarizing[convId]; return; }
      }

      var summaryUpTo = Math.max(0, total - keepRecent);
      if (summaryUpTo <= 0) { delete _summarizing[convId]; return; }

      // 构建要摘要的消息文本
      var textParts = [];
      for (var j = 0; j < summaryUpTo; j++) {
        var roleLabel = conv.messages[j].role === 'user' ? '用户' : 'AI';
        textParts.push(roleLabel + '：' + conv.messages[j].content);
      }

      // 如果已有旧摘要，追加到前面
      var convText = textParts.join('\n');
      if (conv.memory && conv.memory.summary && conv.memory.summaryType === 'current') {
        convText = '[此前摘要]\n' + conv.memory.summary + '\n\n[新对话]\n' + convText;
      }

      var summary = await callSummarizeApi(convText, 'summary');
      if (summary) {
        if (!conv.memory) conv.memory = {};
        conv.memory.summary = summary;
        conv.memory.summarizedUpTo = summaryUpTo;
        conv.memory.summaryType = 'current';
        conv.memory.lastUpdated = Date.now();

        await window.ChatManager._saveConversations(allConvs);
        console.log('[Memory] 当前会话摘要已更新，压缩 ' + summaryUpTo + ' 条 → ' + approxTokenCount(summary) + ' tokens');
      }
    } catch (e) {
      console.warn('[Memory] 当前会话摘要异常:', e.message);
    }
    delete _summarizing[convId];
  }

  /**
   * 估算一组消息的总 Token 数
   */
  function estimateMessagesTokens(messages) {
    if (!messages) return 0;
    var total = 0;
    for (var i = 0; i < messages.length; i++) {
      total += approxTokenCount(messages[i].content) + 4; // +4 近似消息元数据开销
    }
    return total;
  }

  /**
   * 获取指定 provider 的上下文窗口（token）
   * 优先级：provider 定义中显式声明 contextWindow > 内置映射 > skill 全局默认
   */
  async function getContextWindow(providerId) {
    var cfg = await getConfig();
    var provider = window.AI_PROVIDERS && window.AI_PROVIDERS[providerId];
    if (provider && provider.contextWindow) return provider.contextWindow;
    if (providerId && _PROVIDER_CONTEXT_WINDOWS[providerId]) {
      return _PROVIDER_CONTEXT_WINDOWS[providerId];
    }
    return cfg.contextWindow;
  }

  /**
   * 按 Token 预算截断文本，保留首尾（中间省略），避免语义集中在单端
   */
  function truncateText(text, maxTokens) {
    if (!text) return text;
    var tokens = approxTokenCount(text);
    if (tokens <= maxTokens) return text;
    var ratio = Math.max(0.1, maxTokens / tokens);
    var frontChars = Math.floor(text.length * ratio * 0.6);
    var backChars = Math.floor(text.length * ratio * 0.4);
    return text.substring(0, frontChars) + '\n……[内容过长已截断]……\n' + text.substring(text.length - backChars);
  }

  /**
   * 构造压缩候选：保留全部 system 消息 + 最近 keepCount 条 user/assistant 消息（保持原顺序）
   */
  function buildBudgetCandidate(messages, keepCount) {
    var nonSysIndices = [];
    for (var i = 0; i < messages.length; i++) {
      if (messages[i].role !== 'system') nonSysIndices.push(i);
    }
    if (nonSysIndices.length <= keepCount) return messages;
    var keepStart = nonSysIndices.length - keepCount;
    var keepSet = {};
    for (var j = keepStart; j < nonSysIndices.length; j++) {
      keepSet[nonSysIndices[j]] = true;
    }
    var result = [];
    for (var k = 0; k < messages.length; k++) {
      if (messages[k].role === 'system' || keepSet[k]) result.push(messages[k]);
    }
    return result;
  }

  /**
   * 分级压缩消息数组到预算内：
   * 1. 单条超长消息截断保护
   * 2. 最近保留条数从 keepRecent 逐级收窄（最低 2 条）
   * 3. 仍超出则对非 system 消息按比例整体截断兜底
   */
  function compressMessages(apiMessages, maxContextTokens, cfg) {
    var result = apiMessages.slice();
    var maxSingle = cfg.maxSingleTokenLength;

    // 1. 单条超长消息截断保护
    for (var i = 0; i < result.length; i++) {
      if (approxTokenCount(result[i].content) > maxSingle) {
        result[i] = { role: result[i].role, content: truncateText(result[i].content, maxSingle) };
      }
    }
    if (estimateMessagesTokens(result) <= maxContextTokens) return result;

    // 2. 从 keepRecent 逐级收窄最近保留消息
    for (var keep = Math.max(2, cfg.keepRecent); keep >= 2; keep--) {
      var candidate = buildBudgetCandidate(result, keep);
      if (estimateMessagesTokens(candidate) <= maxContextTokens) return candidate;
    }

    // 3. 兜底：非 system 消息按比例整体截断
    var total = estimateMessagesTokens(result);
    var ratio = Math.max(0.1, maxContextTokens / total);
    var fallback = [];
    for (var j = 0; j < result.length; j++) {
      var m = result[j];
      if (m.role === 'system') {
        fallback.push(m);
        continue;
      }
      fallback.push({
        role: m.role,
        content: truncateText(m.content, Math.max(50, Math.floor(approxTokenCount(m.content) * ratio)))
      });
    }
    return fallback;
  }

  /**
   * 上下文预算管理
   * sendMessage 组装出最终 apiMessages 后调用：
   * 总 Token 超过 contextWindow × reserveRatio 时分级压缩
   *
   * @param {Array} apiMessages - 最终的 API 消息数组
   * @param {string} providerId - 实际使用的 provider ID
   * @returns {Promise<Array>} 压缩后（或原样）的消息数组
   */
  async function applyBudget(apiMessages, providerId) {
    if (!apiMessages || apiMessages.length === 0) return apiMessages;
    var cfg = await getConfig();
    var windowTokens = await getContextWindow(providerId);
    var maxContextTokens = Math.floor(windowTokens * cfg.reserveRatio);
    var total = estimateMessagesTokens(apiMessages);

    if (total <= maxContextTokens) return apiMessages;

    var compressed = compressMessages(apiMessages, maxContextTokens, cfg);
    var compressedTokens = estimateMessagesTokens(compressed);
    console.log('[Memory] 上下文预算压缩: ' + total + ' → ' + compressedTokens +
      ' tokens (窗口 ' + windowTokens + ', 上限 ' + maxContextTokens + ')');
    return compressed;
  }

  /**
   * 构建优化的上下文消息数组
   * 在 sendMessage 前调用
   *
   * @param {Array} messages - 当前会话的完整消息列表
   * @param {string} convId - 当前会话 ID
   * @param {Array} refConvIds - 被引用的会话 ID 列表
   * @returns {Promise<Array>} 优化后的消息数组
   */
  async function buildContext(messages, convId, refConvIds) {
    var cfg = await getConfig();
    var result = [];
    var needBackgroundSummarize = false;

    // 1. 检查当前会话记忆
    var allConvs = await window.ChatManager._loadConversations();
    var currentConv = null;
    for (var i = 0; i < allConvs.length; i++) {
      if (allConvs[i].id === convId) { currentConv = allConvs[i]; break; }
    }

    if (currentConv && currentConv.memory && currentConv.memory.summary &&
        currentConv.memory.summaryType === 'current' && currentConv.memory.summarizedUpTo > 0) {
      // 注入记忆摘要 + 只保留最近消息
      var memoryMsg = {
        role: 'system',
        content: '[会话记忆] 此前对话摘要：\n' + currentConv.memory.summary
      };
      result.push(memoryMsg);

      // 只保留 summarizedUpTo 之后的消息（最近的消息）
      var recentStart = currentConv.memory.summarizedUpTo;
      var recentMsgs = messages.slice(recentStart);
      result = result.concat(recentMsgs);

      // 检查是否需要后台更新摘要
      if (messages.length - recentStart > 2) {
        needBackgroundSummarize = true;
      }
    } else {
      // 无摘要：使用完整消息
      result = messages.slice();

      // 检查是否需要触发摘要：条数阈值 + Token 阈值双条件
      if (messages.length >= cfg.triggerThreshold ||
          estimateMessagesTokens(messages) >= cfg.triggerTokenThreshold) {
        needBackgroundSummarize = true;
      }
    }

    if (needBackgroundSummarize && convId) {
      // 延迟触发后台摘要（不阻塞）
      setTimeout(function () {
        summarizeCurrentConversation(convId);
      }, 1000);
    }

    return result;
  }

  /**
   * 获取引用会话的摘要上下文
   * 用于替换之前的全量消息注入
   *
   * @param {Array} refConvIds - 被引用的会话 ID 列表
   * @returns {Promise<{contextMessages: Array, refConvTitles: Array}>}
   */
  async function getRefContext(refConvIds) {
    if (!refConvIds || refConvIds.length === 0) {
      return [];
    }

    var cfg = await getConfig();
    var allConvs = await window.ChatManager._loadConversations();
    var contextMessages = [];
    var summaries = [];
    var needSummarize = [];

    for (var ri = 0; ri < refConvIds.length; ri++) {
      var conv = null;
      for (var rj = 0; rj < allConvs.length; rj++) {
        if (allConvs[rj].id === refConvIds[ri]) { conv = allConvs[rj]; break; }
      }
      if (!conv) continue;

      var title = conv.title || '会话';
      var summary = conv.memory && conv.memory.summary;

      if (summary) {
        // 有缓存摘要：直接注入
        summaries.push({ convId: conv.id, title: title, summary: summary, cached: true });
      } else {
        // 无缓存：使用全量消息（首次引用）+ 标记需要后台摘要
        var convText = '【' + title + '】的历史对话：\n';
        for (var rk = 0; rk < conv.messages.length; rk++) {
          var roleLabel = conv.messages[rk].role === 'user' ? '问' : '答';
          convText += roleLabel + '：' + conv.messages[rk].content + '\n';
        }
        summaries.push({ convId: conv.id, title: title, fullText: convText, cached: false });
        needSummarize.push(conv.id);
      }
    }

    if (summaries.length > 0) {
      var refTexts = [];
      for (var si = 0; si < summaries.length; si++) {
        var s = summaries[si];
        if (s.cached) {
          refTexts.push('【引用: ' + s.title + '】会话摘要：' + s.summary);
        } else if (s.fullText) {
          refTexts.push(s.fullText);
        }
      }

      if (refTexts.length > 0) {
        var promptText = summaries.some(function (s) { return s.cached; })
          ? '以下是被用户引用的历史会话内容（含摘要和完整记录），请仔细阅读并根据用户的问题进行分析：\n\n'
          : '以下是被用户引用的历史会话内容，请仔细阅读并根据用户的问题进行分析：\n\n';

        contextMessages.push({
          role: 'system',
          content: promptText + refTexts.join('\n---\n') +
            '\n---\n请基于以上历史对话内容，回答用户当前的问题。'
        });
      }

      // 后台摘要未缓存会话
      if (needSummarize.length > 0) {
        setTimeout(function () {
          for (var ni = 0; ni < needSummarize.length; ni++) {
            summarizeConversation(needSummarize[ni]);
          }
        }, 2000);
      }
    }

    return contextMessages;
  }

  /**
   * 对外：获取引用会话的上下文（由 chat.js 调用）
   */
  return {
    buildContext: buildContext,
    getRefContext: getRefContext,
    summarizeCurrentConversation: summarizeCurrentConversation,
    applyBudget: applyBudget
  };
})();

// 暴露给 chat.js 使用；依赖 ChatManager 的 _loadConversations / _saveConversations
