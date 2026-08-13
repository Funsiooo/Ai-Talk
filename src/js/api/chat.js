/**
 * 聊天核心逻辑模块
 * 管理消息发送、接收、渲染和会话存储
 */

var ChatManager = (function () {
  // 当前会话状态
  var currentConversationId = null;
  var messages = [];
  var isProcessing = false;
  var currentProviderLogo = '../../assets/logo.png'; // 默认 logo
  var currentRequestId = null; // 当前进行中的请求 ID，用于取消

  // 存储路径（首次使用时异步初始化）
  var _conversationsFilePath = null;

  // 获取会话文件路径
  function getConversationsFilePath() {
    if (_conversationsFilePath) return Promise.resolve(_conversationsFilePath);
    return window.electron.getDataPath().then(function (dataPath) {
      _conversationsFilePath = dataPath + '/ai-talk-conversations.json';
      return _conversationsFilePath;
    });
  }

  // ========== 会话管理（文件存储 + localStorage 降级） ==========

  // 内存缓存：加载后常驻，避免每次读写都全量解析文件
  var _convsCache = null;       // 会话数组缓存
  var _convsLoadPromise = null; // 加载中的 Promise（并发去重）

  function loadConversations() {
    if (_convsCache) return Promise.resolve(_convsCache);
    if (_convsLoadPromise) return _convsLoadPromise;
    _convsLoadPromise = getConversationsFilePath().then(function (filePath) {
      return window.electron.readFile(filePath);
    }).then(function (raw) {
      if (raw) {
        // 同步写入 localStorage，@mention 引用才能读到最新数据
        try { localStorage.setItem('ai-talk-conversations', raw); } catch (e) {}
        return JSON.parse(raw);
      }
      return [];
    }).catch(function () {
      // 降级到 localStorage
      try {
        var raw = localStorage.getItem('ai-talk-conversations');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }).then(function (convs) {
      _convsCache = convs;
      _convsLoadPromise = null;
      return convs;
    });
    return _convsLoadPromise;
  }

  // 指数退避重试写盘（最多重试 2 次：500ms → 1000ms）
  function writeConversationsFile(filePath, data, attempt) {
    return window.electron.writeFile(filePath, data).catch(function (e) {
      if (attempt >= 2) {
        console.error('保存会话到文件失败（已重试 3 次）:', e);
        return;
      }
      var delay = 500 * Math.pow(2, attempt);
      return new Promise(function (resolve) {
        setTimeout(function () {
          writeConversationsFile(filePath, data, attempt + 1).then(resolve);
        }, delay);
      });
    });
  }

  function saveConversations(convs) {
    var data = JSON.stringify(convs, null, 2);
    // 更新内存缓存（写入方传入的就是最新数组）
    _convsCache = convs;
    // 同步写入 localStorage 作为备份
    try {
      localStorage.setItem('ai-talk-conversations', data);
    } catch (e) {}
    // 异步写入文件（指数退避重试）
    return getConversationsFilePath().then(function (filePath) {
      return writeConversationsFile(filePath, data, 0);
    });
  }

  function generateId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 创建新会话
  function newConversation() {
    return loadConversations().then(function (convs) {
      // 已存在空会话则直接复用，不再新建
      var emptyTitle = '新会话';
      for (var i = 0; i < convs.length; i++) {
        if (convs[i].title === emptyTitle && convs[i].messages.length === 0) {
          // 已存在空会话，直接加载它
          return loadConversation(convs[i].id).then(function () { return convs[i]; });
        }
      }

      var conv = {
        id: generateId(),
        title: emptyTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
        // 记录提供商信息，切换会话时恢复对应 Logo
        providerId: ApiConfig.getActiveConfig().providerId,
        providerLogo: currentProviderLogo
      };
      // 限制最多保留 50 个会话
      if (convs.length >= 50) {
        convs = convs.slice(0, 49);
      }
      convs.unshift(conv);
      return saveConversations(convs).then(function () {
        return loadConversation(conv.id).then(function () { return conv; });
      });
    });
  }

  // 加载指定会话
  function loadConversation(convId) {
    return loadConversations().then(function (convs) {
      var conv = null;
      for (var i = 0; i < convs.length; i++) {
        if (convs[i].id === convId) {
          conv = convs[i];
          break;
        }
      }
      if (conv) {
        currentConversationId = conv.id;
        messages = conv.messages.slice();
        // 恢复该会话使用的 Provider Logo
        if (conv.providerLogo) currentProviderLogo = conv.providerLogo;
        renderAllMessages();
        updateHistoryList();
        try { localStorage.setItem('ai-talk-current-conv', conv.id); } catch (e) {}
      } else {
        // 会话不存在则创建新的
        newConversation();
      }
    });
  }

  // 保存当前会话
  function saveCurrentConversation() {
    if (!currentConversationId) return Promise.resolve();
    return loadConversations().then(function (convs) {
      for (var i = 0; i < convs.length; i++) {
        if (convs[i].id === currentConversationId) {
          // 自动更新标题（取第一条用户消息的前 6 个字符）
          var userMsgs = [];
          for (var j = 0; j < messages.length; j++) {
            if (messages[j].role === 'user') {
              userMsgs.push(messages[j].content);
            }
          }
          if (userMsgs.length > 0) {
            var rawTitle = userMsgs[0].substring(0, 10);
            convs[i].title = rawTitle + (userMsgs[0].length > 10 ? '...' : '');
          }
          convs[i].messages = messages.slice();
          convs[i].updatedAt = Date.now();
          // 记录当前提供商信息
          convs[i].providerId = ApiConfig.getActiveConfig().providerId;
          convs[i].providerLogo = currentProviderLogo;
          break;
        }
      }
      return saveConversations(convs);
    });
  }

  // 获取当前会话 ID
  function getCurrentId() {
    return currentConversationId;
  }

  // 设置当前 Provider Logo
  function setProviderLogo(logoPath) {
    currentProviderLogo = logoPath || '../../assets/logo.png';
  }

  // ========== 消息发送 ==========

  // ===== 技能工具调用（本地只读工具，主进程沙箱内执行） =====

  // 工具注册表缓存（主进程返回：name → function schema）
  var _skillToolsRegistry = null;
  function getSkillToolsRegistry() {
    if (_skillToolsRegistry) return Promise.resolve(_skillToolsRegistry);
    return window.electron.getSkillTools().then(function (reg) {
      _skillToolsRegistry = reg || {};
      return _skillToolsRegistry;
    });
  }

  // 解析技能声明的 tools 为 function schema；未引用技能时回退到全局只读工具。
  // 沙箱根目录统一为「技能商店 → 允许访问的路径」，只读且超出范围会被拒绝。
  var GLOBAL_DEFAULT_TOOLS = ['read_file', 'list_dir', 'walk_dir'];

  function resolveSkillTools(skillIds) {
    return getSkillToolsRegistry().then(function (registry) {
      var tools = [];
      var seen = {};
      if (skillIds && skillIds.length > 0) {
        var jobs = [];
        for (var i = 0; i < skillIds.length; i++) {
          jobs.push(window.Skills.get(skillIds[i]).catch(function () { return null; }));
        }
        return Promise.all(jobs).then(function (skillList) {
          for (var i2 = 0; i2 < skillList.length; i2++) {
            var skill = skillList[i2];
            var declared = skill && skill.tools;
            if (!declared || !declared.length) continue;
            for (var j = 0; j < declared.length; j++) {
              var d = declared[j];
              var name = typeof d === 'string' ? d : (d && d.name);
              var base = registry[name];
              if (!base || seen[name]) continue;
              seen[name] = true;
              tools.push({
                name: base.name,
                description: (d && typeof d === 'object' && d.description) || base.description,
                parameters: base.parameters
              });
            }
          }
          // 技能未声明任何工具时，回退到全局只读工具（保证附件/文件可读）
          if (tools.length === 0) pushGlobalDefault();
          return tools;
        });
      }
      // 未引用技能：直接提供全局只读工具
      pushGlobalDefault();
      return tools;

      function pushGlobalDefault() {
        for (var g = 0; g < GLOBAL_DEFAULT_TOOLS.length; g++) {
          var base = registry[GLOBAL_DEFAULT_TOOLS[g]];
          if (!base || seen[base.name]) continue;
          seen[base.name] = true;
          tools.push({ name: base.name, description: base.description, parameters: base.parameters });
        }
      }
    });
  }

  // 按协议把 tools 注入请求 body
  function applySkillToolsToBody(body, provider, skillTools) {
    if (!skillTools || skillTools.length === 0) return body;
    var format = provider.apiFormat || 'openai';
    if (format === 'anthropic') {
      body.tools = skillTools.map(function (t) {
        return { name: t.name, description: t.description, input_schema: t.parameters };
      });
    } else if (format === 'gemini') {
      body.tools = [{ functionDeclarations: skillTools.map(function (t) {
        return { name: t.name, description: t.description, parameters: t.parameters };
      }) }];
    } else {
      // OpenAI 兼容协议：tools 每项必须带 type: 'function'，函数体放 function 字段
      body.tools = skillTools.map(function (t) {
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        };
      });
    }
    return body;
  }

  // 提取模型返回的工具调用（按协议；无工具调用返回 null）
  function extractToolCalls(provider, data) {
    var format = provider.apiFormat || 'openai';
    var calls = [];
    if (format === 'openai') {
      var fc = data.choices && data.choices[0];
      if (!fc || fc.finish_reason !== 'tool_calls' || !fc.message || !fc.message.tool_calls) return null;
      for (var i = 0; i < fc.message.tool_calls.length; i++) {
        var tc = fc.message.tool_calls[i];
        if (tc.type !== 'function' || !tc.function) continue;
        var args = {};
        if (tc.function.arguments) {
          try { args = JSON.parse(tc.function.arguments); } catch (e) { args = {}; }
        }
        calls.push({ id: tc.id, name: tc.function.name, args: args });
      }
      return calls.length ? calls : null;
    }
    if (format === 'anthropic') {
      if (data.stop_reason !== 'tool_use') return null;
      var blocks = (data.content || []).filter(function (b) { return b.type === 'tool_use'; });
      if (!blocks.length) return null;
      for (var j = 0; j < blocks.length; j++) {
        calls.push({ id: blocks[j].id, name: blocks[j].name, args: blocks[j].input || {} });
      }
      return calls;
    }
    if (format === 'gemini') {
      var cand = data.candidates && data.candidates[0];
      var parts = cand && cand.content && cand.content.parts;
      if (!parts || !parts.length) return null;
      var fcs = parts.filter(function (p) { return p.functionCall; });
      if (!fcs.length) return null;
      for (var k = 0; k < fcs.length; k++) {
        calls.push({ id: null, name: fcs[k].functionCall.name, args: fcs[k].functionCall.args || {} });
      }
      return calls;
    }
    return null;
  }

  // 追加含工具调用的 assistant/model 消息（按协议）
  function appendAssistantToolMessage(apiMessages, provider, data) {
    var format = provider.apiFormat || 'openai';
    if (format === 'openai') {
      apiMessages.push({
        role: 'assistant',
        content: data.choices[0].message.content || null,
        tool_calls: data.choices[0].message.tool_calls
      });
    } else if (format === 'anthropic') {
      // 原样保留 content 块（text + tool_use），避免上下文歧义
      apiMessages.push({ role: 'assistant', content: data.content || [] });
    } else if (format === 'gemini') {
      var cand = data.candidates[0];
      apiMessages.push({ role: 'model', parts: (cand.content && cand.content.parts) || [] });
    }
  }

  // 执行单个工具调用：本地只读工具走 IPC（主进程按「允许访问的路径」沙箱执行），其余（如 $web_search）回传参数由服务端执行
  // 敏感扫描后的读取策略：'off'（未扫描/无命中）| 'mask'（打码后发送）| 'skip'（跳过敏感文件）| 'cancel'（取消）
  var _sensitiveMode = 'off';
  // 用户发送前点「删除」排除（误检）的敏感值：后续工具读取命中这些值时不做打码/拦截
  var _dlpIgnoredValues = [];

  // 从扫描结果中过滤掉用户已排除的敏感值，返回剩余项（found/计数同步重算）
  function filterIgnoredDlp(scanResult) {
    if (!scanResult || !scanResult.items || _dlpIgnoredValues.length === 0) return scanResult;
    var kept = scanResult.items.filter(function (it) {
      return _dlpIgnoredValues.indexOf(it.value) === -1;
    });
    var highCount = 0;
    var mediumCount = 0;
    for (var i = 0; i < kept.length; i++) {
      if (kept[i].severity === 'high') highCount++; else mediumCount++;
    }
    return { found: kept.length > 0, items: kept, highCount: highCount, mediumCount: mediumCount };
  }

  // 将命中内容替换为脱敏值
  function maskSensitiveContent(content, scanResult) {
    var out = content;
    var items = scanResult && scanResult.items ? scanResult.items : [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.value || !it.masked || it.value === it.masked) continue;
      try { out = out.split(it.value).join(it.masked); } catch (e) {}
    }
    return out;
  }

  // scan_sensitive 结果处理：逐文件 DLP 检测 → 命中则弹窗确认 → 返回模型可见的脱敏报告
  function handleSensitiveScan(res) {
    var files = res.scanned || [];
    var hits = [];
    var hitFiles = {};
    for (var i = 0; i < files.length; i++) {
      var r = (typeof runDlpCheck === 'function') ? runDlpCheck(files[i].content) : null;
      if (!r || !r.found) continue;
      hitFiles[files[i].rel] = true;
      for (var j = 0; j < r.items.length; j++) {
        var it = r.items[j];
        hits.push({ file: files[i].rel, rule: it.name, severity: it.severity, masked: it.masked, value: it.value });
        if (hits.length >= 200) break;
      }
      if (hits.length >= 200) break;
    }
    var base = '目录扫描完成：共 ' + (res.filesTotal != null ? res.filesTotal : files.length) + ' 个文件，实际读取 ' + files.length + ' 个文本文件' +
      (res.skippedBinary ? '（跳过二进制 ' + res.skippedBinary + '）' : '') +
      (res.skippedLarge ? '（跳过超大文件 ' + res.skippedLarge + '）' : '') +
      (res.truncated ? '（已截断）' : '') + '。\n';
    if (hits.length === 0) {
      _sensitiveMode = 'off';
      return base + '未检测到敏感数据，可正常读取文件进行分析。';
    }
    // 命中敏感数据：用应用内自定义弹窗确认（无 Electron Logo）
    var detailLines = hits.slice(0, 10).map(function (h) {
      return '· ' + h.file + ' — ' + h.rule + '  [命中内容: ' + (h.value || '') + ']';
    });
    var detail = '扫描 ' + (res.filesTotal != null ? res.filesTotal : files.length) + ' 个文件，命中 ' + hits.length + ' 处敏感数据：\n\n' + detailLines.join('\n');
    if (hits.length > 10) detail += '\n…（其余 ' + (hits.length - 10) + ' 条省略）';
    return window.showConfirmDialog({
      title: '检测到敏感数据',
      message: '目标目录检测到敏感数据，是否继续将文件内容发送给大模型分析？\n\n' + detail +
        '\n\n选择“继续分析”会对命中内容自动打码后再发送；选择“跳过”将拒绝读取含敏感数据的文件。',
      buttons: [
        { label: '取消分析', value: 'cancel' },
        { label: '跳过含敏感数据的文件', value: 'skip' },
        { label: '继续分析（自动打码）', value: 'mask', primary: true }
      ],
      defaultId: 1
    }).then(function (action) {
      _sensitiveMode = action === 'mask' ? 'mask' : (action === 'skip' ? 'skip' : 'cancel');
      var out = base + '检测到 ' + hits.length + ' 处敏感数据，分布在 ' + Object.keys(hitFiles).length + ' 个文件中：\n';
      var seen = {};
      for (var k = 0; k < hits.length; k++) {
        if (seen[hits[k].file]) continue;
        seen[hits[k].file] = true;
        out += '· ' + hits[k].file + '\n';
      }
      if (action === 'mask') out += '\n用户选择：继续分析。后续读取时命中敏感数据的行将自动打码后再提供给你。';
      else if (action === 'skip') out += '\n用户选择：跳过含敏感数据的文件。后续读取这些文件会被拒绝。';
      else out += '\n用户选择：取消本次分析，请停止读取文件内容。';
      return out;
    }).catch(function () {
      _sensitiveMode = 'skip';
      return base + '检测到 ' + hits.length + ' 处敏感数据，但弹窗确认失败，已按“跳过敏感文件”处理。';
    });
  }

  function executeSkillToolCall(toolName, args, skillIds) {
    return getSkillToolsRegistry().then(function (registry) {
      if (!registry[toolName]) {
        // 非本地工具：原样回传参数
        return JSON.stringify(args);
      }
      return window.electron.executeTool(toolName, args || {}, skillIds || []).then(function (res) {
        try {
          AuditLog.logUserAction({
            action: 'skill_tool_call',
            detail: '工具=' + toolName + ' 参数=' + JSON.stringify(args) +
              (res && res.ok
                ? ' 结果=成功' + (res.size != null ? '(' + res.size + 'B)' : '')
                : ' 结果=失败(' + ((res && res.error) || '未知') + ')')
          });
        } catch (e) {}
        if (!res || !res.ok) {
          return '[工具执行失败] ' + ((res && res.error) || '未知错误');
        }
        if (toolName === 'scan_sensitive' && res.scanned) {
          return handleSensitiveScan(res);
        }
        var content = res.result;
        // DLP：读取内容若含敏感信息，按扫描确认的策略打码/跳过/拦截（用户删除的误检值不参与）
        // walk_dir/list_dir 返回的是文件名清单，标记为目录清单场景（跳过「出生日期」等对文件名误报的规则）
        if (typeof content === 'string' && content.length > 0) {
          var scanOpts = (toolName === 'walk_dir' || toolName === 'list_dir') ? { context: 'dirListing' } : undefined;
          var scanResult = (typeof runDlpCheck === 'function') ? runDlpCheck(content, scanOpts) : null;
          scanResult = filterIgnoredDlp(scanResult);
          if (scanResult && scanResult.found) {
            if (_sensitiveMode === 'mask') {
              content = maskSensitiveContent(content, scanResult);
              return content;
            }
            if (_sensitiveMode === 'skip') {
              return '[工具结果已被拦截] 该文件包含敏感数据，已按你的选择跳过读取。';
            }
            if (_sensitiveMode === 'cancel') {
              return '[工具结果已被拦截] 你已取消本次敏感数据分析，不再读取文件内容。';
            }
            var types = [];
            for (var i = 0; i < scanResult.items.length; i++) {
              if (types.indexOf(scanResult.items[i].name) === -1) types.push(scanResult.items[i].name);
            }
            try {
              // 审计日志：仅记录命中类型与命中内容，不暴露其他信息
              AuditLog.logUserAction({
                action: 'dlp_blocked',
                detail: JSON.stringify({
                  hits: scanResult.items.map(function (it) {
                    return { type: it.name, content: it.value };
                  })
                })
              });
            } catch (e2) {}
            return '[工具结果已被拦截] 读取的内容包含敏感信息（' + types.join('、') + '），为避免外泄未提供给模型。';
          }
        }
        return content;
      }).catch(function (err) {
        return '[工具执行失败] ' + (err && err.message ? err.message : '未知错误');
      });
    });
  }

  // 追加工具结果消息（按协议）
  function appendToolResultMessages(apiMessages, provider, results) {
    var format = provider.apiFormat || 'openai';
    if (format === 'openai') {
      for (var i = 0; i < results.length; i++) {
        apiMessages.push({ role: 'tool', tool_call_id: results[i].id, content: results[i].content });
      }
    } else if (format === 'anthropic') {
      apiMessages.push({
        role: 'user',
        content: results.map(function (r) {
          return { type: 'tool_result', tool_use_id: r.id, content: r.content };
        })
      });
    } else if (format === 'gemini') {
      apiMessages.push({
        role: 'user',
        parts: results.map(function (r) {
          return { functionResponse: { name: r.name, response: { result: r.content } } };
        })
      });
    }
  }

  // 将附件列表构建为引用文本块（只含名称与路径，不读取文件内容）
  // 标注附件是否在工作区内：工作区内给出相对路径（list_dir/read_file 可用），
  // 工作区外明确提示无法用本地工具读取，避免模型误读或转向错误目标
  async function buildAttachmentRefBlock(attachmentRefs) {
    if (!attachmentRefs || attachmentRefs.length === 0) return '';
    var wsPaths = [];
    try {
      wsPaths = await window.electron.getWorkspacePaths() || [];
    } catch (e) { wsPaths = []; }
    var lines = attachmentRefs.map(function (a) {
      var label = a.kind === 'dir' ? a.name + '/（文件夹）' : a.name;
      // 计算附件在工作区内的相对路径（若有）
      var rel = null;
      for (var i = 0; i < wsPaths.length; i++) {
        var ws = wsPaths[i];
        var normWs = ws.replace(/[\\/]+$/, '');
        var normPath = a.path;
        if (normPath === normWs) { rel = '.'; break; }
        if (normPath.indexOf(normWs + '/') === 0) { rel = normPath.substring(normWs.length + 1); break; }
      }
      if (rel !== null) {
        return '- ' + label + ' (工作区内，相对路径: ' + rel + '，可用 list_dir/read_file 访问)';
      }
      return '- ' + label + ' (路径: ' + a.path + '，不在允许访问的工作区内，本地工具无法读取该附件，仅作引用上下文)';
    });
    return '\n\n【附件引用】\n' + lines.join('\n');
  }

  async function sendMessage(userContent, refConvIds, langInstruction, refConvTitles, enableWebSearch, skillIds, attachmentRefs, options) {
    if (isProcessing || !userContent.trim()) return;
    isProcessing = true;
    options = options || {};

    // 发送前附件敏感数据预检（renderer 层 DLP）决定的处理策略：
    // 'mask' → 后续工具读取内容自动打码；'skip' → 命中敏感数据的读取被拒绝；其他 → 保持现状
    if (options.sensitiveMode === 'mask' || options.sensitiveMode === 'skip') {
      _sensitiveMode = options.sensitiveMode;
    }
    // 用户删除（误检）的敏感值：本次发送内跳过这些值的打码/拦截
    _dlpIgnoredValues = options.ignoredValues || [];

    refConvIds = refConvIds || [];
    skillIds = skillIds || [];
    attachmentRefs = attachmentRefs || [];

    // 解析技能引用（ID → { id, name }），用于消息渲染与注入
    var skillRefs = [];
    if (skillIds.length > 0) {
      for (var sri = 0; sri < skillIds.length; sri++) {
        try {
          var skillDef = await window.Skills.get(skillIds[sri]);
          if (skillDef) {
            skillRefs.push({ id: skillDef.id, name: skillDef.name || skillDef.id });
          }
        } catch (e) {
          console.warn('[Chat] 技能解析失败:', skillIds[sri], e);
        }
      }
    }

    var activeConfig = ApiConfig.getActiveConfig();
    var providerId = activeConfig.providerId;
    var config = activeConfig.config;

    // 优先使用发送区模型选择器的值（支持跨 provider 切换：providerId::modelName）
    var modelSelect = document.getElementById('chat-model-select');
    var currentModel = config.model;
    if (modelSelect && modelSelect.value) {
      var selVal = modelSelect.value;
      var sepIdx = selVal.indexOf('::');
      if (sepIdx !== -1) {
        // 跨 provider 格式
        var selProviderId = selVal.substring(0, sepIdx);
        currentModel = selVal.substring(sepIdx + 2);
        // 两个 provider 都有 API Key 时才允许跨 provider 切换
        if (selProviderId && selProviderId !== providerId && config.apiKey) {
          var selConfig = ApiConfig.get(selProviderId);
          if (selConfig.apiKey) {
            providerId = selProviderId;
            config = selConfig;
            ApiConfig.setCurrentProvider(providerId);
          }
        }
      } else {
        currentModel = selVal;
      }
    }

    if (!config.apiKey && !AI_PROVIDERS[providerId].isCustom && AI_PROVIDERS[providerId].authType !== 'none') {
      appendSystemMessage('请先配置模型 API Key');
      isProcessing = false;
      return;
    }

    // 设置当前 Provider 的 Logo
    var provider = AI_PROVIDERS[providerId];
    currentProviderLogo = provider.logo || '../../assets/logo.png';

    // 自动创建新会话（仅在无会话时）
    if (!currentConversationId) {
      await newConversation();
    }

    // ===== 用户画像分析技能（独立分析管道，不进入常规对话流） =====
    for (var isi = 0; isi < skillRefs.length; isi++) {
      if (skillRefs[isi].id === 'user-insight') {
        try {
          await runInsightAnalysis(userContent, providerId, config, currentModel, skillRefs, attachmentRefs, langInstruction, refConvTitles);
        } catch (e) {
          console.warn('[Chat] 用户画像分析失败:', e);
        }
        isProcessing = false;
        return;
      }
    }

    // 记录发起请求时的会话 ID，用于响应回来时校验
    var originConvId = currentConversationId;

    // 添加用户消息：引用会话信息用于渲染引用来源，附件以路径引用外发
    var attachmentBlock = await buildAttachmentRefBlock(attachmentRefs);
    var outboundContent = userContent + attachmentBlock;
    messages.push({ role: 'user', content: outboundContent, refConvTitles: refConvTitles || [], skillRefs: skillRefs });
    appendMessage('user', userContent, false, refConvTitles || [], skillRefs, attachmentRefs);
    await saveCurrentConversation();
    await updateHistoryList();

    // 添加 loading 占位
    var loadingEl = appendMessage('assistant', '', true);

    // 生成请求 ID 用于取消
    var requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    currentRequestId = requestId;

    // 构建请求
    var url;
    if (provider.getUrl) {
      url = provider.getUrl(config.baseURL, config.model, config.apiKey);
    } else {
      url = config.baseURL + provider.apiPath;
    }

    // 读取 @mention 引用的历史会话（使用记忆系统优化，缓存摘要避免重复加载全量消息）
    var contextMessages = [];
    if (refConvIds.length > 0) {
      contextMessages = await MemoryManager.getRefContext(refConvIds);
    }

    // 注入语言指令（隐藏的 system 消息，不影响用户可见内容）
    if (langInstruction) {
      contextMessages.unshift({
        role: 'system',
        content: langInstruction
      });
    }

    // 注入引用的技能 systemPrompt（@skill / 技能商店引用）
    if (skillIds.length > 0) {
      for (var si = 0; si < skillIds.length; si++) {
        try {
          var skill = await window.Skills.get(skillIds[si]);
          if (skill && skill.systemPrompt) {
            var spContent = skill.systemPrompt;
            // 告知模型可访问技能自带文件（需在 SKILL.md 中声明）
            if (skill._dir) {
              spContent += '\n\n（你正在使用技能「' + (skill.name || skill.id) + '」，id: ' + skill.id +
                '。技能自带文件只能用 @skill:' + skill.id + '/<相对路径> 访问，且必须已在 SKILL.md 中声明（files 字段或正文中的 @skill 引用）；' +
                '禁止使用绝对路径。示例：先执行 list_dir path="@skill:' + skill.id + '/" 查看本技能可用文件，再按需读取已声明的文件。' +
                '读取用户本地文件时，只能使用相对「技能商店 → 允许访问的路径」中的相对路径；未设置或超出该范围的路径一律无法读取。）';
            }
            contextMessages.unshift({
              role: 'system',
              content: spContent
            });
          }
        } catch (e) {
          console.warn('[Chat] 技能注入失败:', skillIds[si], e);
        }
      }
    }

    // 解析技能声明的本地工具（read_file / list_dir 等），引用即授权
    var skillTools = await resolveSkillTools(skillIds);

    // 工具使用规范（全局）：工具轮次静默收集信息，完成后一次性输出结论，
    // 避免模型“先输出计划/过程叙述，再调工具”导致未思考完就出结果
    if (skillTools.length > 0) {
      contextMessages.unshift({
        role: 'system',
        content: '工具使用规范：当你在任务中需要调用工具（list_dir、walk_dir、read_file、scan_sensitive 等）时，' +
          '请只调用工具并等待结果，不要输出任何过程性文字、中间计划或阶段性结论；' +
          '保持静默完成所有必要的信息收集。只有在全部信息收集与分析完成后，才一次性输出最终结论。'
      });
    }
    // 工具访问沙箱与技能解耦：所有本地只读工具统一以「技能商店 → 允许访问的路径」为唯一根目录，
    // 未设置任何路径或超出范围的路径，工具调用会返回明确的拒绝提示。

    // 使用记忆系统优化当前会话上下文（长会话自动压缩早期消息为摘要）
    var optimizedMessages = await MemoryManager.buildContext(messages, currentConversationId, refConvIds);

    // 合并上下文消息 + 优化后的当前会话消息
    var apiMessages = contextMessages.concat(optimizedMessages);

    // 上下文预算管理（P0）：估算总 Token，超出 provider 上下文窗口时分级压缩
    apiMessages = await MemoryManager.applyBudget(apiMessages, providerId);

    var body = provider.buildRequestBody(apiMessages, currentModel, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      enableWebSearch: !!enableWebSearch
    });
    // 技能声明的工具注入请求（按协议格式）
    body = applySkillToolsToBody(body, provider, skillTools);

    // ===== 审计日志：记录外发请求 =====
    var auditStartTime = Date.now();
    var auditEventId = 'evt_' + auditStartTime + '_' + Math.random().toString(36).substr(2, 6);
    // 计算引用内容文本（用于审计追溯）
    var auditRefContent = '';
    if (contextMessages.length > 0) {
      for (var rci = 0; rci < contextMessages.length; rci++) {
        auditRefContent += contextMessages[rci].content + '\n';
      }
    }
    var auditTotalChars = JSON.stringify(apiMessages).length;
    AuditLog.logApiRequest({
      conversationId: currentConversationId,
      conversationTitle: '', // 异步获取
      providerId: providerId,
      providerName: AI_PROVIDERS[providerId] ? AI_PROVIDERS[providerId].name : '',
      model: currentModel,
      endpoint: url,
      method: 'POST',
      messageCount: apiMessages.length,
      totalCharacters: auditTotalChars,
      userContent: outboundContent,
      hasContextReference: refConvIds.length > 0,
      referenceConvIds: refConvIds,
      referenceContent: auditRefContent,
      attachments: attachmentRefs,
      skills: skillRefs
    }, auditEventId);

    try {
      var result = await window.electron.apiFetch({
        url: url,
        method: 'POST',
        headers: provider.headers(config.apiKey),
        body: body,
        requestId: requestId
      });

      // ===== 工具调用循环 =====
      // 模型返回工具调用时，把 assistant 消息与执行结果回传重新请求，直到拿到最终内容
      var maxToolRounds = 50;
      var toolRounds = 0;
      var toolCallTotal = 0;
      while (result.ok && result.data && toolRounds < maxToolRounds) {
        var toolCalls = extractToolCalls(provider, result.data);
        if (!toolCalls) break;
        toolRounds++;
        // 1) 追加含工具调用的 assistant/model 消息
        appendAssistantToolMessage(apiMessages, provider, result.data);
        // 2) 依次执行工具调用，收集结果
        var toolResults = [];
        for (var ti = 0; ti < toolCalls.length; ti++) {
          var toolCall = toolCalls[ti];
          var toolContent = await executeSkillToolCall(toolCall.name, toolCall.args, skillIds);
          toolResults.push({ id: toolCall.id, name: toolCall.name, content: toolContent });
          toolCallTotal++;
        }
        // 3) 追加工具结果消息
        appendToolResultMessages(apiMessages, provider, toolResults);
        // 4) 重建 body（保留工具声明）并重新请求
        body = provider.buildRequestBody(apiMessages, currentModel, {
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          enableWebSearch: !!enableWebSearch
        });
        body = applySkillToolsToBody(body, provider, skillTools);
        result = await window.electron.apiFetch({
          url: url,
          method: 'POST',
          headers: provider.headers(config.apiKey),
          body: body,
          requestId: requestId
        });
      }

      // ===== 轮次上限收尾 =====
      // 触顶时模型仍在请求工具，追加“收尾指令”再请求一次，强制输出最终结论
      if (result.ok && result.data && toolRounds >= maxToolRounds) {
        var stillCalls = extractToolCalls(provider, result.data);
        if (stillCalls) {
          apiMessages.push({
            role: 'user',
            content: '[系统提示] 工具调用轮次已达上限，请停止继续调用工具，直接基于当前已获取的全部信息，一次性输出完整、可读的最终结论（含总结与建议）。'
          });
          body = provider.buildRequestBody(apiMessages, currentModel, {
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            enableWebSearch: !!enableWebSearch
          });
          body = applySkillToolsToBody(body, provider, skillTools);
          result = await window.electron.apiFetch({
            url: url,
            method: 'POST',
            headers: provider.headers(config.apiKey),
            body: body,
            requestId: requestId
          });
        }
      }

      // ===== 审计日志：记录 API 响应 =====
      var auditDuration = Date.now() - auditStartTime;
      var auditStatus, auditAiContent = '', auditHttpStatus = 0, auditError = '';
      var auditUsage = null;
      if (result.aborted) {
        auditStatus = 'aborted';
      } else if (result.ok && result.data) {
        auditStatus = 'success';
        auditHttpStatus = result.status;
        try {
          var parsedForLog = provider.parseResponse(result.data);
          auditAiContent = parsedForLog || '';
        } catch (e) {
          auditAiContent = '[解析响应失败]';
        }
        // 提取 Token 用量
        if (result.data.usage) {
          auditUsage = result.data.usage;
          // 异步记录 Token 用量统计
          TokenStats.recordUsage(
            providerId, provider.name, currentModel,
            auditUsage.prompt_tokens || 0,
            auditUsage.completion_tokens || 0,
            auditUsage.total_tokens || 0
          );
        }
      } else {
        auditStatus = 'error';
        auditHttpStatus = result.status || 0;
        auditError = result.error || '';
      }
      AuditLog.logApiResponse({
        requestEventId: auditEventId,
        status: auditStatus,
        httpStatus: auditHttpStatus,
        responseLength: auditAiContent.length,
        durationMs: auditDuration,
        aiContent: auditAiContent,
        error: auditError,
        usage: auditUsage
      });

      // 移除 loading（如果还在当前会话的 DOM 中）
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();

      // 请求是否已被取消（stopMessage 已将 currentRequestId 置为 null 或 abort 已触发）
      if (currentRequestId !== requestId) {
        appendStoppedMessage();
        isProcessing = false;
        scrollToBottom();
        await updateHistoryList();
        return;
      }

      // 会话是否已切换（用户在此期间点击了其他会话）
      if (currentConversationId !== originConvId) {
        // 将结果保存到原始会话中
        if (result.ok && result.data) {
          var content = provider.parseResponse(result.data);
          if (content) {
            await saveMessageToConversation(originConvId, 'assistant', content);
          }
        }
        isProcessing = false;
        currentRequestId = null;
        await updateHistoryList();
        return;
      }

      if (result.ok && result.data) {
        var content = provider.parseResponse(result.data);
        if (content) {
          messages.push({ role: 'assistant', content: content });
          appendMessage('assistant', content);
          await saveCurrentConversation();
        } else {
          appendSystemMessage('模型返回内容为空，请检查 Model 参数是否正确');
        }
      } else {
        var errMsg = parseError(result);
        appendSystemMessage(errMsg);
      }
    } catch (e) {
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      appendSystemMessage('网络请求失败: ' + (e.message || '未知错误'));
      // ===== 审计日志：记录网络异常 =====
      AuditLog.logApiResponse({
        requestEventId: auditEventId,
        status: 'network_error',
        httpStatus: 0,
        responseLength: 0,
        durationMs: Date.now() - auditStartTime,
        aiContent: '',
        error: e.message || '未知网络错误'
      });
    }

    isProcessing = false;
    currentRequestId = null;
    scrollToBottom();
    await updateHistoryList();
  }

  // ===== 用户画像分析管道（检测到 user-insight 技能时调用） =====
  async function runInsightAnalysis(userContent, providerId, config, model, skillRefs, attachmentRefs, langInstruction, refConvTitles) {
    // 追加用户消息（与常规链路一致：附件引用块 + 技能引用栏）
    var attachmentBlock = await buildAttachmentRefBlock(attachmentRefs || []);
    var outboundContent = userContent + attachmentBlock;
    messages.push({ role: 'user', content: outboundContent, refConvTitles: refConvTitles || [], skillRefs: skillRefs || [] });
    appendMessage('user', userContent, false, refConvTitles || [], skillRefs, attachmentRefs);
    await saveCurrentConversation();
    await updateHistoryList();

    // loading 占位
    var loadingEl = appendMessage('assistant', '', true);

    var result = null;
    try {
      result = await window.InsightAnalyzer.analyze(userContent, {
        providerId: providerId,
        config: config,
        model: model,
        langInstruction: langInstruction || ''
      });
    } catch (e) {
      result = { ok: false, error: (e && e.message) || '分析异常' };
    }

    if (loadingEl && loadingEl.parentNode) loadingEl.remove();

    if (result && result.ok) {
      // 保存 AI 分析结果到当前会话（与常规链路一致），避免切换会话后结果丢失；
      // reportHtml 一并保存，供二次访问时恢复「导出分析报告」按钮
      messages.push({ role: 'assistant', content: result.content, reportHtml: result.reportHtml });
      var msgEl = appendMessage('assistant', result.content, false);
      if (window.InsightAnalyzer.attachExportButton) {
        window.InsightAnalyzer.attachExportButton(msgEl, result.reportHtml);
      }
      await saveCurrentConversation();
    } else {
      appendSystemMessage('用户画像分析失败：' + ((result && result.error) || '未知错误'));
    }
    await updateHistoryList();
    scrollToBottom();
  }

  // 将会话结果保存到指定会话（用于会话切换后异步写入原始会话）
  async function saveMessageToConversation(convId, role, content) {
    return loadConversations().then(function (convs) {
      for (var i = 0; i < convs.length; i++) {
        if (convs[i].id === convId) {
          convs[i].messages.push({ role: role, content: content });
          convs[i].updatedAt = Date.now();
          break;
        }
      }
      return saveConversations(convs);
    });
  }

  // 停止当前请求
  function stopMessage() {
    if (currentRequestId) {
      window.electron.apiFetchAbort(currentRequestId);
      currentRequestId = null;
      isProcessing = false;
    }
  }

  // ========== 消息渲染 ==========

  function appendMessage(role, content, isLoading, refConvTitles, skillRefs, attachmentRefs) {
    var container = document.getElementById('chat-messages');
    if (!container) return null;

    // 移除欢迎语
    var welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    var div = document.createElement('div');
    div.className = 'chat-message chat-message-' + role;

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    if (role === 'assistant') {
      // AI 消息使用 Provider Logo
      if (currentProviderLogo && currentProviderLogo.startsWith('../../assets/')) {
        var img = document.createElement('img');
        img.src = currentProviderLogo;
        img.alt = 'AI';
        img.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; object-fit: cover;';
        avatar.style.cssText = 'background: transparent;';
        avatar.appendChild(img);
      } else {
        // emoji 或文字类型 logo
        avatar.style.cssText = 'background: transparent; font-size: 20px;';
        avatar.textContent = currentProviderLogo || 'AI';
      }
    } else {
      // 用户消息使用 logo.png 作为头像
      var userImg = document.createElement('img');
      userImg.src = '../../assets/logo.png';
      userImg.alt = 'User';
      userImg.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; object-fit: cover;';
      avatar.style.cssText = 'background: transparent;';
      avatar.appendChild(userImg);
    }

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    if (isLoading) {
      bubble.innerHTML = '<div class="typing-indicator"><div class="typing-indicator-dots"><span></span><span></span><span></span></div><span class="typing-indicator-text">AI 正在思考...</span></div>';
    } else {
      var html = renderMarkdown(content);
      if (role === 'assistant') {
        html += '<div class="msg-actions"><button class="btn-copy" onclick="ChatManager.copyMessage(this)" title="复制">复制</button></div>';
      }
      bubble.innerHTML = html;
    }

    div.appendChild(avatar);

    // 消息内容包装器（气泡 + 引用来源栏垂直排列）
    var msgWrapper = document.createElement('div');
    msgWrapper.className = 'msg-content-wrapper';
    msgWrapper.appendChild(bubble);

    // 附件引用栏（仅用户消息且引用了附件，只展示名称与路径，不展示文件内容）
    if (role === 'user' && attachmentRefs && attachmentRefs.length > 0) {
      var attachBar = document.createElement('div');
      attachBar.className = 'reference-source-bar attachment-reference-bar';
      var attachHtml = '<svg class="ref-source-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        '<span class="ref-source-label">引用附件：</span>';
      for (var ai = 0; ai < attachmentRefs.length; ai++) {
        if (ai > 0) attachHtml += '<span class="ref-source-sep">、</span>';
        var a = attachmentRefs[ai];
        var aName = a.kind === 'dir' ? a.name + '/（文件夹）' : a.name;
        attachHtml += '<span class="attachment-ref-tag" title="' + escapeHtml(a.path) + '">' + escapeHtml(aName) + '</span>';
      }
      attachBar.innerHTML = attachHtml;
      msgWrapper.appendChild(attachBar);
    }

    // 技能引用栏（仅用户消息且引用了技能）
    if (role === 'user' && skillRefs && skillRefs.length > 0) {
      var skillBar = document.createElement('div');
      skillBar.className = 'reference-source-bar skill-reference-bar';
      var skillHtml = '<img src="../../assets/shop.svg" alt="" class="ref-source-icon">' +
        '<span class="ref-source-label">引用技能：</span>';
      for (var k = 0; k < skillRefs.length; k++) {
        if (k > 0) skillHtml += '<span class="ref-source-sep">、</span>';
        skillHtml += '<span class="skill-ref-tag">@' + escapeHtml(skillRefs[k].name || skillRefs[k].id) + '</span>';
      }
      skillBar.innerHTML = skillHtml;
      msgWrapper.appendChild(skillBar);
    }

    // 引用来源栏（仅用户消息且存在引用）
    if (role === 'user' && refConvTitles && refConvTitles.length > 0) {
      var refBar = document.createElement('div');
      refBar.className = 'reference-source-bar';
      var refHtml = '<img src="../../assets/quote.svg" alt="" class="ref-source-icon">' +
        '<span class="ref-source-label">引用来源：</span>';
      for (var r = 0; r < refConvTitles.length; r++) {
        if (r > 0) refHtml += '<span class="ref-source-sep">、</span>';
        refHtml += '<span class="ref-source-link" data-conv-id="' + refConvTitles[r].id + '">' +
          escapeHtml(refConvTitles[r].title) + '</span>';
      }
      refBar.innerHTML = refHtml;
      // 绑定点击跳转
      refBar.addEventListener('click', function (e) {
        var link = e.target.closest('.ref-source-link');
        if (link) {
          var convId = link.getAttribute('data-conv-id');
          if (convId) ChatManager.loadConversation(convId);
        }
      });
      msgWrapper.appendChild(refBar);
    }

    div.appendChild(msgWrapper);

    container.appendChild(div);
    scrollToBottom();
    return div;
  }

  function appendSystemMessage(text) {
    var container = document.getElementById('chat-messages');
    if (!container) return;

    var div = document.createElement('div');
    div.className = 'chat-message chat-message-system';
    div.innerHTML = '<div class="system-msg">' + escapeHtml(text) + '</div>';
    container.appendChild(div);
    scrollToBottom();
  }

  // 停止回答消息（带 AI logo）
  function appendStoppedMessage() {
    var container = document.getElementById('chat-messages');
    if (!container) return;

    var div = document.createElement('div');
    div.className = 'chat-message chat-message-assistant';

    // AI logo
    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    if (currentProviderLogo && currentProviderLogo.startsWith('../../assets/')) {
      var img = document.createElement('img');
      img.src = currentProviderLogo;
      img.alt = 'AI';
      img.style.cssText = 'width: 28px; height: 28px; border-radius: 50%; object-fit: cover;';
      avatar.style.cssText = 'background: transparent;';
      avatar.appendChild(img);
    } else {
      avatar.style.cssText = 'background: transparent; font-size: 20px;';
      avatar.textContent = currentProviderLogo || 'AI';
    }

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-stopped';
    bubble.textContent = '已停止回答';

    div.appendChild(avatar);
    div.appendChild(bubble);
    container.appendChild(div);
    scrollToBottom();
  }

  function renderAllMessages() {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    container.innerHTML = '';

    if (messages.length === 0) {
      container.innerHTML = '<div class="chat-welcome"><div class="chat-welcome-icon">AI</div><p>发送消息开始对话</p></div>';
      return;
    }

    for (var i = 0; i < messages.length; i++) {
      var msgEl = appendMessage(messages[i].role, messages[i].content, false, messages[i].refConvTitles, messages[i].skillRefs);
      // 恢复 AI 分析消息的「导出分析报告」按钮（reportHtml 随消息持久化）
      if (messages[i].role === 'assistant' && messages[i].reportHtml &&
          window.InsightAnalyzer && window.InsightAnalyzer.attachExportButton) {
        window.InsightAnalyzer.attachExportButton(msgEl, messages[i].reportHtml);
      }
    }
    scrollToBottom();
  }

  function scrollToBottom() {
    var container = document.getElementById('chat-messages');
    if (container) {
      setTimeout(function () {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  // ========== Markdown 渲染（简化版） ==========

  // 简易语法高亮：给代码添加 span 着色
  function highlightCode(code, lang) {
    if (!code) return '';
    var escaped = escapeHtml(code);
    // 用占位符保护已有 tag
    var placeholders = [];
    escaped = escaped.replace(/(<[^>]+>)/g, function (m) {
      placeholders.push(m);
      return '\x00PH' + (placeholders.length - 1) + '\x00';
    });

    var lines = escaped.split('\n');
    var result = [];

    // 通用关键词
    var keywords = 'def|class|return|if|else|elif|for|while|import|from|as|try|except|finally|pass|break|continue|with|yield|lambda|and|or|not|in|is|None|True|False|self|async|await|raise|assert|global|nonlocal|const|let|var|function|new|this|throw|catch|typeof|instanceof|export|default';
    var kwPattern = new RegExp('\\b(' + keywords + ')\\b', 'g');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // 全行注释（Python # / JS //，注释占据整行）
      var fullCommentMatch = line.match(/^(\s*)(#|\/\/)(.*)/);
      if (fullCommentMatch) {
        result.push(fullCommentMatch[1] + '<span class="hljs-comment">' + fullCommentMatch[2] + fullCommentMatch[3] + '</span>');
        continue;
      }

      // 字符串（先提取为占位符，避免后续关键词/数字匹配污染已生成的 span）
      var strPlaceholders = [];
      line = line.replace(/(&quot;[^&]*&quot;|&#39;[^&]*&#39;|"[^"]*"|'[^']*')/g, function (m) {
        strPlaceholders.push('<span class="hljs-string">' + m + '</span>');
        return '\x00STR_' + (strPlaceholders.length - 1) + '\x00';
      });

      // 数字（先于关键词处理，避免误匹配）
      line = line.replace(/\b(\d+\.?\d*)\b/g, '<span class="hljs-number">$1</span>');
      line = line.replace(/0x[0-9a-fA-F]+/g, '<span class="hljs-number">$&</span>');

      // 关键词
      line = line.replace(kwPattern, '<span class="hljs-keyword">$1</span>');

      // 内置函数
      line = line.replace(/\b(print|range|len|type|int|str|float|list|dict|set|tuple|open|input|enumerate|zip|map|filter|sorted|reversed|abs|max|min|sum|round|isinstance|hasattr|getattr|setattr|super|dir|vars|id)\b/g, '<span class="hljs-builtin">$1</span>');

      // 行内注释（# 或 // 出现在代码之后）
      // 使用 span 深度追踪，避免匹配字符串内的 # 或 //
      var depth = 0;
      var commentStart = -1;
      for (var ci = 0; ci < line.length - 1; ci++) {
        if (ci + 7 <= line.length && line.substring(ci, ci + 7) === '</span>') {
          depth--;
          ci += 6;
          continue;
        }
        if (ci + 5 <= line.length && line.substring(ci, ci + 5) === '<span') {
          depth++;
          ci += 4;
          continue;
        }
        if (depth > 0) continue;
        if (line[ci] === '#' && (ci === 0 || line[ci - 1] === ' ') && (ci + 1 < line.length && line[ci + 1] !== '#')) {
          commentStart = ci;
          break;
        }
        if (line[ci] === '/' && line[ci + 1] === '/' && (ci === 0 || line[ci - 1] === ' ')) {
          commentStart = ci;
          break;
        }
      }
      if (commentStart !== -1) {
        line = line.substring(0, commentStart) + '<span class="hljs-comment">' + line.substring(commentStart) + '</span>';
      }

      // 还原字符串占位符
      if (strPlaceholders.length > 0) {
        line = line.replace(/\x00STR_(\d+)\x00/g, function (_, idx) {
          return strPlaceholders[parseInt(idx)];
        });
      }

      result.push(line);
    }
    var highlighted = result.join('\n');

    // 还原占位符
    highlighted = highlighted.replace(/\x00PH(\d+)\x00/g, function (_, idx) {
      return placeholders[parseInt(idx)];
    });

    return highlighted;
  }

  function renderMarkdown(text) {
    if (!text) return '';

    // ---- 代码块 ```code``` —— 从原始文本提取为占位符（避免双重转义与换行破坏） ----
    var codeBlocks = [];
    var result = text.replace(/```(\w*)\n?([\s\S]*?)```/g, function (match, lang, code) {
      var displayLang = lang || 'plaintext';
      var highlighted = highlightCode(code.replace(/^\n+|\n+$/g, ''), displayLang);
      codeBlocks.push(
        '<div class="code-block-wrapper">' +
          '<div class="code-block-header">' +
            '<span class="code-lang-label">' + escapeHtml(displayLang) + '</span>' +
            '<button class="code-copy-btn" title="复制代码">复制</button>' +
          '</div>' +
          '<pre><code class="lang-' + escapeHtml(displayLang) + '">' + highlighted + '</code></pre>' +
        '</div>'
      );
      return '\x00CB_' + (codeBlocks.length - 1) + '\x00';
    });

    // ---- 剩余部分转义 ----
    result = escapeHtml(result);

    // ---- 行内格式化：行内代码 / 粗体 / 斜体 / 链接 / 裸 URL ----
    function inlineFormat(s) {
      if (!s) return '';
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

      // 裸 URL（保护已生成的行内代码标签）
      var inlineCodes = [];
      s = s.replace(/(<code>[^<]*<\/code>)/g, function (m) {
        inlineCodes.push(m);
        return '\x00IC_' + (inlineCodes.length - 1) + '\x00';
      });
      s = s.replace(/(?<![">])(https?:\/\/[^\s<>"]+)/g, function (match) {
        var trimmed = match.replace(/[.,;:!?)\]}>。，；：！？]+$/, '');
        if (trimmed.length < 10) return match;
        var suffix = match.slice(trimmed.length);
        return '<a href="' + trimmed + '" target="_blank">' + trimmed + '</a>' + suffix;
      });
      s = s.replace(/\x00IC_(\d+)\x00/g, function (_, i) { return inlineCodes[parseInt(i)]; });
      return s;
    }

    // ---- 表格 ----
    function parseTableRow(line) {
      var l = line.trim();
      if (l.charAt(0) === '|') l = l.substring(1);
      if (l.charAt(l.length - 1) === '|') l = l.substring(0, l.length - 1);
      var cells = l.split('|');
      for (var c = 0; c < cells.length; c++) cells[c] = inlineFormat(cells[c].trim());
      return cells;
    }

    function isTableSep(line) {
      var t = line.trim();
      return t.indexOf('-') !== -1 && /^\|?[\s:|-]+\|?$/.test(t);
    }

    function renderTable(header, rows) {
      var html = '<table><thead><tr>';
      for (var h = 0; h < header.length; h++) html += '<th>' + (header[h] || '') + '</th>';
      html += '</tr></thead><tbody>';
      for (var r = 0; r < rows.length; r++) {
        html += '<tr>';
        for (var c = 0; c < rows[r].length; c++) html += '<td>' + (rows[r][c] || '') + '</td>';
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }

    // ---- 列表 ----
    function isListLine(line) {
      var t = line.trim();
      return /^[-+*]\s+/.test(t) || /^\d+\.\s+/.test(t);
    }

    // ---- 行级解析：表格 / 引用 / 列表 / 分隔线 / 标题 / 段落 ----
    var lines = result.split('\n');
    var out = [];
    var paragraph = [];
    var i = 0;

    function flushParagraph() {
      if (paragraph.length === 0) return;
      out.push('<p>' + paragraph.map(inlineFormat).join('<br>') + '</p>');
      paragraph = [];
    }

    while (i < lines.length) {
      var line = lines[i];
      var trimmed = line.trim();

      // 代码块占位符
      if (/^\x00CB_\d+\x00$/.test(line)) {
        flushParagraph();
        out.push(line);
        i++;
        continue;
      }

      // 空行
      if (trimmed === '') {
        flushParagraph();
        i++;
        continue;
      }

      // 分隔线 --- / *** / ___
      if (/^[-*_]{3,}\s*$/.test(trimmed)) {
        flushParagraph();
        out.push('<hr>');
        i++;
        continue;
      }

      // 表格：当前行含 | 且下一行是分隔行
      if (line.indexOf('|') !== -1 && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        flushParagraph();
        var header = parseTableRow(line);
        i += 2; // 跳过表头与分隔行
        var rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].indexOf('|') !== -1) {
          rows.push(parseTableRow(lines[i]));
          i++;
        }
        out.push(renderTable(header, rows));
        continue;
      }

      // 引用块 > text
      if (/^&gt;\s?/.test(line)) {
        flushParagraph();
        var quotes = [];
        while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
          quotes.push(inlineFormat(lines[i].replace(/^&gt;\s?/, '')));
          i++;
        }
        out.push('<blockquote>' + quotes.join('<br>') + '</blockquote>');
        continue;
      }

      // 列表（含缩进子列表）
      if (isListLine(line)) {
        flushParagraph();
        var listStack = [];
        while (i < lines.length && lines[i].trim() !== '' && isListLine(lines[i])) {
          var l = lines[i];
          var indent = l.search(/\S/);
          var t = l.trim();
          var olm = t.match(/^(\d+)\.\s+(.*)$/);
          var um = t.match(/^[-+*]\s+(.*)$/);
          var content = olm ? olm[2] : um[1];
          var tag = olm ? 'ol' : 'ul';

          // 弹出更深缩进的层级（缩进值更大 = 层级更深）
          while (listStack.length > 0 && listStack[listStack.length - 1].indent > indent) {
            out.push('</' + listStack.pop().tag + '>');
          }
          var top = listStack[listStack.length - 1];
          if (top && top.indent === indent) {
            // 同缩进但列表类型变化：关闭旧列表，开启新列表
            if (top.tag !== tag) {
              out.push('</' + top.tag + '>');
              listStack.pop();
              out.push('<' + tag + '>');
              listStack.push({ tag: tag, indent: indent });
            }
          } else {
            // 子层级：开启新列表
            out.push('<' + tag + '>');
            listStack.push({ tag: tag, indent: indent });
          }

          // 任务列表 - [ ] / - [x]
          var task = content.match(/^\[( |x|X)\]\s+(.*)$/);
          var itemHtml = inlineFormat(task ? task[2] : content);
          if (task) {
            itemHtml = '<input type="checkbox"' + (task[1] === ' ' ? '' : ' checked') + ' disabled>' + itemHtml;
          }
          out.push('<li>' + itemHtml + '</li>');
          i++;
        }
        while (listStack.length > 0) out.push('</' + listStack.pop().tag + '>');
        continue;
      }

      // 标题 # ~ ######
      var hm = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (hm) {
        flushParagraph();
        var level = Math.min(hm[1].length + 1, 6); // 保持原映射：#→h2, ##→h3, ###→h4
        out.push('<h' + level + '>' + inlineFormat(hm[2]) + '</h' + level + '>');
        i++;
        continue;
      }

      // 普通段落行
      paragraph.push(line);
      i++;
    }
    flushParagraph();

    // 还原代码块占位符
    var html = out.join('');
    html = html.replace(/\x00CB_(\d+)\x00/g, function (_, idx) {
      return codeBlocks[parseInt(idx)];
    });

    return html;
  }

  // ========== 历史列表渲染 ==========

  function updateHistoryList() {
    var listEl = document.getElementById('history-list');
    if (!listEl) return;
    loadConversations().then(function (convs) {
      var html = '';
      for (var i = 0; i < convs.length; i++) {
        var c = convs[i];
        var isActive = c.id === currentConversationId;
        var date = new Date(c.updatedAt);
        var timeStr = date.getMonth() + 1 + '/' + date.getDate() + ' ' +
          ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);

        // 提取第一条用户消息作为悬浮预览
        var preview = '';
        if (c.messages && c.messages.length > 0) {
          for (var j = 0; j < c.messages.length; j++) {
            if (c.messages[j].role === 'user') {
              preview = c.messages[j].content;
              break;
            }
          }
        }
        preview = preview.length > 100 ? preview.substring(0, 97) + '...' : preview;

        html += '<div class="history-item' + (isActive ? ' active' : '') + '" ' +
          'data-conv-id="' + c.id + '" ' +
          'onclick="ChatManager.loadConversation(\'' + c.id + '\')" ' +
          'title="' + escapeHtml(preview || '(空对话)') + '">' +
          '<img src="../../assets/message.svg" alt="" class="history-icon">' +
          '<span class="history-title">' + escapeHtml(c.title) + '</span>' +
          '<span class="history-time">' + timeStr + '</span>' +
          '<button class="history-menu-btn" data-conv-id="' + c.id + '" title="更多操作">...</button>' +
          '<div class="history-dropdown" data-conv-id="' + c.id + '">' +
            '<div class="history-dropdown-item" data-action="rename">修改标题</div>' +
            '<div class="history-dropdown-item" data-action="delete">删除会话</div>' +
          '</div>' +
          '</div>';
      }
      listEl.innerHTML = html || '<div class="history-empty">暂无对话记录</div>';
    });
  }

  function deleteConversation(convId) {
    // 审计日志：记录删除会话
    AuditLog.logUserAction({ action: 'delete_conversation', detail: convId });
    loadConversations().then(function (convs) {
      convs = convs.filter(function (c) { return c.id !== convId; });
      return saveConversations(convs).then(function () { return convs; });
    }).then(function (convs) {
      if (convId === currentConversationId) {
        if (convs.length > 0) {
          loadConversation(convs[0].id);
        } else {
          currentConversationId = null;
          messages = [];
          var container = document.getElementById('chat-messages');
          if (container) {
            container.innerHTML = '<div class="chat-welcome"><div class="chat-welcome-icon">AI</div><p>发送消息开始对话</p></div>';
          }
        }
      }
      updateHistoryList();
    });
  }

  function renameConversation(convId, newTitle) {
    if (!newTitle || !newTitle.trim()) return;
    newTitle = newTitle.trim();
    loadConversations().then(function (convs) {
      for (var i = 0; i < convs.length; i++) {
        if (convs[i].id === convId) {
          convs[i].title = newTitle;
          break;
        }
      }
      return saveConversations(convs);
    }).then(function () {
      updateHistoryList();
    });
  }

  // ========== 历史列表交互：双击编辑标题 + 菜单按钮下拉 ==========
  (function () {
    var listEl = document.getElementById('history-list');
    if (!listEl) return;
    var editingConvId = null;
    var originalTitle = '';

    // 关闭所有打开的菜单
     function closeAllMenus() {
       var menus = document.querySelectorAll('.history-dropdown.open');
       for (var m = 0; m < menus.length; m++) {
         menus[m].classList.remove('open');
         // 归还到原始父元素
         var convId = menus[m].getAttribute('data-conv-id');
         var origParent = convId ? listEl.querySelector('.history-item[data-conv-id="' + convId + '"]') : null;
         if (origParent && menus[m].parentNode !== origParent) {
           origParent.appendChild(menus[m]);
           menus[m].style.position = '';
           menus[m].style.top = '';
           menus[m].style.left = '';
           menus[m].style.right = '';
         } else if (!origParent) {
           // 兜底：找不到对应会话项时挂回列表，避免菜单残留在 body 导致无法再次打开
           if (menus[m].parentNode !== listEl) {
             listEl.appendChild(menus[m]);
             menus[m].style.position = '';
             menus[m].style.top = '';
             menus[m].style.left = '';
             menus[m].style.right = '';
           }
         }
       }
     }

    // 全局点击处理：关闭菜单 + 执行下拉项操作
    document.addEventListener('click', function (e) {
      // 下拉项 → 执行操作
      var dropItem = e.target.closest('.history-dropdown-item');
      if (dropItem) {
        e.stopPropagation();
        var action = dropItem.getAttribute('data-action');
        var dropdown = dropItem.closest('.history-dropdown');
        var convId = dropdown ? dropdown.getAttribute('data-conv-id') : null;
        if (!convId) return;

        if (action === 'delete') {
          closeAllMenus();
          deleteConversation(convId);
        } else if (action === 'rename') {
          closeAllMenus();
          // 触发编辑：找到对应标题 span
          var item = listEl.querySelector('.history-item[data-conv-id="' + convId + '"]');
          if (item) {
            var titleSpan = item.querySelector('.history-title');
            if (titleSpan) {
              editingConvId = convId;
              originalTitle = titleSpan.textContent;
              var input = document.createElement('input');
              input.type = 'text';
              input.className = 'history-title-input';
              input.value = originalTitle;
              input.style.cssText = 'width:100%;border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:13px;outline:none;background:#fff;';
              titleSpan.replaceWith(input);
              input.focus();
              input.select();
              var save = function () {
                var val = input.value.trim();
                if (val && val !== originalTitle) {
                  renameConversation(editingConvId, val);
                } else {
                  updateHistoryList();
                }
                editingConvId = null;
              };
              input.addEventListener('blur', save);
              input.addEventListener('keydown', function (ke) {
                if (ke.key === 'Enter') { input.blur(); }
                if (ke.key === 'Escape') {
                  editingConvId = null;
                  updateHistoryList();
                }
              });
            }
          }
        }
        return;
      }

      // 点击除菜单按钮和下拉区域外 → 关闭菜单
      if (!e.target.closest('.history-menu-btn') && !e.target.closest('.history-dropdown')) {
        closeAllMenus();
      }
    });

    // 双击标题 → 编辑
    listEl.addEventListener('dblclick', function (e) {
      var titleSpan = e.target.closest('.history-title');
      if (!titleSpan) return;
      var item = titleSpan.closest('.history-item');
      if (!item) return;
      e.stopPropagation();

      // 提取 convId：优先 data-conv-id，回退解析 onclick 属性
      var convIdAttr = item.getAttribute('data-conv-id');
      var match = null;
      if (!convIdAttr) {
        var onclick = item.getAttribute('onclick') || '';
        match = onclick.match(/loadConversation\('([^']+)'\)/);
      }
      if (!convIdAttr && !match) return;
      editingConvId = convIdAttr || match[1];
      originalTitle = titleSpan.textContent;

      // 替换为输入框
      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'history-title-input';
      input.value = originalTitle;
      input.style.cssText = 'width:100%;border:1px solid #999;border-radius:4px;padding:2px 6px;font-size:13px;outline:none;background:#fff;';
      titleSpan.replaceWith(input);
      input.focus();
      input.select();

      var save = function () {
        var val = input.value.trim();
        if (val && val !== originalTitle) {
          renameConversation(editingConvId, val);
        } else {
          updateHistoryList();
        }
        editingConvId = null;
      };

      input.addEventListener('blur', save);
      input.addEventListener('keydown', function (ke) {
        if (ke.key === 'Enter') { input.blur(); }
        if (ke.key === 'Escape') {
          editingConvId = null;
          updateHistoryList();
        }
      });
    });

    // 点击菜单按钮 → 切换下拉
    // 用 capture 阶段拦截：先于 history-item 的内联 onclick（loadConversation）执行，
    // 避免先切换会话重建列表导致菜单无法弹出
    listEl.addEventListener('click', function (e) {
       var menuBtn = e.target.closest('.history-menu-btn');
       if (menuBtn) {
         e.stopPropagation();
         var convId = menuBtn.getAttribute('data-conv-id');
         // 用 document 范围查找：下拉可能已被移到 body
         var dropdown = document.querySelector('.history-dropdown[data-conv-id="' + convId + '"]');
         if (dropdown) {
           var wasOpen = dropdown.classList.contains('open');
           closeAllMenus();
           if (!wasOpen) {
             // 移到 body 避免被 history-list 的 overflow 裁剪
             if (dropdown.parentNode !== document.body) {
               document.body.appendChild(dropdown);
             }
             var rect = menuBtn.getBoundingClientRect();
             dropdown.style.position = 'fixed';
             dropdown.style.top = (rect.bottom + 4) + 'px';
             dropdown.style.left = (rect.right - 132) + 'px';
             dropdown.style.right = 'auto';
             dropdown.classList.add('open');
           }
         }
       }
     }, true);
  })();

  function copyMessage(btn) {
    var bubble = btn.closest('.chat-bubble');
    if (!bubble) return;
    // 获取纯文本（去除按钮等）
    var clone = bubble.cloneNode(true);
    var actions = clone.querySelector('.msg-actions');
    if (actions) actions.remove();
    var text = clone.textContent.trim();
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = '已复制';
      setTimeout(function () { btn.textContent = '复制'; }, 2000);
    }).catch(function () {
      btn.textContent = '失败';
      setTimeout(function () { btn.textContent = '复制'; }, 2000);
    });
  }

  // ========== 工具函数 ==========

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function parseError(result) {
    if (result.status === 401) return 'API Key 无效，请检查配置';
    if (result.status === 403) return '访问被拒绝，请检查 API Key 权限';
    if (result.status === 404) return '接口不存在，请检查 Base URL 和 Model 参数';
    if (result.status === 429) return '请求频率过高（Rate Limit），请稍后再试';
    if (result.data && result.data.error && result.data.error.message) {
      return result.data.error.message;
    }
    if (result.error) return result.error;
    return '请求失败 (HTTP ' + result.status + ')';
  }

  // ========== 链接点击拦截 & 代码复制 ==========
  (function initMessageClickHandler() {
    var container = document.getElementById('chat-messages');
    if (!container) return;
    container.addEventListener('click', function (e) {
      // 代码块复制按钮
      var copyBtn = e.target.closest('.code-copy-btn');
      if (copyBtn) {
        var wrapper = copyBtn.closest('.code-block-wrapper');
        var code = wrapper ? wrapper.querySelector('code') : null;
        if (code) {
          navigator.clipboard.writeText(code.textContent).then(function () {
            copyBtn.textContent = '已复制';
            copyBtn.classList.add('copied');
            setTimeout(function () {
              copyBtn.textContent = '复制';
              copyBtn.classList.remove('copied');
            }, 2000);
          }).catch(function () {
            copyBtn.textContent = '失败';
            setTimeout(function () {
              copyBtn.textContent = '复制';
            }, 2000);
          });
        }
        return;
      }
      // 链接点击 → 弹出内置浏览器窗口
      var link = e.target.closest('a');
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || !/^https?:\/\//i.test(href)) return;
      e.preventDefault();
      if (window.electron && window.electron.openLinkWindow) {
        window.electron.openLinkWindow(href);
      }
    });
  })();

  return {
    newConversation: newConversation,
    loadConversation: loadConversation,
    deleteConversation: deleteConversation,
    renameConversation: renameConversation,
    sendMessage: sendMessage,
    stopMessage: stopMessage,
    renderAllMessages: renderAllMessages,
    updateHistoryList: updateHistoryList,
    copyMessage: copyMessage,
    getCurrentId: getCurrentId,
    setProviderLogo: setProviderLogo,
    messages: messages,
    // 内部函数，供 MemoryManager 使用
    _loadConversations: loadConversations,
    _saveConversations: saveConversations
  };
})();
