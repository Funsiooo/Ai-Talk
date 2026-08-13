/**
 * 数据面板渲染逻辑
 * 在 index.html 中加载，负责数据面板的初始化与数据渲染
 */

(function () {
  'use strict';

  // ========== 常量 ==========
  var PAGE_SIZE_DEFAULT = 10;      // 列表默认每页条数

  // 模型定价数据（每 1M tokens，标准输入/输出价；阶梯计价取最低档）
  var MODEL_PRICING = {
    // OpenAI
    'gpt-5.6-sol':       { input: 5.00,  output: 30.00, currency: 'USD' },
    'gpt-5.6-terra':     { input: 2.00,  output: 12.00, currency: 'USD' },
    'gpt-5.6-luna':      { input: 0.20,  output: 1.20,  currency: 'USD' },
    'gpt-5.5':           { input: 5.00,  output: 30.00, currency: 'USD' },
    'gpt-5.5-instant':   { input: 5.00,  output: 30.00, currency: 'USD' },
    'gpt-5.4':           { input: 2.50,  output: 15.00, currency: 'USD' },
    'gpt-5.4-mini':      { input: 0.75,  output: 4.50,  currency: 'USD' },
    'gpt-4o':            { input: 2.50,  output: 10.00, currency: 'USD' },
    'gpt-4o-mini':       { input: 0.15,  output: 0.60,  currency: 'USD' },
    'gpt-4-turbo':       { input: 10.00, output: 30.00, currency: 'USD' },
    'o3-mini':           { input: 1.10,  output: 4.40,  currency: 'USD' },
    // DeepSeek
    'deepseek-v4-pro':   { input: 3.00,  output: 6.00,  currency: 'CNY' },
    'deepseek-v4-flash': { input: 1.00,  output: 2.00,  currency: 'CNY' },
    // Kimi（月之暗面，人民币计价）
    'kimi-k2.6':         { input: 6.50,  output: 27.00, currency: 'CNY' },
    'kimi-k2.5':         { input: 4.00,  output: 21.00, currency: 'CNY' },
    'kimi-k2':           { input: 4.00,  output: 16.00, currency: 'CNY' },  // 已下线，保留历史价
    'moonshot-v1-8k':    { input: 2.00,  output: 10.00, currency: 'CNY' },
    'moonshot-v1-32k':   { input: 5.00,  output: 20.00, currency: 'CNY' },
    'moonshot-v1-128k':  { input: 10.00, output: 30.00, currency: 'CNY' },
    // 智谱
    'glm-5.2':           { input: 8.00,  output: 28.00, currency: 'CNY' },
    'glm-5.1':           { input: 6.00,  output: 24.00, currency: 'CNY' },
    'glm-5':             { input: 4.00,  output: 18.00, currency: 'CNY' },
    'glm-5-turbo':       { input: 5.00,  output: 22.00, currency: 'CNY' },
    'glm-4.7':           { input: 2.00,  output: 8.00,  currency: 'CNY' },
    'glm-4-plus':        { input: 5.0,   output: 5.0,   currency: 'CNY' },
    'glm-4-flash':       { input: 0,     output: 0,     currency: 'CNY' },  // 官方免费
    'glm-4-air':         { input: 0.6,   output: 0.6,   currency: 'CNY' },
    'glm-4-long':        { input: 1.0,   output: 1.0,   currency: 'CNY' },
    'glm-z1-air':        { input: 0.5,   output: 0.5,   currency: 'CNY' },
    // 通义千问
    'qwen3.6-plus':      { input: 2.00,  output: 12.00, currency: 'CNY' },
    'qwen3.5-plus':      { input: 0.80,  output: 4.80,  currency: 'CNY' },
    'qwen3-max':         { input: 2.50,  output: 10.00, currency: 'CNY' },
    'qwen3-plus':        { input: 0.80,  output: 2.00,  currency: 'CNY' },
    'qwen3-235b-a22b-instruct': { input: 2.00, output: 8.00, currency: 'CNY' },
    'qwen-coder-plus':   { input: 4.00,  output: 16.00, currency: 'CNY' },
    'qwen-max':          { input: 2.40,  output: 9.60,  currency: 'CNY' },
    'qwen-plus':         { input: 0.80,  output: 2.00,  currency: 'CNY' },
    'qwen-turbo':        { input: 0.30,  output: 0.60,  currency: 'CNY' },
    'qwen2.5-72b-instruct': { input: 4.0, output: 12.0, currency: 'CNY' },
    // 豆包
    'doubao-seed-2-1-pro-260628':         { input: 6.00, output: 30.00, currency: 'CNY' },
    'doubao-seed-2-1-turbo-260628':       { input: 3.00, output: 15.00, currency: 'CNY' },
    'doubao-seed-evolving':               { input: 6.00, output: 30.00, currency: 'CNY' },
    'doubao-seed-2-0-pro-260215':         { input: 3.20, output: 16.00, currency: 'CNY' },
    'doubao-seed-2-0-lite-260428':        { input: 0.60, output: 3.60,  currency: 'CNY' },
    'doubao-seed-2-0-mini-260428':        { input: 0.20, output: 2.00,  currency: 'CNY' },
    'doubao-seed-2-0-code-preview-260215': { input: 3.20, output: 16.00, currency: 'CNY' },
    'doubao-pro-32k':    { input: 0.8,   output: 2.0,   currency: 'CNY' },
    'doubao-pro-128k':   { input: 5.0,   output: 9.0,   currency: 'CNY' },
    'doubao-lite-32k':   { input: 0.3,   output: 0.6,   currency: 'CNY' },
    'doubao-lite-128k':  { input: 0.8,   output: 1.0,   currency: 'CNY' },
    // MiniMax
    'MiniMax-M3':              { input: 2.10, output: 8.40,  currency: 'CNY' },  // 五折促销价
    'MiniMax-M2.7':            { input: 2.10, output: 8.40,  currency: 'CNY' },
    'MiniMax-M2.7-highspeed':  { input: 4.20, output: 16.80, currency: 'CNY' },
    'MiniMax-M2.5':            { input: 2.10, output: 8.40,  currency: 'CNY' },
    'MiniMax-M2.5-highspeed':  { input: 4.20, output: 16.80, currency: 'CNY' },
    'MiniMax-M2.1':            { input: 2.10, output: 8.40,  currency: 'CNY' },
    'MiniMax-01':              { input: 1.00, output: 8.00,  currency: 'CNY' },
    'abab7-chat':        { input: 5.0,   output: 15.0,  currency: 'CNY' },
    'abab6.5s-chat':     { input: 2.5,   output: 7.5,   currency: 'CNY' },
    // 硅基流动
    'Qwen/Qwen2.5-7B-Instruct':     { input: 0.35, output: 0.70, currency: 'CNY' },
    'Qwen/Qwen2.5-72B-Instruct':    { input: 4.13, output: 4.13, currency: 'CNY' },
    'deepseek-ai/DeepSeek-V3':      { input: 1.0,  output: 2.0,  currency: 'CNY' },
    'meta-llama/Meta-Llama-3.1-8B-Instruct': { input: 0.35, output: 0.70, currency: 'CNY' },
    // Anthropic
    'claude-sonnet-5':      { input: 2.00,  output: 10.00, currency: 'USD' },
    'claude-opus-5':        { input: 5.00,  output: 25.00, currency: 'USD' },
    'claude-fable-5':       { input: 10.00, output: 50.00, currency: 'USD' },
    'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00, currency: 'USD' },
    'claude-opus-4-8':      { input: 5.00,  output: 25.00, currency: 'USD' },
    'claude-opus-4-7':      { input: 5.00,  output: 25.00, currency: 'USD' },
    'claude-sonnet-4-6':    { input: 3.00,  output: 15.00, currency: 'USD' },
    'claude-3-5-sonnet-latest': { input: 3.00, output: 15.00, currency: 'USD' },
    'claude-3-opus-latest':     { input: 15.00, output: 75.00, currency: 'USD' },
    'claude-3-haiku-latest':    { input: 0.25, output: 1.25, currency: 'USD' },
    // Google
    'gemini-3.1-pro':       { input: 2.00,  output: 12.00, currency: 'USD' },
    'gemini-3-pro':         { input: 2.00,  output: 12.00, currency: 'USD' },
    'gemini-3-flash':       { input: 0.50,  output: 3.00,  currency: 'USD' },
    'gemini-3-flash-lite':  { input: 0.25,  output: 1.50,  currency: 'USD' },
    'gemini-2.5-pro':       { input: 1.25,  output: 10.00, currency: 'USD' },
    'gemini-2.5-flash':     { input: 0.30,  output: 2.50,  currency: 'USD' },
    'gemini-2.0-flash':     { input: 0.10,  output: 0.40,  currency: 'USD' },
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.30, currency: 'USD' },
    // MiMo
    'MiMo-7B-Instruct':  { input: 0.5, output: 1.0, currency: 'CNY' },
    'MiMo-14B-Instruct': { input: 1.0, output: 2.0, currency: 'CNY' },
    // Ollama (local, free)
    'llama3':   { input: 0, output: 0, currency: 'CNY' },
    'llama3.1': { input: 0, output: 0, currency: 'CNY' },
    'qwen2.5':  { input: 0, output: 0, currency: 'CNY' },
    'mistral':  { input: 0, output: 0, currency: 'CNY' },
    'gemma2':   { input: 0, output: 0, currency: 'CNY' },
    'phi3':     { input: 0, output: 0, currency: 'CNY' }
  };

  // 用户操作类型 → 中文标签（审计表 + 导出共用）
  var ACTION_LABELS = {
    'webview_navigate': '网页导航',
    'webview_detach': '会话分身',
    'api_config_change': '配置变更',
    'mode_switch': '模式切换',
    'new_conversation': '新建会话',
    'delete_conversation': '删除会话',
    'provider_switch': '切换模型商',
    'dlp_send_masked': '已发送',
    'dlp_bypass': '已发送',
    'dlp_blocked': '已阻止',
    'attach_dlp_masked': '已发送',
    'attach_dlp_skip': '已跳过',
    'attach_dlp_cancel': '已取消',
    'dlp_rule_add': '新增DLP规则',
    'dlp_rule_edit': '编辑DLP规则',
    'dlp_rule_delete': '删除DLP规则',
    'dlp_rule_reset': '恢复默认规则'
  };

  // DLP 检测记录：事件标签与样式
  var DLP_EVENT_LABELS = {
    'dlp_send_masked': '已发送',
    'dlp_bypass': '已发送',
    'dlp_blocked': '已阻止',
    'attach_dlp_masked': '已发送',
    'attach_dlp_skip': '已跳过',
    'attach_dlp_cancel': '已取消'
  };
  var DLP_EVENT_CLASSES = {
    'dlp_send_masked': 'dlp-event-bypass',
    'dlp_bypass': 'dlp-event-bypass',
    'dlp_blocked': 'dlp-event-blocked',
    'attach_dlp_masked': 'dlp-event-bypass',
    'attach_dlp_skip': 'dlp-event-blocked',
    'attach_dlp_cancel': 'dlp-event-blocked'
  };

  // ========== 状态 ==========
  // 审计日志视图状态
  var _logState = {
    api: [],          // 已加载的 API 调用日志（含 _request 关联）
    action: [],       // 已加载的用户操作日志
    filter: 'all',    // 当前筛选标签：all / api / action
    keyword: '',      // 搜索关键字
    apiPage: 1,             // API 表当前页码
    apiPageSize: PAGE_SIZE_DEFAULT,   // API 表每页条数
    actionPage: 1,          // 操作表当前页码
    actionPageSize: PAGE_SIZE_DEFAULT, // 操作表每页条数
    customRange: null       // 自定义日期范围 { start, end }，null 表示使用时间线
  };
  // DLP 检测记录视图状态
  var _dlpState = {
    list: [],
    page: 1,          // 当前页码
    pageSize: PAGE_SIZE_DEFAULT,   // 每页条数
    keyword: '',      // DLP 搜索关键字
    customRange: null // DLP 自定义日期范围 { start, end }，null 表示使用时间线
  };

  var _dlpEditIndex = -1;

  // ========== 工具函数 ==========

  function getModelPrice(modelId) {
    return MODEL_PRICING[modelId] || null;
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatFullNum(n) {
    return n.toLocaleString('en-US');
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function notify(msg) {
    if (typeof showNotification === 'function') showNotification(msg);
  }

  function debounce(fn, ms) {
    var timer = null;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function dateToStr(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function parseDateStr(str) {
    if (!str) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  function formatLogTime(ts) {
    if (!ts) return '-';
    try {
      var datePart = ts.substring(0, 10);
      var timePart = ts.substring(11, 19);
      return datePart + ' ' + timePart;
    } catch (e) {
      return ts;
    }
  }

  function escapeHtmlText(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function descByTimestamp(a, b) {
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  }

  function ascByTimestamp(a, b) {
    return (a.timestamp || '').localeCompare(b.timestamp || '');
  }

  function daysHint(days) {
    if (days <= 0) return '（全部）';
    if (days === 1) return '（近 1 天）';
    return '（近 ' + days + ' 天）';
  }

  /**
   * 计算费用
   */
  function calculateCost(byModel) {
    var usdCost = 0;
    var cnyCost = 0;
    var details = [];

    for (var i = 0; i < byModel.length; i++) {
      var m = byModel[i];
      var price = getModelPrice(m.model);
      if (!price) {
        m.cost = 0;
        m.currency = '-';
        m.costStr = '免费 / 未知';
        details.push(m);
        continue;
      }
      if (price.input === 0) {
        // 免费模型（输入输出均为 0）
        m.cost = 0;
        m.currency = '-';
        m.costStr = price.output === 0 ? '免费' : '免费 / 未知';
        details.push(m);
        continue;
      }

      var inputCost = (m.promptTokens / 1000000) * price.input;
      var outputCost = (m.completionTokens / 1000000) * price.output;
      var totalCost = inputCost + outputCost;
      m.cost = totalCost;
      m.currency = price.currency;

      if (price.currency === 'USD') {
        usdCost += totalCost;
        m.costStr = '$' + totalCost.toFixed(4);
      } else {
        cnyCost += totalCost;
        m.costStr = '¥' + totalCost.toFixed(4);
      }
      details.push(m);
    }

    return {
      usdCost: usdCost,
      cnyCost: cnyCost,
      details: details
    };
  }

  // ========== 主渲染入口 ==========

  /**
   * 渲染数据面板
   * @param {boolean} [silent] 静默刷新：不闪加载态，失败时保留旧内容兜底
   */
  function renderDataPanel(silent) {
    var loadingEl = document.getElementById('dp-loading');
    var errorEl = document.getElementById('dp-error');
    var contentEl = document.getElementById('dp-content');

    var activeBtn = document.querySelector('.dp-timeline-btn.active');
    var selectedDays = activeBtn ? parseInt(activeBtn.getAttribute('data-days'), 10) : 7;

    if (!silent) {
      if (loadingEl) loadingEl.style.display = 'flex';
      if (errorEl) errorEl.style.display = 'none';
    }
    if (contentEl) contentEl.style.display = 'none';

    Promise.all([
      TokenStats.getSummary(selectedDays),
      loadConversationCount()
    ]).then(function (results) {
      var summary = results[0];
      var convCount = results[1];

      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';
      if (errorEl) errorEl.style.display = 'none';

      // 概览卡片：无数据时显示占位符，不再隐藏整块内容
      var costData = calculateCost(summary.byModel);

      setText('dp-total-tokens', summary.totalTokens ? formatNum(summary.totalTokens) : '0');
      setText('dp-prompt-tokens', summary.totalPromptTokens ? formatNum(summary.totalPromptTokens) : '0');
      setText('dp-completion-tokens', summary.totalCompletionTokens ? formatNum(summary.totalCompletionTokens) : '0');
      setText('dp-total-calls', summary.totalCalls || '0');
      setText('dp-active-days', convCount);

      var costParts = [];
      if (costData.usdCost > 0) costParts.push('$' + costData.usdCost.toFixed(4));
      if (costData.cnyCost > 0) costParts.push('¥' + costData.cnyCost.toFixed(4));
      setText('dp-total-cost', costParts.length > 0 ? costParts.join(' + ') : '¥0.00');

      renderModelTable(costData.details);
      renderChart(summary.byModel);
      updateSectionHints(selectedDays);
      renderTrendChart(summary.records, selectedDays);

      renderAuditLogs(selectedDays);
      renderDlpLogs();
      renderDlpRules();
    }).catch(function (err) {
      console.error('[DataPanel] 加载失败:', err);
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'none';
      if (errorEl) errorEl.style.display = 'flex';
    });
  }

  /**
   * 仅刷新概览部分（卡片 / 模型表 / 对比图 / 趋势图）
   */
  function renderSummaryOnly() {
    var activeBtn = document.querySelector('.dp-timeline-btn.active');
    var days = activeBtn ? parseInt(activeBtn.getAttribute('data-days'), 10) : 7;

    TokenStats.getSummary(days).then(function (summary) {
      var costData = calculateCost(summary.byModel);

      setText('dp-total-tokens', summary.totalTokens ? formatNum(summary.totalTokens) : '0');
      setText('dp-prompt-tokens', summary.totalPromptTokens ? formatNum(summary.totalPromptTokens) : '0');
      setText('dp-completion-tokens', summary.totalCompletionTokens ? formatNum(summary.totalCompletionTokens) : '0');
      setText('dp-total-calls', summary.totalCalls || '0');

      var costParts = [];
      if (costData.usdCost > 0) costParts.push('$' + costData.usdCost.toFixed(4));
      if (costData.cnyCost > 0) costParts.push('¥' + costData.cnyCost.toFixed(4));
      setText('dp-total-cost', costParts.length > 0 ? costParts.join(' + ') : '¥0.00');

      renderModelTable(costData.details);
      renderChart(summary.byModel);
      updateSectionHints(days);
      renderTrendChart(summary.records, days);
    }).catch(function (err) {
      console.error('[DataPanel] 概览刷新失败:', err);
    });
  }

  /**
   * 仅刷新日志 / DLP / 规则部分
   */
  function renderLogsOnly() {
    renderAuditLogs();
    renderDlpLogs();
    renderDlpRules();
  }

  // ========== 概览 ==========

  function loadConversationCount() {
    return window.electron.getDataPath().then(function (dataPath) {
      var convPath = dataPath + '/ai-talk-conversations.json';
      return window.electron.readFile(convPath);
    }).then(function (raw) {
      if (raw) {
        try {
          var convs = JSON.parse(raw);
          return Array.isArray(convs) ? convs.length : 0;
        } catch (e) {
          return 0;
        }
      }
      return 0;
    }).catch(function () {
      return 0;
    });
  }

  function updateSectionHints(days) {
    var hint = daysHint(days);
    var dlpHint = document.querySelector('#dp-dlp-log-section .dp-section-hint');
    if (dlpHint) dlpHint.textContent = hint;
    var logHint = document.querySelector('#dp-log-section .dp-section-hint');
    if (logHint) logHint.textContent = days <= 0 ? '（全部记录）' : (days === 1 ? '（近 1 天记录）' : '（近 ' + days + ' 天记录）');
    var trendHint = document.getElementById('dp-trend-hint');
    if (trendHint) trendHint.textContent = hint;
  }

  function renderModelTable(details) {
    var tbody = document.getElementById('dp-model-tbody');
    if (!tbody) return;

    if (!details || details.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="dp-table-empty">暂无数据</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < details.length; i++) {
      var m = details[i];
      html += '<tr>' +
        '<td>' + escapeHtmlText(m.model) + '</td>' +
        '<td>' + escapeHtmlText(m.providerName) + '</td>' +
        '<td>' + formatFullNum(m.promptTokens) + '</td>' +
        '<td>' + formatFullNum(m.completionTokens) + '</td>' +
        '<td>' + formatFullNum(m.totalTokens) + '</td>' +
        '<td>' + m.calls + '</td>' +
        '<td>' + (m.costStr || '-') + '</td>' +
        '</tr>';
    }
    tbody.innerHTML = html;
  }

  function renderChart(byModel) {
    var chartEl = document.getElementById('dp-chart');
    if (!chartEl) return;

    if (!byModel || byModel.length === 0) {
      chartEl.innerHTML = '<div class="dp-chart-empty" id="dp-chart-empty">暂无数据</div>';
      return;
    }

    var maxTokens = 0;
    for (var i = 0; i < byModel.length; i++) {
      if (byModel[i].totalTokens > maxTokens) maxTokens = byModel[i].totalTokens;
    }
    if (maxTokens === 0) maxTokens = 1;

    var html = '<div class="dp-chart-legend">' +
      '<span><span class="dp-chart-legend-dot input"></span>输入 Tokens</span>' +
      '<span><span class="dp-chart-legend-dot output"></span>输出 Tokens</span>' +
      '</div>';

    var displayModels = byModel.slice(0, 8);
    for (var j = 0; j < displayModels.length; j++) {
      var m = displayModels[j];
      var inputPct = Math.max(1, (m.promptTokens / maxTokens) * 100);
      var outputPct = Math.max(1, (m.completionTokens / maxTokens) * 100);
      var label = m.model.length > 20 ? m.model.substring(0, 18) + '...' : m.model;

      html += '<div class="dp-chart-bar-row">' +
        '<div class="dp-chart-label" title="' + escapeHtmlText(m.model) + '">' + escapeHtmlText(label) + '</div>' +
        '<div class="dp-chart-bar-wrap">' +
          '<div class="dp-chart-bar prompt" style="width:' + inputPct + '%"></div>' +
          '<div class="dp-chart-bar completion" style="width:' + outputPct + '%"></div>' +
        '</div>' +
        '<div class="dp-chart-value">' + formatNum(m.totalTokens) + '</div>' +
        '</div>';
    }
    // 保留空态节点以便下次更新
    html += '<div class="dp-chart-empty" id="dp-chart-empty" style="display:none;">暂无数据</div>';
    chartEl.innerHTML = html;
  }

  /**
   * 用量趋势图：按天聚合 totalTokens，SVG 折线图
   */
  var _trendData = null;

  function renderTrendChart(records, days) {
    _trendData = { records: records || [], days: days };
    drawTrendChart();
  }

  function drawTrendChart() {
    var chartEl = document.getElementById('dp-trend-chart');
    if (!chartEl || !_trendData) return;
    var records = _trendData.records;
    var days = _trendData.days;

    // 按天聚合
    var dayMap = {};
    var min = days > 0 ? Date.now() - days * 86400000 : null;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r.timestamp) continue;
      if (min && r.timestamp < min) continue;
      var d = new Date(r.timestamp);
      var key = dateToStr(d);
      if (!dayMap[key]) dayMap[key] = 0;
      dayMap[key] += r.totalTokens || 0;
    }

    // 天数窗口（含零值天）：默认 30 天，自定义范围超长时仍取 30 天窗口
    var windowDays = (days > 0 && days <= 31) ? days : 30;
    var base = new Date();
    base.setHours(0, 0, 0, 0);
    var dayKeys = [];
    for (var k = windowDays - 1; k >= 0; k--) {
      var dd = new Date(base);
      dd.setDate(base.getDate() - k);
      var dk = dateToStr(dd);
      dayKeys.push(dk);
      if (!dayMap[dk]) dayMap[dk] = 0;
    }

    if (records.length === 0) {
      chartEl.innerHTML = '<div class="dp-chart-empty" id="dp-trend-empty">暂无数据</div>';
      return;
    }

    var max = 0;
    for (var m = 0; m < dayKeys.length; m++) {
      if (dayMap[dayKeys[m]] > max) max = dayMap[dayKeys[m]];
    }
    if (max === 0) max = 1;

    // SVG 坐标区
    var W = chartEl.clientWidth || 720;
    var H = 230;
    var padL = 46, padR = 14, padT = 18, padB = 26;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var n = dayKeys.length;
    var stepX = n > 1 ? plotW / (n - 1) : plotW;

    var html = '';
    html += '<svg class="dp-trend-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    html += '<defs><linearGradient id="dpTrendFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.16"/>' +
      '<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>' +
      '</linearGradient></defs>';

    // 水平网格线 + Y 轴刻度
    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + plotH - (plotH * g / gridCount);
      var val = Math.round(max * g / gridCount);
      html += '<line class="dp-trend-grid" x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '"/>';
      html += '<text class="dp-trend-y" x="' + (padL - 8) + '" y="' + (gy + 4) + '">' + formatNum(val) + '</text>';
    }

    // 计算各点坐标
    var pts = [];
    for (var j = 0; j < n; j++) {
      var v = dayMap[dayKeys[j]] || 0;
      var px = padL + stepX * j;
      var py = padT + plotH - (v / max) * plotH;
      pts.push([px, py, v]);
    }

    // 面积渐变 + 折线
    var linePts = [];
    for (var q = 0; q < pts.length; q++) linePts.push(pts[q][0] + ',' + pts[q][1]);
    html += '<polygon class="dp-trend-area" points="' + padL + ',' + (padT + plotH) + ' ' + linePts.join(' ') +
      ' ' + (padL + stepX * (n - 1)) + ',' + (padT + plotH) + '"/>';
    html += '<polyline class="dp-trend-line" points="' + linePts.join(' ') + '"/>';

    // 数据点（hover 显示日期与用量）+ X 轴日期标签（隔段显示避免拥挤）
    var labelStep = Math.max(1, Math.ceil(n / 8));
    for (var d = 0; d < n; d++) {
      var vv = pts[d][2];
      html += '<circle class="dp-trend-dot' + (vv === 0 ? ' zero' : '') + '" cx="' + pts[d][0] + '" cy="' + pts[d][1] + '" r="3.5">' +
        '<title>' + escapeHtmlText(dayKeys[d]) + ' · ' + formatFullNum(vv) + ' tokens</title>' +
        '</circle>';
      if (d % labelStep === 0 || d === n - 1) {
        html += '<text class="dp-trend-day" x="' + pts[d][0] + '" y="' + (H - 8) + '" text-anchor="middle">' +
          dayKeys[d].substring(5) + '</text>';
      }
    }

    html += '</svg>';
    html += '<div class="dp-chart-empty" id="dp-trend-empty" style="display:none;">暂无数据</div>';
    chartEl.innerHTML = html;
  }

  // 窗口尺寸变化时重绘折线图（保持宽度自适应）
  window.addEventListener('resize', debounce(function () {
    var chartEl = document.getElementById('dp-trend-chart');
    if (chartEl && chartEl.offsetParent !== null) drawTrendChart();
  }, 150));

  // ========== 审计日志 ==========

  /**
   * 获取当前视图应加载的日志范围
   * - 自定义日期范围优先
   * - 否则使用时间线按钮选择的天数
   */
  function getAuditLogsForView() {
    if (_logState.customRange) {
      return loadAuditLogsRange(_logState.customRange.start, _logState.customRange.end);
    }
    var activeBtn = document.querySelector('.dp-timeline-btn.active');
    var days = activeBtn ? parseInt(activeBtn.getAttribute('data-days'), 10) : 7;
    return loadRecentAuditLogs(days);
  }

  /**
   * 加载近 N 天的审计日志（JSONL 按天文件）
   */
  function loadRecentAuditLogs(days) {
    return window.electron.getDataPath().then(function (dataPath) {
      var logsDir = dataPath + '/audit-logs';
      var allLogs = [];
      var promises = [];

      for (var i = 0; i < days; i++) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var dateStr = dateToStr(d);
        var filePath = logsDir + '/' + dateStr + '.jsonl';

        promises.push((function (fp) {
          return window.electron.readFile(fp).then(function (raw) {
            if (raw) {
              var lines = raw.trim().split('\n');
              for (var j = 0; j < lines.length; j++) {
                try {
                  allLogs.push(JSON.parse(lines[j]));
                } catch (e) {}
              }
            }
          }).catch(function () {});
        })(filePath));
      }

      return Promise.all(promises).then(function () {
        return allLogs;
      });
    });
  }

  /**
   * 按日期范围（含首尾）逐日读取 JSONL 日志
   * @param {string} startStr YYYY-MM-DD
   * @param {string} endStr   YYYY-MM-DD
   */
  function loadAuditLogsRange(startStr, endStr) {
    var start = parseDateStr(startStr);
    var end = parseDateStr(endStr);
    if (!start || !end) return Promise.resolve([]);
    if (start > end) {
      var tmp = start;
      start = end;
      end = tmp;
    }

    return window.electron.getDataPath().then(function (dataPath) {
      var logsDir = dataPath + '/audit-logs';
      var allLogs = [];
      var promises = [];
      var cur = new Date(start);

      while (cur <= end) {
        var dateStr = dateToStr(cur);
        var filePath = logsDir + '/' + dateStr + '.jsonl';
        promises.push((function (fp) {
          return window.electron.readFile(fp).then(function (raw) {
            if (raw) {
              var lines = raw.trim().split('\n');
              for (var j = 0; j < lines.length; j++) {
                try {
                  allLogs.push(JSON.parse(lines[j]));
                } catch (e) {}
              }
            }
          }).catch(function () {});
        })(filePath));
        cur.setDate(cur.getDate() + 1);
      }

      return Promise.all(promises).then(function () {
        return allLogs;
      });
    });
  }

  /**
   * 渲染审计日志：加载 → 分类存入 _logState → 渲染表格
   */
  function renderAuditLogs(days) {
    var apiTbody = document.getElementById('dp-api-log-tbody');
    var actionTbody = document.getElementById('dp-action-log-tbody');
    if (!apiTbody && !actionTbody) return;

    getAuditLogsForView().then(function (logs) {
      logs.sort(descByTimestamp);

      // api_request 映射表：为响应/错误补齐模型、URL、内容信息
      var requestMap = {};
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].eventType === 'api_request') {
          requestMap[logs[i].eventId] = logs[i];
        }
      }

      // 分类：API 只收集响应/错误事件；用户操作全部收集
      var apiLogs = [];
      var actionLogs = [];
      for (var j = 0; j < logs.length; j++) {
        var log = logs[j];
        if (log.eventType === 'user_action') {
          actionLogs.push(log);
        } else if (log.eventType === 'api_response' || log.eventType === 'api_error') {
          log._request = requestMap[log.requestEventId] || null;
          apiLogs.push(log);
        }
      }

      _logState.api = apiLogs;
      _logState.action = actionLogs;
      _logState.apiPage = 1;
      _logState.actionPage = 1;

      renderLogTables();
      bindLogTabs();
    }).catch(function () {
      if (apiTbody) apiTbody.innerHTML = '<tr><td colspan="7" class="dp-table-empty">日志加载失败</td></tr>';
      if (actionTbody) actionTbody.innerHTML = '<tr><td colspan="3" class="dp-table-empty">日志加载失败</td></tr>';
    });
  }

  /**
   * 按当前筛选标签渲染两个日志表 + 控制显隐
   */
  function renderLogTables() {
    var apiTbody = document.getElementById('dp-api-log-tbody');
    var actionTbody = document.getElementById('dp-action-log-tbody');
    var filter = _logState.filter;
    var showApi = (filter === 'all' || filter === 'api');
    var showAction = (filter === 'all' || filter === 'action');

    if (apiTbody) renderApiTable(apiTbody);
    if (actionTbody) renderActionTable(actionTbody);

    var apiWrap = document.getElementById('dp-api-log-wrap');
    var actionWrap = document.getElementById('dp-action-log-wrap');
    if (apiWrap) apiWrap.style.display = showApi ? '' : 'none';
    if (actionWrap) actionWrap.style.display = showAction ? '' : 'none';
  }

  function apiMatches(log) {
    var kw = _logState.keyword.toLowerCase();
    if (!kw) return true;
    var req = log._request || {};
    var hay = [
      (req.provider && req.provider.name) || '',
      (req.provider && req.provider.model) || '',
      (req.outbound && req.outbound.endpoint) || '',
      (req.outbound && req.outbound.userContent) || '',
      (log.result && log.result.status) || '',
      (log.result && log.result.aiContent) || ''
    ].join(' ').toLowerCase();
    return hay.indexOf(kw) !== -1;
  }

  function renderApiTable(tbody) {
    var keyword = _logState.keyword.toLowerCase();
    var list = _logState.api;
    if (keyword) list = list.filter(apiMatches);

    var total = list.length;
    var pageSize = _logState.apiPageSize;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(_logState.apiPage, pageCount);
    _logState.apiPage = page;
    var start = (page - 1) * pageSize;
    var visible = list.slice(start, start + pageSize);

    var html = '';
    for (var j = 0; j < visible.length; j++) {
      html += apiRowHtml(visible[j]);
    }
    tbody.innerHTML = html ||
      '<tr><td colspan="7" class="dp-table-empty">' + (keyword ? '未找到匹配的 API 记录' : '暂无 API 调用记录') + '</td></tr>';

    updatePagination('api', total, page, pageCount);
  }

  function apiRowHtml(log) {
    var req = log._request;
    var timeStr = formatLogTime(log.timestamp);

    var providerName = (req && req.provider && req.provider.name) || '-';
    var modelName = (req && req.provider && req.provider.model) || '-';
    var modelCell = providerName !== '-' ? providerName + ' · ' + modelName : '-';

    var endpoint = (req && req.outbound && req.outbound.endpoint) || '-';
    var endpointDisplay = endpoint !== '-' && endpoint.length > 50
      ? '<span title="' + escapeHtmlText(endpoint) + '">' + escapeHtmlText(endpoint.substring(0, 47)) + '...</span>'
      : escapeHtmlText(endpoint);

    var result = log.result || {};
    var status = result.status || 'unknown';
    var statusTag = '<span class="dp-status-tag ' +
      (status === 'success' ? 'success' : status === 'aborted' ? 'aborted' : 'error') +
      '">' + status + '</span>';

    var tokenStr = '-';
    var tokenTitle = '';
    if (log.usage && log.usage.totalTokens) {
      var promptT = formatNum(log.usage.promptTokens || 0);
      var compT = formatNum(log.usage.completionTokens || 0);
      var totalT = formatNum(log.usage.totalTokens);
      tokenStr = totalT +
        ' <span style="font-size:11px;color:#94a3b8">(' + promptT + '入/' + compT + '出)</span>';
      tokenTitle = totalT + ' (' + promptT + '入/' + compT + '出)';
    }

    var duration = result.durationMs
      ? (result.durationMs >= 1000 ? (result.durationMs / 1000).toFixed(1) + 's' : result.durationMs + 'ms')
      : '-';

    var userContent = (req && req.outbound && req.outbound.userContent) || '';
    var aiContent = (log.result && log.result.aiContent) || '';
    var contentHtml = '';
    if (userContent || aiContent) {
      if (userContent) {
        var ucDisplay = userContent.length > 80
          ? '<span class="dp-content-user" title="' + escapeHtmlText(userContent) + '">' + escapeHtmlText(userContent.substring(0, 77)) + '...</span>'
          : '<span class="dp-content-user">' + escapeHtmlText(userContent) + '</span>';
        contentHtml += '<div class="dp-content-row">' + ucDisplay + '</div>';
      }
      if (aiContent) {
        var acDisplay = aiContent.length > 80
          ? '<span class="dp-content-ai" title="' + escapeHtmlText(aiContent) + '">' + escapeHtmlText(aiContent.substring(0, 77)) + '...</span>'
          : '<span class="dp-content-ai">' + escapeHtmlText(aiContent) + '</span>';
        contentHtml += '<div class="dp-content-row">' + acDisplay + '</div>';
      }
    } else {
      contentHtml = '-';
    }

    return '<tr>' +
      '<td>' + timeStr + '</td>' +
      '<td title="' + escapeHtmlText(modelCell) + '">' + escapeHtmlText(modelCell) + '</td>' +
      '<td title="' + escapeHtmlText(endpoint) + '">' + endpointDisplay + '</td>' +
      '<td>' + statusTag + '</td>' +
      '<td' + (tokenTitle ? ' title="' + tokenTitle + '"' : '') + '>' + tokenStr + '</td>' +
      '<td>' + duration + '</td>' +
      '<td class="dp-content-cell">' + contentHtml + '</td>' +
      '</tr>';
  }

  function actionMatches(log) {
    var kw = _logState.keyword.toLowerCase();
    if (!kw) return true;
    var hay = ((ACTION_LABELS[log.action] || log.action || '') + ' ' + (log.detail || '')).toLowerCase();
    return hay.indexOf(kw) !== -1;
  }

  function renderActionTable(tbody) {
    var keyword = _logState.keyword.toLowerCase();
    var list = _logState.action;
    if (keyword) list = list.filter(actionMatches);

    var total = list.length;
    var pageSize = _logState.actionPageSize;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(_logState.actionPage, pageCount);
    _logState.actionPage = page;
    var start = (page - 1) * pageSize;
    var visible = list.slice(start, start + pageSize);

    var html = '';
    for (var k = 0; k < visible.length; k++) {
      html += actionRowHtml(visible[k]);
    }
    tbody.innerHTML = html ||
      '<tr><td colspan="3" class="dp-table-empty">' + (keyword ? '未找到匹配的操作记录' : '暂无操作记录') + '</td></tr>';

    updatePagination('action', total, page, pageCount);
  }

  function actionRowHtml(alog) {
    var aTimeStr = formatLogTime(alog.timestamp);
    var aType = ACTION_LABELS[alog.action] || alog.action || '用户操作';

    var detailHtml = escapeHtmlText(alog.detail || '-');
    try {
      var detailObj = JSON.parse(alog.detail);
      if (detailObj.url) {
        detailHtml = '<span class="dp-url-detail" title="' + escapeHtmlText(detailObj.url) + '">' + escapeHtmlText(detailObj.url) + '</span>';
      } else if (detailObj.providerId) {
        detailHtml = '<span class="dp-detail-text">' + escapeHtmlText(detailObj.providerId) + ' · ' + escapeHtmlText(detailObj.change || '') + '</span>';
      } else {
        detailHtml = '<span class="dp-detail-text">' + escapeHtmlText(alog.detail) + '</span>';
      }
    } catch (e) {}

    return '<tr>' +
      '<td>' + aTimeStr + '</td>' +
      '<td>' + aType + '</td>' +
      '<td>' + detailHtml + '</td>' +
      '</tr>';
  }

  /**
   * 绑定日志筛选标签（克隆替换避免重复监听）
   */
  function bindLogTabs() {
    var tabs = document.querySelectorAll('#dp-log-tabs .dp-log-tab');
    if (!tabs.length) return;

    tabs.forEach(function (tab) {
      var newTab = tab.cloneNode(true);
      tab.parentNode.replaceChild(newTab, tab);
    });

    var allTabs = document.querySelectorAll('#dp-log-tabs .dp-log-tab');
    allTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var filter = this.getAttribute('data-filter');
        _logState.filter = filter;
        _logState.apiPage = 1;
        _logState.actionPage = 1;
        _dlpState.page = 1;
        allTabs.forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        renderLogTables();
      });
    });
  }

  /**
   * 获取 DLP 记录当前视图应加载的日志范围
   * - 自定义日期范围优先（与审计日志的日期范围功能一致）
   * - 否则使用时间线按钮选择的天数
   */
  function getDlpLogsForView() {
    if (_dlpState.customRange) {
      return loadAuditLogsRange(_dlpState.customRange.start, _dlpState.customRange.end);
    }
    var activeBtn = document.querySelector('.dp-timeline-btn.active');
    var days = activeBtn ? parseInt(activeBtn.getAttribute('data-days'), 10) : 7;
    return loadRecentAuditLogs(days);
  }

  // ========== DLP 检测记录 ==========

  function renderDlpLogs() {
    var tbody = document.getElementById('dp-dlp-log-tbody');
    if (!tbody) return;

    getDlpLogsForView().then(function (logs) {
      var dlpLogs = [];
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].eventType === 'user_action' && DLP_EVENT_LABELS[logs[i].action]) {
          dlpLogs.push(logs[i]);
        }
      }
      dlpLogs.sort(descByTimestamp);

      _dlpState.list = dlpLogs;
      _dlpState.page = 1;
      renderDlpTable();
    }).catch(function () {
      tbody.innerHTML = '<tr><td colspan="5" class="dp-table-empty">日志加载失败</td></tr>';
    });
  }

  function renderDlpTable() {
    var tbody = document.getElementById('dp-dlp-log-tbody');
    if (!tbody) return;

    var keyword = _dlpState.keyword.toLowerCase();
    var list = _dlpState.list;
    if (keyword) {
      list = list.filter(function (log) {
        var hay = ((DLP_EVENT_LABELS[log.action] || log.action || '') + ' ' + (log.detail || '')).toLowerCase();
        return hay.indexOf(keyword) !== -1;
      });
    }

    var total = list.length;
    var pageSize = _dlpState.pageSize;
    var pageCount = Math.max(1, Math.ceil(total / pageSize));
    var page = Math.min(_dlpState.page, pageCount);
    _dlpState.page = page;
    var start = (page - 1) * pageSize;
    var visible = list.slice(start, start + pageSize);

    var html = '';
    for (var j = 0; j < visible.length; j++) {
      html += dlpRowHtml(visible[j]);
    }
    tbody.innerHTML = html ||
      '<tr><td colspan="5" class="dp-table-empty">' + (keyword ? '未找到匹配的 DLP 记录' : '暂无 DLP 检测记录') + '</td></tr>';

    updatePagination('dlp', total, page, pageCount);
  }

  function dlpRowHtml(log) {
    var timeStr = formatLogTime(log.timestamp);
    var label = DLP_EVENT_LABELS[log.action] || log.action;
    var cls = DLP_EVENT_CLASSES[log.action] || '';
    var typesHtml = '-';
    var hitHtml = '-';
    var sentHtml = '-';
    try {
      var detail = JSON.parse(log.detail || '{}');
      if (detail.hits && detail.hits.length > 0) {
        // 简化格式：命中类型 + 命中内容（title 悬浮查看完整内容）
        typesHtml = detail.hits.map(function (h) {
          return '<span class="dlp-log-type-tag" title="' + escapeHtmlText(h.type) + '">' + escapeHtmlText(h.type) + '</span>';
        }).join('<br>');
        hitHtml = detail.hits.map(function (h) {
          return '<code class="dlp-hit-value" title="' + escapeHtmlText(h.content || '') + '">' + escapeHtmlText(h.content || '') + '</code>';
        }).join('<br>');
        if (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel') {
          sentHtml = '<span class="dlp-log-nosend">未发送</span>';
        } else {
          // 已发送内容列展示真实发送内容：sent 为实际发送形态（删除误检项按原值明文、保留项为掩码值），旧日志回退 masked/content
          sentHtml = detail.hits.map(function (h) {
            var sentValue = h.sent || h.masked || h.content || '';
            return '<code class="dlp-hit-value" title="' + escapeHtmlText(sentValue) + '">' + escapeHtmlText(sentValue) + '</code>';
          }).join('<br>');
        }
      } else if (detail.items && detail.items.length > 0) {
        typesHtml = detail.items.map(function (it) {
          var name = it.file ? it.file + ' · ' + it.name : it.name;
          var isHigh = it.severity === 'high';
          var sevName = isHigh ? '高风险' : '中风险';
          return '<span class="dlp-log-type-tag' + (isHigh ? ' dlp-hit-high' : ' dlp-hit-medium') + '" title="' +
            escapeHtmlText(name) + '（' + sevName + '）">' + escapeHtmlText(name) + '</span>';
        }).join('<br>');
        hitHtml = detail.items.map(function (it) {
          var hitValue = it.value || it.masked || '';
          return '<code class="dlp-hit-value" title="' + escapeHtmlText(hitValue) + '">' + escapeHtmlText(hitValue) + '</code>';
        }).join('<br>');
        if (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel') {
          sentHtml = '<span class="dlp-log-nosend">未发送</span>';
        } else {
          sentHtml = detail.items.map(function (it) {
            var hitValue = it.value || it.masked || '';
            var sentValue = (log.action === 'dlp_send_masked' || log.action === 'attach_dlp_masked') ? (it.masked || hitValue) : hitValue;
            return '<code class="dlp-hit-value" title="' + escapeHtmlText(sentValue) + '">' + escapeHtmlText(sentValue) + '</code>';
          }).join('<br>');
        }
      } else if (detail.types && detail.types.length > 0) {
        typesHtml = detail.types.map(function (t) {
          return '<span class="dlp-log-type-tag" title="' + escapeHtmlText(t) + '">' + escapeHtmlText(t) + '</span>';
        }).join(' ');
        hitHtml = escapeHtmlText(log.detail);
        sentHtml = log.action === 'dlp_blocked' ? '<span class="dlp-log-nosend">未发送</span>' : escapeHtmlText(log.detail);
      } else if (typeof log.detail === 'string' && log.detail) {
        typesHtml = escapeHtmlText(log.detail);
      }
    } catch (e) {
      typesHtml = escapeHtmlText(log.detail || '-');
    }
    return '<tr>' +
      '<td>' + timeStr + '</td>' +
      '<td><span class="dp-dlp-event-tag ' + cls + '">' + label + '</span></td>' +
      '<td>' + typesHtml + '</td>' +
      '<td>' + hitHtml + '</td>' +
      '<td>' + sentHtml + '</td>' +
      '</tr>';
  }

  // ========== DLP 规则管理 ==========

  function renderDlpRules() {
    var listEl = document.getElementById('dp-dlp-rules-list');
    if (!listEl) return;

    var rules;
    try {
      rules = SensitiveDataChecker.getRuleConfigs();
    } catch (e) {
      listEl.innerHTML = '<div class="dp-dlp-rules-empty">规则模块未加载</div>';
      return;
    }

    if (!rules || rules.length === 0) {
      listEl.innerHTML = '<div class="dp-dlp-rules-empty">暂无规则，点击 "+ 新增" 添加</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      var sevClass = r.severity === 'high' ? 'dp-dlp-sev-high' : 'dp-dlp-sev-medium';
      var sevLabel = r.severity === 'high' ? '高风险' : '中风险';
      var maskDesc = r.fullMask ? '完全隐藏' : r.emailMask ? '邮箱专用' : '保留前' + (r.showFirst || 0) + '后' + (r.showLast || 0);
      var patternPreview = r.pattern.length > 60 ? r.pattern.substring(0, 57) + '...' : r.pattern;

      html += '<div class="dp-dlp-rule-item">' +
        '<div class="dp-dlp-rule-info">' +
          '<div class="dp-dlp-rule-name">' + escapeHtmlText(r.name) + '</div>' +
          '<div class="dp-dlp-rule-detail">' +
            '<span class="dp-dlp-sev-tag ' + sevClass + '">' + sevLabel + '</span>' +
            '<span class="dp-dlp-rule-pattern" title="' + escapeHtmlText(r.pattern) + '">' + escapeHtmlText(patternPreview) + '</span>' +
            '<span class="dp-dlp-rule-mask-desc">脱敏：' + maskDesc + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="dp-dlp-rule-actions">' +
          '<button class="dp-dlp-rule-edit-btn" data-idx="' + i + '" title="编辑">&#9998;</button>' +
          '<button class="dp-dlp-rule-del-btn" data-idx="' + i + '" title="删除">&times;</button>' +
        '</div>' +
      '</div>';
    }
    listEl.innerHTML = html;
  }

  function openDlpRuleModal(index) {
    _dlpEditIndex = index;
    var overlay = document.getElementById('dlp-rule-modal-overlay');
    var titleEl = document.getElementById('dlp-rule-modal-title');
    if (!overlay) return;

    if (index >= 0) {
      titleEl.textContent = '编辑规则';
      var rules = SensitiveDataChecker.getRuleConfigs();
      var r = rules[index];
      document.getElementById('dlp-rule-name').value = r.name || '';
      document.getElementById('dlp-rule-severity').value = r.severity || 'medium';
      document.getElementById('dlp-rule-pattern').value = r.pattern || '';
      if (r.fullMask) {
        document.getElementById('dlp-rule-mask-type').value = 'full';
      } else if (r.emailMask) {
        document.getElementById('dlp-rule-mask-type').value = 'email';
      } else {
        document.getElementById('dlp-rule-mask-type').value = 'prefixSuffix';
      }
      document.getElementById('dlp-rule-show-first').value = (typeof r.showFirst === 'number') ? r.showFirst : 3;
      document.getElementById('dlp-rule-show-last').value = (typeof r.showLast === 'number') ? r.showLast : 4;
    } else {
      titleEl.textContent = '新增规则';
      document.getElementById('dlp-rule-name').value = '';
      document.getElementById('dlp-rule-severity').value = 'medium';
      document.getElementById('dlp-rule-pattern').value = '';
      document.getElementById('dlp-rule-mask-type').value = 'prefixSuffix';
      document.getElementById('dlp-rule-show-first').value = 3;
      document.getElementById('dlp-rule-show-last').value = 4;
    }
    // 清空上一次测试结果
    var testResult = document.getElementById('dlp-rule-test-result');
    if (testResult) testResult.innerHTML = '';
    var testText = document.getElementById('dlp-rule-test-text');
    if (testText) testText.value = '';

    toggleMaskFields();
    overlay.style.display = 'flex';
  }

  function closeDlpRuleModal() {
    var overlay = document.getElementById('dlp-rule-modal-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function toggleMaskFields() {
    var typeEl = document.getElementById('dlp-rule-mask-type');
    if (!typeEl) return;
    var type = typeEl.value;
    var psEl = document.getElementById('dlp-rule-mask-ps');
    if (psEl) {
      psEl.style.display = type === 'prefixSuffix' ? 'flex' : 'none';
    }
  }

  /**
   * DLP 规则测试：验证正则 + 统计命中 + 高亮预览
   */
  function runDlpRuleTest() {
    var patternEl = document.getElementById('dlp-rule-pattern');
    var textEl = document.getElementById('dlp-rule-test-text');
    var resultEl = document.getElementById('dlp-rule-test-result');
    if (!resultEl) return;

    var pattern = (patternEl && patternEl.value.trim()) || '';
    var text = (textEl && textEl.value) || '';

    if (!pattern) {
      resultEl.innerHTML = '<span class="fail">请先输入正则表达式</span>';
      return;
    }
    var re;
    try {
      re = new RegExp(pattern, 'g');
    } catch (err) {
      resultEl.innerHTML = '<span class="fail">正则无效：' + escapeHtmlText(err.message) + '</span>';
      return;
    }
    if (!text) {
      resultEl.innerHTML = '<span class="fail">请输入测试文本</span>';
      return;
    }

    // 统计命中（guard 限制防止灾难性回溯导致卡死）
    var matches = [];
    var m;
    var guard = 0;
    while ((m = re.exec(text)) !== null && guard < 500) {
      matches.push(m[0]);
      guard++;
      if (m.index === re.lastIndex) re.lastIndex++;
    }

    if (matches.length === 0) {
      resultEl.innerHTML = '<span class="fail">未命中任何内容</span>';
      return;
    }

    // 高亮预览
    var safeRe;
    try {
      safeRe = new RegExp(re.source, 'g');
    } catch (err) {
      safeRe = null;
    }
    var preview = escapeHtmlText(text);
    if (safeRe) {
      preview = preview.replace(safeRe, function (hit) { return '<mark>' + hit + '</mark>'; });
    }

    resultEl.innerHTML = '<span class="ok">命中 ' + matches.length + ' 处</span>' +
      '<div class="dp-test-preview">' + preview + '</div>';
  }

  /**
   * 保存 DLP 规则（新增 / 编辑）
   */
  function saveDlpRule() {
    var name = document.getElementById('dlp-rule-name').value.trim();
    if (!name) { notify('请输入规则名称'); return; }
    var pattern = document.getElementById('dlp-rule-pattern').value.trim();
    if (!pattern) { notify('请输入正则表达式'); return; }
    try { new RegExp(pattern); } catch (err) { notify('正则表达式无效: ' + err.message); return; }

    var maskType = document.getElementById('dlp-rule-mask-type').value;
    var cfg = {
      name: name,
      severity: document.getElementById('dlp-rule-severity').value,
      pattern: pattern,
      fullMask: maskType === 'full',
      emailMask: maskType === 'email',
      showFirst: parseInt(document.getElementById('dlp-rule-show-first').value, 10) || 0,
      showLast: parseInt(document.getElementById('dlp-rule-show-last').value, 10) || 0
    };

    if (_dlpEditIndex >= 0) {
      SensitiveDataChecker.updateRule(_dlpEditIndex, cfg);
      AuditLog.logUserAction({ action: 'dlp_rule_edit', detail: '编辑规则: ' + name });
    } else {
      SensitiveDataChecker.addRule(cfg);
      AuditLog.logUserAction({ action: 'dlp_rule_add', detail: '新增规则: ' + name });
    }
    closeDlpRuleModal();
    renderDlpRules();
  }

  /**
   * 删除 DLP 规则（带确认）
   */
  function deleteDlpRule(idx) {
    var rules = SensitiveDataChecker.getRuleConfigs();
    var ruleName = (rules && rules[idx] && rules[idx].name) ? rules[idx].name : ('规则 #' + idx);
    showConfirmDialog('删除 DLP 规则', '确定删除规则「' + ruleName + '」吗？此操作不可恢复。', '删除').then(function (ok) {
      if (!ok) return;
      SensitiveDataChecker.removeRule(idx);
      AuditLog.logUserAction({ action: 'dlp_rule_delete', detail: '删除规则: ' + ruleName });
      renderDlpRules();
    });
  }

  /**
   * 恢复默认 DLP 规则（带确认）
   */
  function resetDlpRules() {
    showConfirmDialog('恢复默认规则', '确定恢复为默认 DLP 规则吗？自定义规则将全部丢失。', '恢复默认').then(function (ok) {
      if (!ok) return;
      SensitiveDataChecker.resetToDefaults();
      AuditLog.logUserAction({ action: 'dlp_rule_reset', detail: '恢复默认规则' });
      renderDlpRules();
    });
  }

  // ========== 导出（Excel xls / CSV） ==========

  function getExportFormat(selectId) {
    var sel = document.getElementById(selectId);
    return sel && sel.value ? sel.value : 'xls';
  }

  function setExportBtnText(btn, text, disabled) {
    if (btn) {
      btn.textContent = text;
      btn.disabled = !!disabled;
    }
  }

  /**
   * 解析操作详情的纯文本（导出用）
   */
  function formatActionDetailForExport(actLog) {
    var detail = actLog.detail;
    if (!detail) return '';
    try {
      var obj = JSON.parse(detail);
      if (obj.url) return obj.url;
      if (obj.providerId) return obj.providerId + (obj.change ? ' · ' + obj.change : '');
      return detail;
    } catch (e) {
      return detail;
    }
  }

  /**
   * 将行数组转为 CSV（带 BOM，UTF-8，Excel 可直接打开）
   */
  function toCsv(rows) {
    var csv = '\ufeff';
    for (var i = 0; i < rows.length; i++) {
      var cells = rows[i];
      var line = [];
      for (var j = 0; j < cells.length; j++) {
        var s = String(cells[j] == null ? '' : cells[j]);
        if (/[",\n\r]/.test(s)) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        line.push(s);
      }
      csv += line.join(',') + '\r\n';
    }
    return csv;
  }

  /**
   * 构建审计日志 CSV 内容
   */
  function buildAuditCsv(apiLogs, actionLogs, filter) {
    var rows = [];

    if (filter === 'all' || filter === 'api') {
      if (apiLogs.length > 0) {
        if (filter === 'all') rows.push(['【API 调用记录】']);
        rows.push(['时间', '模型商', '模型', '请求URL', '状态', 'HTTP状态码',
          '输入Token', '输出Token', '总Token', '耗时(ms)', '用户发送内容', 'AI回复内容']);
        for (var i = 0; i < apiLogs.length; i++) {
          var log = apiLogs[i];
          var req = log._request || {};
          var result = log.result || {};
          var usage = log.usage || {};
          rows.push([
            log.timestamp || '',
            (req.provider && req.provider.name) || '',
            (req.provider && req.provider.model) || '',
            (req.outbound && req.outbound.endpoint) || '',
            result.status || '',
            result.httpStatus != null ? result.httpStatus : '',
            usage.promptTokens != null ? usage.promptTokens : '',
            usage.completionTokens != null ? usage.completionTokens : '',
            usage.totalTokens != null ? usage.totalTokens : '',
            result.durationMs != null ? result.durationMs : '',
            (req.outbound && req.outbound.userContent) || '',
            result.aiContent || ''
          ]);
        }
        if (filter === 'all') rows.push([]);
      }
    }

    if (filter === 'all' || filter === 'action') {
      if (actionLogs.length > 0) {
        if (filter === 'all') rows.push(['【用户操作记录】']);
        rows.push(['时间', '操作类型', '详情']);
        for (var k = 0; k < actionLogs.length; k++) {
          var actLog = actionLogs[k];
          rows.push([
            actLog.timestamp || '',
            ACTION_LABELS[actLog.action] || actLog.action || '',
            formatActionDetailForExport(actLog)
          ]);
        }
      }
    }

    return toCsv(rows);
  }

  /**
   * 构建 DLP 记录 CSV 内容
   */
  function buildDlpCsv(dlpLogs) {
    var rows = [['时间', '事件', '命中类型', '命中内容', '已发送内容']];
    for (var i = 0; i < dlpLogs.length; i++) {
      var log = dlpLogs[i];
      var label = DLP_EVENT_LABELS[log.action] || log.action || '';
      var typesText = '';
      var hitText = '';
      var sentText = '';

      try {
        var detail = JSON.parse(log.detail || '{}');
        if (detail.hits && detail.hits.length > 0) {
          // 简化格式：命中类型 + 命中内容，已发送内容为真实发送的掩码值
          typesText = detail.hits.map(function (h) { return h.type; }).join('; ');
          hitText = detail.hits.map(function (h) { return h.content || ''; }).join('\n');
          sentText = (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel')
            ? '未发送'
            : detail.hits.map(function (h) { return h.sent || h.masked || h.content || ''; }).join('\n');
        } else if (detail.items && detail.items.length > 0) {
          typesText = detail.items.map(function (it) { return (it.file ? it.file + ' · ' : '') + it.name; }).join('; ');
          hitText = detail.items.map(function (it) { return it.value || it.masked || ''; }).join('\n');
          if (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel') {
            sentText = '未发送';
          } else {
            sentText = detail.items.map(function (it) {
              var hv = it.value || it.masked || '';
              return (log.action === 'dlp_send_masked' || log.action === 'attach_dlp_masked') ? (it.masked || hv) : hv;
            }).join('\n');
          }
        } else if (detail.types && detail.types.length > 0) {
          typesText = detail.types.join('; ');
          hitText = log.detail || '';
          sentText = log.action === 'dlp_blocked' ? '未发送' : (log.detail || '');
        } else if (typeof log.detail === 'string') {
          typesText = log.detail;
        }
      } catch (e) {
        typesText = log.detail || '';
      }

      rows.push([log.timestamp || '', label, typesText, hitText, sentText]);
    }
    return toCsv(rows);
  }

  /**
   * HTML 实体转义 + td 包裹（xls 导出）
   */
  function escTd(val) {
    var s = String(val == null ? '' : val);
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return '<td>' + s + '</td>';
  }

  /**
   * 构建 Excel 兼容的 HTML .xls 内容
   */
  function buildExportHtml(apiLogs, actionLogs, filter) {
    var parts = [];

    parts.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">');
    parts.push('<head><meta charset="UTF-8">');
    parts.push('<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->');
    parts.push('<style>');
    parts.push('  table { border-collapse: collapse; }');
    parts.push('  th { font-weight: bold; font-family: 宋体, SimSun; font-size: 12pt; background: #C0C0C0; border: 1px solid #000000; padding: 8px 10px; text-align: left; white-space: normal; word-wrap: break-word; }');
    parts.push('  td { font-family: Calibri, 宋体, SimSun; font-size: 11pt; border: 1px solid #000000; padding: 6px 10px; vertical-align: top; white-space: normal; word-wrap: break-word; }');
    parts.push('  .section-title { font-family: 宋体, SimSun; font-size: 14pt; font-weight: 700; margin: 20px 0 10px 0; }');
    parts.push('</style></head><body>');

    if (filter === 'all' || filter === 'api') {
      if (apiLogs.length > 0) {
        if (filter === 'all') {
          parts.push('<div class="section-title">API 调用记录</div>');
        }
        parts.push('<table>');
        parts.push('<tr>');
        parts.push('<th>时间</th><th>模型商</th><th>模型</th><th>请求URL</th><th>状态</th><th>HTTP状态码</th>');
        parts.push('<th>用户发送内容</th><th>AI回复内容</th>');
        parts.push('<th>输入Token</th><th>输出Token</th><th>总Token</th><th>耗时(ms)</th>');
        parts.push('</tr>');

        for (var i = 0; i < apiLogs.length; i++) {
          var log = apiLogs[i];
          var req = log._request || {};
          var result = log.result || {};
          var usage = log.usage || {};
          parts.push('<tr>');
          parts.push(escTd(log.timestamp || ''));
          parts.push(escTd((req.provider && req.provider.name) || ''));
          parts.push(escTd((req.provider && req.provider.model) || ''));
          parts.push(escTd((req.outbound && req.outbound.endpoint) || ''));
          parts.push(escTd(result.status || ''));
          parts.push(escTd(result.httpStatus != null ? String(result.httpStatus) : ''));
          parts.push(escTd((req.outbound && req.outbound.userContent) || ''));
          parts.push(escTd(result.aiContent || ''));
          parts.push(escTd(usage.promptTokens != null ? usage.promptTokens : ''));
          parts.push(escTd(usage.completionTokens != null ? usage.completionTokens : ''));
          parts.push(escTd(usage.totalTokens != null ? usage.totalTokens : ''));
          parts.push(escTd(result.durationMs != null ? String(result.durationMs) : ''));
          parts.push('</tr>');
        }
        parts.push('</table>');
      } else if (filter === 'api') {
        parts.push('<div class="section-title">暂无 API 调用记录</div>');
      }
    }

    if (filter === 'all' || filter === 'action') {
      if (actionLogs.length > 0) {
        if (filter === 'all') {
          parts.push('<div class="section-title">用户操作记录</div>');
        }
        parts.push('<table>');
        parts.push('<tr>');
        parts.push('<th>时间</th><th>操作类型</th><th>详情</th>');
        parts.push('</tr>');

        for (var k = 0; k < actionLogs.length; k++) {
          var actLog = actionLogs[k];
          parts.push('<tr>');
          parts.push(escTd(actLog.timestamp || ''));
          parts.push(escTd(ACTION_LABELS[actLog.action] || actLog.action || ''));
          parts.push(escTd(formatActionDetailForExport(actLog)));
          parts.push('</tr>');
        }
        parts.push('</table>');
      } else if (filter === 'action') {
        parts.push('<div class="section-title">暂无用户操作记录</div>');
      }
    }

    parts.push('</body></html>');
    return parts.join('\n');
  }

  /**
   * 构建 DLP 检测记录 Excel 兼容 HTML .xls 内容
   */
  function buildDlpExportHtml(dlpLogs) {
    var parts = [];
    parts.push('<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">');
    parts.push('<head><meta charset="UTF-8">');
    parts.push('<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>DLP检测记录</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->');
    parts.push('<style>');
    parts.push('  table { border-collapse: collapse; }');
    parts.push('  th { font-weight: bold; font-family: 宋体, SimSun; font-size: 12pt; background: #C0C0C0; border: 1px solid #000000; padding: 8px 10px; text-align: left; white-space: normal; word-wrap: break-word; }');
    parts.push('  td { font-family: Calibri, 宋体, SimSun; font-size: 11pt; border: 1px solid #000000; padding: 6px 10px; vertical-align: top; white-space: normal; word-wrap: break-word; }');
    parts.push('  .section-title { font-family: 宋体, SimSun; font-size: 14pt; font-weight: 700; margin: 20px 0 10px 0; }');
    parts.push('</style></head><body>');
    parts.push('<div class="section-title">DLP 检测记录</div>');
    parts.push('<table>');
    parts.push('<tr><th>时间</th><th>事件</th><th>命中类型</th><th>命中内容</th><th>已发送内容</th></tr>');

    for (var i = 0; i < dlpLogs.length; i++) {
      var log = dlpLogs[i];
      var label = DLP_EVENT_LABELS[log.action] || log.action || '';
      var typesText = '';
      var hitText = '';
      var sentText = '';

      try {
        var detail = JSON.parse(log.detail || '{}');
        if (detail.hits && detail.hits.length > 0) {
          // 简化格式：命中类型 + 命中内容，已发送内容为真实发送的掩码值
          typesText = detail.hits.map(function (h) { return h.type; }).join('; ');
          hitText = detail.hits.map(function (h) { return h.content || ''; }).join('\n');
          sentText = (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel')
            ? '未发送'
            : detail.hits.map(function (h) { return h.sent || h.masked || h.content || ''; }).join('\n');
        } else if (detail.items && detail.items.length > 0) {
          typesText = detail.items.map(function (it) { return (it.file ? it.file + ' · ' : '') + it.name; }).join('; ');
          hitText = detail.items.map(function (it) { return it.value || it.masked || ''; }).join('\n');
          if (log.action === 'dlp_blocked' || log.action === 'attach_dlp_skip' || log.action === 'attach_dlp_cancel') {
            sentText = '未发送';
          } else {
            sentText = detail.items.map(function (it) {
              var hv = it.value || it.masked || '';
              return (log.action === 'dlp_send_masked' || log.action === 'attach_dlp_masked') ? (it.masked || hv) : hv;
            }).join('\n');
          }
        } else if (detail.types && detail.types.length > 0) {
          typesText = detail.types.join('; ');
          hitText = log.detail || '';
          sentText = log.action === 'dlp_blocked' ? '未发送' : (log.detail || '');
        } else if (typeof log.detail === 'string') {
          typesText = log.detail;
        }
      } catch (e) {
        typesText = log.detail || '';
      }

      parts.push('<tr>');
      parts.push(escTd(log.timestamp || ''));
      parts.push(escTd(label));
      parts.push(escTd(typesText));
      parts.push(escTd(hitText));
      parts.push(escTd(sentText));
      parts.push('</tr>');
    }

    parts.push('</table>');
    parts.push('</body></html>');
    return parts.join('\n');
  }

  /**
   * 导出审计日志：范围与当前视图一致，支持 xls / csv
   */
  function exportAuditLogs() {
    var btn = document.getElementById('dp-export-btn');
    setExportBtnText(btn, '导出中...', true);
    var format = getExportFormat('dp-format-select');
    var filter = _logState.filter || 'all';

    getAuditLogsForView().then(function (logs) {
      if (!logs || logs.length === 0) {
        notify('暂无日志数据可导出');
        setExportBtnText(btn, '导出', false);
        return;
      }

      logs.sort(ascByTimestamp);

      var requestMap = {};
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].eventType === 'api_request') {
          requestMap[logs[i].eventId] = logs[i];
        }
      }

      var apiLogs = [];
      var actionLogs = [];
      for (var j = 0; j < logs.length; j++) {
        var log = logs[j];
        if (log.eventType === 'api_response' || log.eventType === 'api_error') {
          log._request = requestMap[log.requestEventId] || null;
          apiLogs.push(log);
        } else if (log.eventType === 'user_action') {
          actionLogs.push(log);
        }
      }

      var content = (format === 'csv')
        ? buildAuditCsv(apiLogs, actionLogs, filter)
        : buildExportHtml(apiLogs, actionLogs, filter);

      window.electron.exportAuditLog(content, filter, format).then(function (result) {
        setExportBtnText(btn, '导出', false);
        if (result.success) {
          notify('日志已导出成功！\n' + result.filePath);
        } else if (!result.canceled) {
          notify('导出失败：' + (result.error || '未知错误'));
        }
      }).catch(function (err) {
        setExportBtnText(btn, '导出', false);
        notify('导出失败：' + err.message);
      });
    }).catch(function (err) {
      setExportBtnText(btn, '导出', false);
      notify('加载日志失败：' + err.message);
    });
  }

  /**
   * 导出 DLP 检测记录：范围与当前视图一致，支持 xls / csv
   */
  function exportDlpLogs() {
    var btn = document.getElementById('dp-dlp-export-btn');
    setExportBtnText(btn, '导出中...', true);
    var format = getExportFormat('dp-dlp-format-select');

    getDlpLogsForView().then(function (logs) {
      if (!logs || logs.length === 0) {
        notify('暂无 DLP 日志数据可导出');
        setExportBtnText(btn, '导出', false);
        return;
      }

      var dlpLogs = [];
      for (var i = 0; i < logs.length; i++) {
        if (logs[i].eventType === 'user_action' && DLP_EVENT_LABELS[logs[i].action]) {
          dlpLogs.push(logs[i]);
        }
      }

      if (dlpLogs.length === 0) {
        notify('暂无 DLP 日志数据可导出');
        setExportBtnText(btn, '导出', false);
        return;
      }

      dlpLogs.sort(ascByTimestamp);

      var content = (format === 'csv')
        ? buildDlpCsv(dlpLogs)
        : buildDlpExportHtml(dlpLogs);

      window.electron.exportDlpLog(content, format).then(function (result) {
        setExportBtnText(btn, '导出', false);
        if (result.success) {
          notify('DLP 日志已导出成功！\n' + result.filePath);
        } else if (!result.canceled) {
          notify('导出失败：' + (result.error || '未知错误'));
        }
      }).catch(function (err) {
        setExportBtnText(btn, '导出', false);
        notify('导出失败：' + err.message);
      });
    }).catch(function (err) {
      setExportBtnText(btn, '导出', false);
      notify('加载日志失败：' + err.message);
    });
  }

  // ========== 使用报告导出 ==========

  /**
   * 导出使用报告（统计概览 / 模型用量明细 / 模型用量对比 / 用量趋势）
   */
  function exportUsageReport() {
    var btn = document.getElementById('dp-report-btn');
    setExportBtnText(btn, '生成中...', true);

    var activeBtn = document.querySelector('.dp-timeline-btn.active');
    var days = activeBtn ? parseInt(activeBtn.getAttribute('data-days'), 10) : 7;

    Promise.all([TokenStats.getSummary(days), loadConversationCount()]).then(function (results) {
      var summary = results[0];
      var convCount = results[1];
      var costData = calculateCost(summary.byModel || []);
      var html = buildReportHtml(summary, convCount, days, costData);

      window.electron.exportReport(html).then(function (result) {
        setExportBtnText(btn, '导出报告', false);
        if (result.success) {
          notify('报告已导出成功！\n' + result.filePath);
        } else if (!result.canceled) {
          notify('导出失败：' + (result.error || '未知错误'));
        }
      }).catch(function (err) {
        setExportBtnText(btn, '导出报告', false);
        notify('导出失败：' + err.message);
      });
    }).catch(function (err) {
      setExportBtnText(btn, '导出报告', false);
      notify('生成报告失败：' + err.message);
    });
  }

  /**
   * 构建自包含 HTML 使用报告
   */
  function buildReportHtml(summary, convCount, days, costData) {
    var esc = escapeHtmlText;
    var p = [];
    p.push('<!DOCTYPE html>');
    p.push('<html lang="zh-CN"><head><meta charset="UTF-8"><title>数据面板使用报告</title><style>');
    p.push('body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;margin:0;padding:32px;background:#f8fafc;color:#1e293b;}');
    p.push('.wrap{max-width:960px;margin:0 auto;}');
    p.push('h1{font-size:22px;margin:0 0 4px;}');
    p.push('.meta{color:#94a3b8;font-size:13px;margin-bottom:28px;}');
    p.push('h2{font-size:16px;margin:32px 0 12px;padding-left:10px;border-left:3px solid #3b82f6;}');
    p.push('.cards{display:flex;flex-wrap:wrap;gap:12px;}');
    p.push('.card{flex:1;min-width:150px;background:#fff;border:1px solid #edf1f5;border-radius:10px;padding:14px 16px;}');
    p.push('.card .lbl{font-size:11px;color:#94a3b8;letter-spacing:.5px;}');
    p.push('.card .val{font-size:20px;font-weight:700;margin-top:6px;}');
    p.push('.card .sub{font-size:11px;color:#94a3b8;margin-top:4px;}');
    p.push('table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #edf1f5;border-radius:10px;overflow:hidden;font-size:13px;}');
    p.push('th{background:#f8fafc;text-align:left;padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #edf1f5;}');
    p.push('td{padding:10px 14px;border-bottom:1px solid #f1f5f9;}');
    p.push('tr:last-child td{border-bottom:none;}');
    p.push('.empty{text-align:center;color:#94a3b8;padding:24px;}');
    p.push('.bar-row{display:flex;align-items:center;margin-bottom:10px;gap:12px;}');
    p.push('.bar-lbl{width:160px;font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}');
    p.push('.bar-bg{flex:1;height:22px;background:#f1f5f9;border-radius:6px;overflow:hidden;}');
    p.push('.bar-fill{height:100%;background:linear-gradient(90deg,#93c5fd,#3b82f6);border-radius:6px;}');
    p.push('.bar-val{width:70px;text-align:right;font-size:11px;color:#64748b;}');
    p.push('</style></head><body><div class="wrap">');

    var now = new Date();
    var pad2 = function (n) { return ('0' + n).slice(-2); };
    var timeStr = dateToStr(now) + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
    var rangeHint = daysHint(days);

    p.push('<h1>数据面板使用报告</h1>');
    p.push('<div class="meta">生成时间：' + esc(timeStr) + '　·　统计范围：' + esc(rangeHint) + '</div>');

    // 一、统计概览
    p.push('<h2>一、统计概览</h2><div class="cards">');
    var totalTokens = summary.totalTokens || 0;
    var costParts = [];
    if (costData.usdCost > 0) costParts.push('$' + costData.usdCost.toFixed(4));
    if (costData.cnyCost > 0) costParts.push('¥' + costData.cnyCost.toFixed(4));
    p.push(reportCardHtml('总 Token 用量', formatNum(totalTokens),
      '输入 ' + formatNum(summary.totalPromptTokens || 0) + ' / 输出 ' + formatNum(summary.totalCompletionTokens || 0)));
    p.push(reportCardHtml('预估费用', costParts.length > 0 ? costParts.join(' + ') : '¥0.00', '基于内置定价表估算，仅供参考'));
    p.push(reportCardHtml('API 调用次数', (summary.totalCalls || 0) + '', '请求次数'));
    p.push(reportCardHtml('会话数', (convCount || 0) + '', '历史会话总数'));
    p.push('</div>');

    // 二、模型用量明细
    p.push('<h2>二、模型用量明细</h2>');
    p.push('<table><thead><tr><th>模型</th><th>提供商</th><th>输入 Tokens</th><th>输出 Tokens</th><th>总计 Tokens</th><th>调用次数</th><th>预估费用</th></tr></thead><tbody>');
    if (!costData.details || costData.details.length === 0) {
      p.push('<tr><td colspan="7" class="empty">暂无数据</td></tr>');
    } else {
      for (var i = 0; i < costData.details.length; i++) {
        var m = costData.details[i];
        p.push('<tr><td>' + esc(m.model) + '</td><td>' + esc(m.providerName || '-') + '</td>' +
          '<td>' + formatFullNum(m.promptTokens) + '</td><td>' + formatFullNum(m.completionTokens) + '</td>' +
          '<td>' + formatFullNum(m.totalTokens) + '</td><td>' + (m.calls || 0) + '</td><td>' + (m.costStr || '-') + '</td></tr>');
      }
    }
    p.push('</tbody></table>');

    // 三、模型用量对比
    p.push('<h2>三、模型用量对比</h2>');
    var details = costData.details || [];
    var maxT = 0;
    for (var b = 0; b < details.length; b++) {
      if (details[b].totalTokens > maxT) maxT = details[b].totalTokens;
    }
    if (maxT === 0) maxT = 1;
    if (details.length === 0) {
      p.push('<div class="empty">暂无数据</div>');
    } else {
      for (var c = 0; c < details.length; c++) {
        var mm = details[c];
        var pct = Math.max(2, Math.round((mm.totalTokens / maxT) * 100));
        p.push('<div class="bar-row"><div class="bar-lbl" title="' + esc(mm.model) + '">' + esc(mm.model) + '</div>' +
          '<div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="bar-val">' + formatNum(mm.totalTokens) + '</div></div>');
      }
    }

    // 四、用量趋势
    p.push('<h2>四、用量趋势</h2>');
    p.push(buildReportTrendSvg(summary.records || [], days));

    p.push('</div></body></html>');
    return p.join('\n');
  }

  function reportCardHtml(label, value, sub) {
    return '<div class="card"><div class="lbl">' + escapeHtmlText(label) + '</div>' +
      '<div class="val">' + value + '</div><div class="sub">' + escapeHtmlText(sub) + '</div></div>';
  }

  /**
   * 报告内用量趋势 SVG 折线图（固定宽度，供独立 HTML 报告使用）
   */
  function buildReportTrendSvg(records, days) {
    if (!records || records.length === 0) return '<div class="empty">暂无数据</div>';

    var dayMap = {};
    var min = days > 0 ? Date.now() - days * 86400000 : null;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!r.timestamp) continue;
      if (min && r.timestamp < min) continue;
      var key = dateToStr(new Date(r.timestamp));
      if (!dayMap[key]) dayMap[key] = 0;
      dayMap[key] += r.totalTokens || 0;
    }

    var windowDays = (days > 0 && days <= 31) ? days : 30;
    var base = new Date();
    base.setHours(0, 0, 0, 0);
    var dayKeys = [];
    for (var k = windowDays - 1; k >= 0; k--) {
      var dd = new Date(base);
      dd.setDate(base.getDate() - k);
      var dk = dateToStr(dd);
      dayKeys.push(dk);
      if (!dayMap[dk]) dayMap[dk] = 0;
    }

    var max = 0;
    for (var m = 0; m < dayKeys.length; m++) {
      if (dayMap[dayKeys[m]] > max) max = dayMap[dayKeys[m]];
    }
    if (max === 0) max = 1;

    var W = 900, H = 260;
    var padL = 46, padR = 14, padT = 18, padB = 26;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;
    var n = dayKeys.length;
    var stepX = n > 1 ? plotW / (n - 1) : plotW;

    var html = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    html += '<defs><linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#3b82f6" stop-opacity="0.16"/>' +
      '<stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>' +
      '</linearGradient></defs>';

    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var gy = padT + plotH - (plotH * g / gridCount);
      var val = Math.round(max * g / gridCount);
      html += '<line x1="' + padL + '" y1="' + gy + '" x2="' + (W - padR) + '" y2="' + gy + '" stroke="#f1f5f9" stroke-width="1"/>';
      html += '<text x="' + (padL - 8) + '" y="' + (gy + 4) + '" fill="#94a3b8" font-size="10" text-anchor="end">' + formatNum(val) + '</text>';
    }

    var pts = [];
    for (var j = 0; j < n; j++) {
      var v = dayMap[dayKeys[j]] || 0;
      var px = padL + stepX * j;
      var py = padT + plotH - (v / max) * plotH;
      pts.push([px, py, v]);
    }

    var linePts = [];
    for (var q = 0; q < pts.length; q++) linePts.push(pts[q][0] + ',' + pts[q][1]);
    html += '<polygon points="' + padL + ',' + (padT + plotH) + ' ' + linePts.join(' ') +
      ' ' + (padL + stepX * (n - 1)) + ',' + (padT + plotH) + '" fill="url(#reportFill)"/>';
    html += '<polyline points="' + linePts.join(' ') + '" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

    var labelStep = Math.max(1, Math.ceil(n / 8));
    for (var d = 0; d < n; d++) {
      var vv = pts[d][2];
      html += '<circle cx="' + pts[d][0] + '" cy="' + pts[d][1] + '" r="3.5" fill="#ffffff" stroke="#3b82f6" stroke-width="2">' +
        '<title>' + escapeHtmlText(dayKeys[d]) + ' · ' + formatFullNum(vv) + ' tokens</title></circle>';
      if (d % labelStep === 0 || d === n - 1) {
        html += '<text x="' + pts[d][0] + '" y="' + (H - 8) + '" fill="#94a3b8" font-size="10" text-anchor="middle">' +
          dayKeys[d].substring(5) + '</text>';
      }
    }

    html += '</svg>';
    return html;
  }

  // ========== 导航 / 工具栏 / 数据管理 ==========

  /**
   * 应用审计日志自定义日期范围
   */
  function applyDateRange() {
    var startEl = document.getElementById('dp-date-start');
    var endEl = document.getElementById('dp-date-end');
    var start = startEl ? startEl.value : '';
    var end = endEl ? endEl.value : '';
    if (!start || !end) {
      notify('请选择完整的开始和结束日期');
      return;
    }
    if (start > end) {
      notify('开始日期不能晚于结束日期');
      return;
    }
    _logState.customRange = { start: start, end: end };
    renderAuditLogs();
  }

  /**
   * 清除审计日志自定义日期范围，回到时间线模式
   */
  function resetDateRange() {
    _logState.customRange = null;
    var startEl = document.getElementById('dp-date-start');
    var endEl = document.getElementById('dp-date-end');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    renderAuditLogs();
  }

  /**
   * 应用 DLP 检测记录自定义日期范围
   */
  function applyDlpDateRange() {
    var startEl = document.getElementById('dp-dlp-date-start');
    var endEl = document.getElementById('dp-dlp-date-end');
    var start = startEl ? startEl.value : '';
    var end = endEl ? endEl.value : '';
    if (!start || !end) {
      notify('请选择完整的开始和结束日期');
      return;
    }
    if (start > end) {
      notify('开始日期不能晚于结束日期');
      return;
    }
    _dlpState.customRange = { start: start, end: end };
    renderDlpLogs();
  }

  /**
   * 清除 DLP 检测记录自定义日期范围，回到时间线模式
   */
  function resetDlpDateRange() {
    _dlpState.customRange = null;
    var startEl = document.getElementById('dp-dlp-date-start');
    var endEl = document.getElementById('dp-dlp-date-end');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';
    renderDlpLogs();
  }

  /**
   * 审计日志搜索输入（防抖）：重算关键字并重置分页
   */
  var _onSearchInput = debounce(function () {
    var input = document.getElementById('dp-search');
    _logState.keyword = (input && input.value) || '';
    _logState.apiPage = 1;
    _logState.actionPage = 1;
    renderLogTables();
  }, 250);

  /**
   * DLP 搜索输入（防抖）：重算关键字并重置分页
   */
  var _onDlpSearchInput = debounce(function () {
    var input = document.getElementById('dp-dlp-search');
    _dlpState.keyword = (input && input.value) || '';
    _dlpState.page = 1;
    renderDlpTable();
  }, 250);

  /**
   * 更新某列表的分页控件
   * @param {string} target api / action / dlp
   */
  function updatePagination(target, total, page, pageCount) {
    var wrap = document.getElementById('dp-' + target + '-pagination');
    if (!wrap) return;
    wrap.style.display = total > 0 ? '' : 'none';

    var totalEl = document.getElementById('dp-' + target + '-total');
    if (totalEl) totalEl.textContent = total;

    var pageEl = document.getElementById('dp-' + target + '-page-info');
    if (pageEl) pageEl.textContent = '第 ' + page + ' / ' + pageCount + ' 页';

    var prevBtn = wrap.querySelector('.dp-pg-btn[data-dir="prev"]');
    var nextBtn = wrap.querySelector('.dp-pg-btn[data-dir="next"]');
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= pageCount;
  }

  /**
   * 上一页 / 下一页（渲染函数内部会自动钳制页码范围）
   */
  function handlePagination(target, dir) {
    var step = dir === 'prev' ? -1 : 1;
    if (target === 'api') {
      _logState.apiPage += step;
      renderApiTable(document.getElementById('dp-api-log-tbody'));
    } else if (target === 'action') {
      _logState.actionPage += step;
      renderActionTable(document.getElementById('dp-action-log-tbody'));
    } else if (target === 'dlp') {
      _dlpState.page += step;
      renderDlpTable();
    }
  }

  /**
   * 修改每页条数：重置到第一页并重渲染
   */
  function handlePageSizeChange(target, size) {
    if (target === 'api') {
      _logState.apiPageSize = size;
      _logState.apiPage = 1;
      renderApiTable(document.getElementById('dp-api-log-tbody'));
    } else if (target === 'action') {
      _logState.actionPageSize = size;
      _logState.actionPage = 1;
      renderActionTable(document.getElementById('dp-action-log-tbody'));
    } else if (target === 'dlp') {
      _dlpState.pageSize = size;
      _dlpState.page = 1;
      renderDlpTable();
    }
  }

  // ========== 数据管理 ==========

  /**
   * 通用确认弹窗：返回 Promise<boolean>
   */
  function showConfirmDialog(title, message, confirmText) {
    return new Promise(function (resolve) {
      var overlay = document.getElementById('dp-confirm-overlay');
      if (!overlay) {
        resolve(window.confirm(message));
        return;
      }
      var titleEl = document.getElementById('dp-confirm-title');
      var msgEl = document.getElementById('dp-confirm-message');
      var okBtn = document.getElementById('dp-confirm-ok-btn');
      var cancelBtn = document.getElementById('dp-confirm-cancel-btn');
      var closeBtn = document.getElementById('dp-confirm-close-btn');

      if (titleEl) titleEl.textContent = title || '操作确认';
      if (msgEl) msgEl.textContent = message || '';
      if (okBtn) okBtn.textContent = confirmText || '确认';

      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        overlay.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onBackdrop);
        resolve(result);
      }
      function onOk() { finish(true); }
      function onCancel() { finish(false); }
      function onBackdrop(e) {
        if (e.target === overlay) onCancel();
      }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onBackdrop);
      overlay.style.display = 'flex';
    });
  }

  /**
   * 破坏性操作二次确认：连续确认两次，第二次明确提示不可恢复
   */
  function confirmDestructive(title, message, secondMessage, confirmText, onConfirm) {
    showConfirmDialog(title, message, confirmText).then(function (ok) {
      if (!ok) return;
      showConfirmDialog(title, secondMessage, confirmText).then(function (ok2) {
        if (ok2) onConfirm();
      });
    });
  }

  function clearTokenStats() {
    confirmDestructive(
      '清空用量统计',
      '确定要清空「用量统计」吗？',
      '再次确认：清空后所有 Token 用量记录将永久删除，无法恢复。',
      '确认清空',
      function () {
        if (!TokenStats.clearStats) { notify('统计模块未提供清空能力'); return; }
        TokenStats.clearStats().then(function () {
          notify('用量统计已清空');
          renderDataPanel(true);
        }).catch(function (err) {
          notify('清空失败：' + err.message);
        });
      }
    );
  }

  function clearAuditLogsData() {
    confirmDestructive(
      '清空审计日志',
      '确定要清空「审计日志」吗？',
      '再次确认：清空后所有审计日志将永久删除，无法恢复。',
      '确认清空',
      function () {
        window.electron.clearAuditLogs().then(function (res) {
          notify(res && res.success ? '审计日志已清空' : '清空失败');
          renderDataPanel(true);
        }).catch(function (err) {
          notify('清空失败：' + err.message);
        });
      }
    );
  }

  function clearAllData() {
    confirmDestructive(
      '清空全部数据',
      '确定要清空「全部数据」吗？统计数据与日志都将被删除。',
      '再次确认：全部统计数据与日志将永久删除，无法恢复。',
      '确认清空',
      function () {
        var p1 = (typeof TokenStats.clearStats === 'function') ? TokenStats.clearStats() : Promise.resolve();
        var p2 = window.electron.clearAuditLogs();
        Promise.all([p1, p2]).then(function () {
          notify('全部数据已清空');
          renderDataPanel(true);
        }).catch(function (err) {
          notify('清空失败：' + err.message);
        });
      }
    );
  }

  // ========== 数据文件管理：打开数据目录 / 导出 / 导入 ==========

  /**
   * 在系统文件管理器中打开程序数据目录
   */
  function openDataDir() {
    window.electron.openDataDir().then(function (res) {
      if (res && !res.success) notify('打开数据目录失败：' + (res.error || '未知错误'));
    }).catch(function (err) {
      notify('打开数据目录失败：' + err.message);
    });
  }

  /**
   * 导出全部本地数据（备份 / 迁移）
   */
  function exportDataFiles() {
    var btn = document.getElementById('dp-export-data-btn');
    var oldText = btn ? btn.textContent : '';
    if (btn) { btn.textContent = '导出中...'; btn.disabled = true; }

    window.electron.exportDataFiles().then(function (res) {
      if (btn) { btn.textContent = oldText; btn.disabled = false; }
      if (res && res.success) {
        notify('数据已导出成功！\n' + res.targetPath);
      } else if (res && !res.canceled) {
        notify('导出失败：' + (res.error || '未知错误'));
      }
    }).catch(function (err) {
      if (btn) { btn.textContent = oldText; btn.disabled = false; }
      notify('导出失败：' + err.message);
    });
  }

  /**
   * 导入数据（覆盖当前本地数据，双重确认）
   */
  function importDataFiles() {
    confirmDestructive(
      '导入数据',
      '确定要导入数据吗？导入会用备份中的文件覆盖当前本地数据。',
      '再次确认：导入将覆盖当前全部本地数据（会话、统计、日志、配置、技能），建议先导出备份。',
      '继续导入',
      function () {
        window.electron.importDataFiles().then(function (res) {
          if (res && res.success) {
            notify('数据导入成功！可点击右上角刷新查看最新数据。');
            renderDataPanel(true);
          } else if (res && !res.canceled) {
            notify('导入失败：' + (res.error || '未知错误'));
          }
        }).catch(function (err) {
          notify('导入失败：' + err.message);
        });
      }
    );
  }

  // ========== 事件绑定（事件委托，面板动态加载） ==========

  document.addEventListener('click', function (e) {
    var target = e.target;

    // 时间线选择
    var tlBtn = target.closest ? target.closest('.dp-timeline-btn') : null;
    if (tlBtn) {
      var allBtns = document.querySelectorAll('.dp-timeline-btn');
      allBtns.forEach(function (b) { b.classList.remove('active'); });
      tlBtn.classList.add('active');
      renderDataPanel();
      return;
    }

    // 刷新
    if (target.id === 'dp-refresh-btn' || (target.closest && target.closest('#dp-refresh-btn'))) {
      renderDataPanel(true);
      return;
    }

    // 错误重试
    if (target.id === 'dp-retry-btn' || (target.closest && target.closest('#dp-retry-btn'))) {
      renderDataPanel();
      return;
    }

    // 审计导出
    if (target.id === 'dp-export-btn' || (target.closest && target.closest('#dp-export-btn'))) {
      e.preventDefault();
      exportAuditLogs();
      return;
    }

    // DLP 导出
    if (target.id === 'dp-dlp-export-btn' || (target.closest && target.closest('#dp-dlp-export-btn'))) {
      e.preventDefault();
      exportDlpLogs();
      return;
    }

    // 日期范围（审计日志）
    if (target.id === 'dp-date-apply' || (target.closest && target.closest('#dp-date-apply'))) {
      applyDateRange();
      return;
    }
    if (target.id === 'dp-date-reset' || (target.closest && target.closest('#dp-date-reset'))) {
      resetDateRange();
      return;
    }

    // 日期范围（DLP 检测记录）
    if (target.id === 'dp-dlp-date-apply' || (target.closest && target.closest('#dp-dlp-date-apply'))) {
      applyDlpDateRange();
      return;
    }
    if (target.id === 'dp-dlp-date-reset' || (target.closest && target.closest('#dp-dlp-date-reset'))) {
      resetDlpDateRange();
      return;
    }

    // 列表分页：上一页 / 下一页
    var pgBtn = target.closest ? target.closest('.dp-pg-btn') : null;
    if (pgBtn) {
      handlePagination(pgBtn.getAttribute('data-pg'), pgBtn.getAttribute('data-dir'));
      return;
    }

    // DLP 规则：新增 / 编辑 / 删除 / 恢复默认
    if (target.id === 'dp-dlp-add-btn' || (target.closest && target.closest('#dp-dlp-add-btn'))) {
      openDlpRuleModal(-1);
      return;
    }
    var editBtn = target.closest ? target.closest('.dp-dlp-rule-edit-btn') : null;
    if (editBtn) {
      openDlpRuleModal(parseInt(editBtn.getAttribute('data-idx'), 10));
      return;
    }
    var delBtn = target.closest ? target.closest('.dp-dlp-rule-del-btn') : null;
    if (delBtn) {
      deleteDlpRule(parseInt(delBtn.getAttribute('data-idx'), 10));
      return;
    }
    if (target.id === 'dp-dlp-reset-btn' || (target.closest && target.closest('#dp-dlp-reset-btn'))) {
      resetDlpRules();
      return;
    }

    // DLP 规则弹窗
    if (target.id === 'dlp-rule-save-btn' || (target.closest && target.closest('#dlp-rule-save-btn'))) {
      saveDlpRule();
      return;
    }
    if (target.id === 'dlp-rule-cancel-btn' || target.id === 'dlp-rule-modal-close-btn' ||
        (target.closest && (target.closest('#dlp-rule-cancel-btn') || target.closest('#dlp-rule-modal-close-btn')))) {
      closeDlpRuleModal();
      return;
    }
    if (target.id === 'dlp-rule-test-btn' || (target.closest && target.closest('#dlp-rule-test-btn'))) {
      runDlpRuleTest();
      return;
    }

    // 数据管理
    if (target.id === 'dp-open-data-dir-btn' || (target.closest && target.closest('#dp-open-data-dir-btn'))) {
      openDataDir();
      return;
    }
    if (target.id === 'dp-export-data-btn' || (target.closest && target.closest('#dp-export-data-btn'))) {
      exportDataFiles();
      return;
    }
    if (target.id === 'dp-import-data-btn' || (target.closest && target.closest('#dp-import-data-btn'))) {
      importDataFiles();
      return;
    }
    if (target.id === 'dp-report-btn' || (target.closest && target.closest('#dp-report-btn'))) {
      exportUsageReport();
      return;
    }
    if (target.id === 'dp-clear-stats-btn' || (target.closest && target.closest('#dp-clear-stats-btn'))) {
      clearTokenStats();
      return;
    }
    if (target.id === 'dp-clear-audit-btn' || (target.closest && target.closest('#dp-clear-audit-btn'))) {
      clearAuditLogsData();
      return;
    }
    if (target.id === 'dp-clear-all-btn' || (target.closest && target.closest('#dp-clear-all-btn'))) {
      clearAllData();
      return;
    }
  });

  // 脱敏方式切换 / 每页条数修改
  document.addEventListener('change', function (e) {
    if (e.target.id === 'dlp-rule-mask-type') {
      toggleMaskFields();
      return;
    }
    var pgSel = e.target.closest ? e.target.closest('.dp-pg-size-select') : null;
    if (pgSel) {
      handlePageSizeChange(pgSel.getAttribute('data-pg'), parseInt(pgSel.value, 10));
    }
  });

  // 搜索输入（防抖）
  document.addEventListener('input', function (e) {
    if (e.target.id === 'dp-search') {
      _onSearchInput();
    } else if (e.target.id === 'dp-dlp-search') {
      _onDlpSearchInput();
    }
  });

  // ========== 暴露方法给全局 ==========

  window.DataPanel = {
    render: renderDataPanel,
    renderDataPanel: renderDataPanel,
    renderSummaryOnly: renderSummaryOnly,
    renderLogsOnly: renderLogsOnly,
    exportAuditLogs: exportAuditLogs,
    exportDlpLogs: exportDlpLogs,
    clearData: clearAllData
  };
})();