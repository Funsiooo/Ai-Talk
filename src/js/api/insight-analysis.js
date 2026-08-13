/**
 * 用户画像分析模块（Insight Analyzer）
 * 供「用户画像分析」技能（id: user-insight）使用：
 * - 读取本地全部会话，按时段（今日/本周/整体）聚合统计
 * - 调用当前配置的模型生成画像分析报告（提问习惯/关注点/提问方向/改进建议/注意问题）
 * - 生成自包含 HTML 报告，并支持导出（复用 export-report IPC）
 *
 * 数据来源：ai-talk-conversations.json（ChatManager）、Token 统计、审计日志
 */
(function () {
  'use strict';

  var INSIGHT_SKILL_ID = 'user-insight';

  var MAX_QUESTION_SAMPLES = 60;      // 提供给模型的提问样本上限
  var MAX_SINGLE_QUESTION_LEN = 200;  // 单条提问截断长度
  var MAX_TOPIC_HINTS = 20;           // 会话主题/记忆摘要提示上限

  // 高频词过滤：中文停用字（包含即跳过该双字组合）
  var CJK_STOP = /的|了|是|在|我|你|他|她|它|我们|你们|这个|那个|一个|什么|怎么|如何|为什么|请|帮我|可以|能不能|一下|如果|但是|因为|所以|然后|还有|以及|关于|对于|通过|使用|没有|不是|就是|都|也|很|最|比较|还是|或者|需要|应该|有没有|是否|吗|呢|啊|吧|哈|哦|嗯|自己|我们|你们|他们|事情|东西|问题|时候|现在|这里|那里|这样|那样/;
  var EN_STOP = {
    the: 1, a: 1, an: 1, and: 1, or: 1, of: 1, to: 1, in: 1, on: 1, for: 1,
    with: 1, is: 1, are: 1, was: 1, were: 1, be: 1, been: 1, at: 1, by: 1,
    from: 1, it: 1, its: 1, this: 1, that: 1, these: 1, those: 1, i: 1, you: 1,
    my: 1, your: 1, we: 1, our: 1, they: 1, their: 1, as: 1, but: 1, not: 1,
    do: 1, does: 1, did: 1, can: 1, could: 1, will: 1, would: 1, should: 1,
    have: 1, has: 1, had: 1, if: 1, than: 1, then: 1, so: 1, just: 1, what: 1,
    which: 1, who: 1, whom: 1, when: 1, where: 1, why: 1, how: 1, all: 1,
    any: 1, some: 1, more: 1, most: 1, into: 1, about: 1, up: 1, out: 1,
    please: 1, help: 1, need: 1, want: 1, get: 1, make: 1, use: 1, using: 1
  };

  // ===== 基础工具 =====
  function pad2(n) { return ('0' + n).slice(-2); }

  function dateToStr(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function nowTimeStr() {
    var d = new Date();
    return dateToStr(d.getTime()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatNum(n) {
    if (n === null || n === undefined) return '0';
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // ===== 时段解析 =====
  function parsePeriod(text) {
    var t = text || '';
    if (/今日|今天|今日内|今天内/.test(t)) return 'today';
    if (/本周|这周|本周内|这周内|这周|周内/.test(t)) return 'week';
    return 'all';
  }

  function periodLabel(period) {
    if (period === 'today') return '今日';
    if (period === 'week') return '本周';
    return '整体';
  }

  // Token 统计口径（近似，不参与时段过滤主口径）
  function tokenDays(period) {
    if (period === 'today') return 1;  // 近 24 小时
    if (period === 'week') return 7;   // 近 7 天
    return 0;                          // 全部
  }

  function periodRange(period) {
    var now = new Date();
    var start = null;
    if (period === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    } else if (period === 'week') {
      // 本周一 00:00 起
      var day = now.getDay() || 7;
      var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
      start = monday.getTime();
    }
    return start;
  }

  // ===== 统计聚合 =====
  function collectStats(period) {
    var startTs = periodRange(period);
    return window.ChatManager._loadConversations().then(function (convs) {
      convs = convs || [];

      var convsInRange = [];
      var hourBuckets = [];
      var activeDays = {};
      var questions = [];
      var totalLen = 0;
      var maxLen = 0;
      var topicHints = [];

      for (var i = 0; i < 24; i++) hourBuckets.push(0);

      for (var ci = 0; ci < convs.length; ci++) {
        var c = convs[ci];
        if (!c || !c.messages || c.messages.length === 0) continue;
        var ts = c.updatedAt || c.createdAt || 0;
        if (startTs !== null && ts < startTs) continue;
        convsInRange.push(c);
      }

      // 会话按最近活跃时间降序，提问样本取最近
      convsInRange.sort(function (a, b) {
        return ((b.updatedAt || b.createdAt || 0)) - ((a.updatedAt || a.createdAt || 0));
      });

      for (var ci2 = 0; ci2 < convsInRange.length; ci2++) {
        var c = convsInRange[ci2];
        var ts = c.updatedAt || c.createdAt || 0;

        // 活跃时段（按会话最近活跃时间的小时）
        var h = new Date(ts).getHours();
        hourBuckets[h] = (hourBuckets[h] || 0) + 1;
        activeDays[dateToStr(ts)] = true;

        // 提问样本
        for (var mi = 0; mi < c.messages.length; mi++) {
          var m = c.messages[mi];
          if (!m || m.role !== 'user') continue;
          var q = cleanQuestion(m.content);
          if (!q) continue;
          questions.push({ text: q, convTitle: c.title || '新会话' });
          var len = q.length;
          totalLen += len;
          if (len > maxLen) maxLen = len;
        }

        // 会话主题与记忆摘要
        var hint = '「' + (c.title || '新会话') + '」(' + dateToStr(ts) + ')';
        if (c.memory && c.memory.summary) {
          var sum = String(c.memory.summary).replace(/\s+/g, ' ').trim();
          if (sum.length > 120) sum = sum.substring(0, 120) + '…';
          hint += '：' + sum;
        } else {
          hint += '（' + c.messages.length + ' 条消息，无记忆摘要）';
        }
        topicHints.push(hint);
      }

      // 高频关键词
      var freq = computeWordFreq(questions);

      // Token 用量统计
      var days = tokenDays(period);
      return window.TokenStats.getSummary(days).then(function (ts) {
        var byModel = [];
        var modelMap = ts.byModel || {};
        var keys = Object.keys(modelMap);
        for (var ki = 0; ki < keys.length; ki++) {
          var m2 = modelMap[keys[ki]];
          byModel.push({
            providerName: m2.providerName || '',
            model: m2.model || keys[ki],
            totalTokens: m2.totalTokens || 0,
            promptTokens: m2.promptTokens || 0,
            completionTokens: m2.completionTokens || 0,
            calls: m2.calls || 0
          });
        }
        byModel.sort(function (a, b) { return b.totalTokens - a.totalTokens; });

        // 提问样本：最近优先（会话已按 updatedAt 降序收集）
        var samples = questions.slice(0, MAX_QUESTION_SAMPLES).map(function (q, idx) {
          var text = q.text;
          if (text.length > MAX_SINGLE_QUESTION_LEN) {
            text = text.substring(0, MAX_SINGLE_QUESTION_LEN) + '…';
          }
          return text;
        });

        return {
          period: period,
          periodLabel: periodLabel(period),
          startTs: startTs,
          convCount: convsInRange.length,
          questionCount: questions.length,
          activeDays: Object.keys(activeDays).length,
          avgQuestionLen: questions.length ? Math.round(totalLen / questions.length) : 0,
          maxQuestionLen: maxLen,
          hourBuckets: hourBuckets,
          wordFreq: freq.slice(0, 12),
          topicHints: topicHints.slice(0, MAX_TOPIC_HINTS),
          questionSamples: samples,
          tokenTotal: ts.totalTokens || 0,
          tokenCalls: ts.totalCalls || 0,
          tokenDaysLabel: days > 0 ? '近' + days + '天' : '全部',
          byModel: byModel
        };
      });
    });
  }

  function cleanQuestion(raw) {
    if (!raw) return '';
    var s = String(raw)
      .replace(/【附件引用】[\s\S]*$/, '')
      .replace(/\r/g, '')
      .replace(/^\s+|\s+$/g, '');
    if (!s) return '';
    s = s.replace(/\n{3,}/g, '\n\n');
    return s;
  }

  // 轻量高频词统计：英文单词 + 中文双字组合
  function computeWordFreq(questions) {
    var text = '';
    for (var i = 0; i < questions.length; i++) {
      text += questions[i].text + '\n';
    }
    if (!text) return [];
    var freq = {};
    var m;

    var enRe = /[a-zA-Z][a-zA-Z0-9_+#.\-]{1,}/g;
    while ((m = enRe.exec(text)) !== null) {
      var w = m[0].toLowerCase();
      if (w.length < 2 || EN_STOP[w]) continue;
      freq[w] = (freq[w] || 0) + 1;
    }

    var cnRe = /[\u4e00-\u9fff]{2,}/g;
    while ((m = cnRe.exec(text)) !== null) {
      var run = m[0];
      for (var k = 0; k + 1 < run.length; k++) {
        var bg = run.substr(k, 2);
        if (CJK_STOP.test(bg)) continue;
        freq[bg] = (freq[bg] || 0) + 1;
      }
    }

    var arr = [];
    for (var key in freq) {
      if (freq[key] < 2) continue; // 只保留出现 2 次以上的词
      arr.push({ word: key, count: freq[key] });
    }
    arr.sort(function (a, b) { return b.count - a.count; });
    return arr.slice(0, 20);
  }

  // ===== 构建发送给模型的统计文本 =====
  function buildPrompt(stats) {
    var p = [];
    p.push('以下是系统基于本地数据（会话记录、审计日志、Token 统计）生成的统计报告，请据此完成用户画像分析。');
    p.push('');
    p.push('【分析时段】' + stats.periodLabel);
    p.push('');
    p.push('【一、会话概览】');
    p.push('- 统计会话数：' + stats.convCount + ' 个');
    p.push('- 用户提问总数：' + stats.questionCount + ' 条');
    p.push('- 活跃天数：' + stats.activeDays + ' 天');
    p.push('- 平均提问长度：' + stats.avgQuestionLen + ' 字符；最长提问：' + stats.maxQuestionLen + ' 字符');
    p.push('- 模型用量（' + stats.tokenDaysLabel + '）：总 Token ' + stats.tokenTotal + '，调用 ' + stats.tokenCalls + ' 次');
    if (stats.byModel.length > 0) {
      for (var i = 0; i < stats.byModel.length; i++) {
        var bm = stats.byModel[i];
        p.push('  - ' + bm.model + '（' + (bm.providerName || '-') + '）：' + bm.totalTokens + ' Tokens / ' + bm.calls + ' 次');
      }
    }
    p.push('');
    p.push('【二、活跃时段分布】（按会话最近活跃时间的小时统计）');
    var hourLine = [];
    for (var h = 0; h < 24; h++) {
      if (stats.hourBuckets[h] > 0) hourLine.push(pad2(h) + '时:' + stats.hourBuckets[h] + '次');
    }
    p.push(hourLine.length ? hourLine.join('、') : '（数据不足，无明显活跃时段）');
    p.push('');
    p.push('【三、高频关键词 Top】');
    if (stats.wordFreq.length > 0) {
      for (var w = 0; w < stats.wordFreq.length; w++) {
        p.push('- ' + stats.wordFreq[w].word + '（' + stats.wordFreq[w].count + ' 次）');
      }
    } else {
      p.push('（数据不足）');
    }
    p.push('');
    p.push('【四、会话主题与记忆摘要】');
    if (stats.topicHints.length > 0) {
      for (var t = 0; t < stats.topicHints.length; t++) {
        p.push((t + 1) + '. ' + stats.topicHints[t]);
      }
    } else {
      p.push('（数据不足）');
    }
    p.push('');
    p.push('【五、最近提问样本】（最多 ' + stats.questionSamples.length + ' 条，单条截断至 ' + MAX_SINGLE_QUESTION_LEN + ' 字符）');
    if (stats.questionSamples.length > 0) {
      for (var q = 0; q < stats.questionSamples.length; q++) {
        p.push((q + 1) + '. ' + stats.questionSamples[q].replace(/\n/g, ' '));
      }
    } else {
      p.push('（该时段内暂无用户提问数据）');
    }
    p.push('');
    p.push('请严格按照技能要求（systemPrompt）输出完整的用户画像分析报告。若某维度数据不足，请如实说明。');
    return p.join('\n');
  }

  // ===== 调用模型 =====
  function callModel(prompt, systemPrompt, opts) {
    var activeConfig = window.ApiConfig.getActiveConfig();
    var providerId = (opts && opts.providerId) || activeConfig.providerId;
    var config = (opts && opts.config) || activeConfig.config;
    var provider = window.AI_PROVIDERS[providerId];
    if (!provider || !config.apiKey) {
      return Promise.resolve({ error: '请先配置模型 API Key' });
    }
    var model = (opts && opts.model) || config.model;
    var langInstruction = (opts && opts.langInstruction) || '';

    var url;
    if (provider.getUrl) {
      url = provider.getUrl(config.baseURL, model, config.apiKey);
    } else {
      url = config.baseURL + provider.apiPath;
    }

    var messages = [];
    if (langInstruction) {
      messages.push({ role: 'system', content: langInstruction });
    }
    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    var temperature = 0.4;
    if (opts && opts.config && opts.config.temperature !== undefined) {
      temperature = opts.config.temperature;
    }
    var body = provider.buildRequestBody(messages, model, {
      temperature: temperature,
      maxTokens: 4096
    });

    var requestId = 'insight_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    // 审计日志：记录外发请求（与主链路一致，便于隐私追溯）
    try {
      window.AuditLog.logApiRequest({
        conversationId: window.ChatManager.getCurrentId ? window.ChatManager.getCurrentId() : '',
        conversationTitle: '',
        providerId: providerId,
        providerName: provider.name || '',
        model: model,
        endpoint: url,
        method: 'POST',
        messageCount: messages.length,
        totalCharacters: JSON.stringify(messages).length,
        userContent: prompt,
        hasContextReference: false,
        referenceConvIds: [],
        referenceContent: '',
        attachments: [],
        skills: [{ id: INSIGHT_SKILL_ID, name: '用户画像分析' }]
      }, requestId);
    } catch (e) {}

    return window.electron.apiFetch({
      url: url,
      method: 'POST',
      headers: provider.headers(config.apiKey),
      body: body,
      requestId: requestId
    }).then(function (result) {
      // 记录审计响应
      try {
        var status = result.aborted ? 'aborted' : (result.ok && result.data ? 'success' : 'error');
        var aiContent = '';
        var usage = null;
        if (result.ok && result.data) {
          try { aiContent = provider.parseResponse(result.data) || ''; } catch (e) { aiContent = ''; }
          if (result.data.usage) {
            usage = result.data.usage;
            window.TokenStats.recordUsage(
              providerId, provider.name || '', model,
              usage.prompt_tokens || 0,
              usage.completion_tokens || 0,
              usage.total_tokens || 0
            );
          }
        }
        window.AuditLog.logApiResponse({
          requestEventId: requestId,
          status: status,
          httpStatus: result.status || 0,
          responseLength: aiContent.length,
          durationMs: 0,
          aiContent: aiContent,
          error: result.error || '',
          usage: usage
        });
      } catch (e) {}

      if (result.aborted) {
        return { error: '请求已取消' };
      }
      if (result.ok && result.data) {
        var content = provider.parseResponse(result.data);
        if (content) return { content: content };
        return { error: '模型未返回内容，请检查 Model 参数' };
      }
      return { error: result.error || ('请求失败（HTTP ' + (result.status || '?') + '）') };
    }).catch(function (e) {
      return { error: (e && e.message) || '模型调用失败' };
    });
  }

  // ===== 分析入口 =====
  function analyze(userContent, opts) {
    var period = parsePeriod(userContent);
    return window.Skills.get(INSIGHT_SKILL_ID).then(function (skill) {
      var systemPrompt = (skill && skill.systemPrompt) ||
        '你是专业的用户画像与对话分析专家，请基于提供的统计数据输出：分析概览、提问习惯、关注点、提问方向、改进建议、需要注意的问题，使用 Markdown 输出。';
      return collectStats(period).then(function (stats) {
        var prompt = buildPrompt(stats);
        return callModel(prompt, systemPrompt, opts).then(function (res) {
          if (res.content) {
            return {
              ok: true,
              content: res.content,
              reportHtml: buildReportHtml(stats, res.content),
              period: period,
              stats: stats
            };
          }
          return { ok: false, error: res.error || '模型调用失败' };
        });
      });
    });
  }

  // 导出报告默认文件名：Report + 具体的生成时间（如 Report20260808_155026.html）
  function reportFileName() {
    var d = new Date();
    return 'Report' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) +
      '_' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.html';
  }

  // ===== 导出按钮 =====
  function attachExportButton(messageEl, reportHtml) {
    if (!messageEl || !reportHtml) return;
    var bubble = messageEl.querySelector('.chat-bubble');
    if (!bubble) return;
    var actions = bubble.querySelector('.msg-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'msg-actions';
      bubble.appendChild(actions);
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-copy insight-export-btn';
    btn.textContent = '导出分析报告';
    btn.title = '将本次分析导出为 HTML 报告文件';
    btn.addEventListener('click', function () {
      btn.disabled = true;
      window.electron.exportReport(reportHtml, reportFileName()).then(function (res) {
        btn.disabled = false;
        if (res && res.success) {
          btn.textContent = '已导出';
        } else if (res && res.canceled) {
          btn.textContent = '已取消';
        } else {
          btn.textContent = '导出失败';
          console.warn('[Insight] 报告导出失败:', res && res.error);
        }
        setTimeout(function () {
          btn.textContent = '导出分析报告';
        }, 2000);
      }).catch(function () {
        btn.disabled = false;
        btn.textContent = '导出失败';
        setTimeout(function () {
          btn.textContent = '导出分析报告';
        }, 2000);
      });
    });
    actions.insertBefore(btn, actions.firstChild);
  }

  // ===== 生成自包含 HTML 报告 =====
  function buildReportHtml(stats, analysis) {
    var esc = escapeHtml;
    var p = [];
    p.push('<!DOCTYPE html>');
    p.push('<html lang="zh-CN"><head><meta charset="UTF-8"><title>用户画像分析报告</title><style>');
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
    p.push('.bar-lbl{width:200px;font-size:12px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}');
    p.push('.bar-bg{flex:1;height:22px;background:#f1f5f9;border-radius:6px;overflow:hidden;}');
    p.push('.bar-fill{height:100%;background:linear-gradient(90deg,#a5b4fc,#6366f1);border-radius:6px;}');
    p.push('.bar-val{width:70px;text-align:right;font-size:11px;color:#64748b;}');
    p.push('.analysis{background:#fff;border:1px solid #edf1f5;border-radius:10px;padding:20px 24px;font-size:14px;line-height:1.8;}');
    p.push('.analysis h3{font-size:15px;margin:20px 0 10px;}');
    p.push('.analysis h4{font-size:14px;margin:16px 0 8px;}');
    p.push('.analysis ul,.analysis ol{margin:6px 0;padding-left:22px;}');
    p.push('.analysis li{margin:4px 0;}');
    p.push('.analysis p{margin:8px 0;}');
    p.push('.analysis code{background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:12px;color:#be185d;}');
    p.push('.analysis pre{background:#0f172a;color:#e2e8f0;border-radius:8px;padding:12px 14px;overflow:auto;font-size:12px;}');
    p.push('.analysis pre code{background:transparent;color:inherit;padding:0;}');
    p.push('.analysis blockquote{border-left:3px solid #cbd5e1;margin:8px 0;padding:2px 12px;color:#64748b;}');
    p.push('.analysis hr{border:none;border-top:1px solid #edf1f5;margin:16px 0;}');
    p.push('</style></head><body><div class="wrap">');

    p.push('<h1>用户画像分析报告</h1>');
    p.push('<div class="meta">生成时间：' + esc(nowTimeStr()) + '　·　分析时段：' + esc(stats.periodLabel) + '</div>');

    // 一、统计概览
    p.push('<h2>一、统计概览</h2><div class="cards">');
    p.push(cardHtml('统计会话数', formatNum(stats.convCount), '个会话'));
    p.push(cardHtml('用户提问数', formatNum(stats.questionCount), '条提问'));
    p.push(cardHtml('活跃天数', formatNum(stats.activeDays), '天'));
    p.push(cardHtml('平均提问长度', formatNum(stats.avgQuestionLen), '最长 ' + formatNum(stats.maxQuestionLen) + ' 字符'));
    p.push(cardHtml('模型 Token 用量', formatNum(stats.tokenTotal), stats.tokenDaysLabel + ' / ' + stats.tokenCalls + ' 次调用'));
    p.push('</div>');

    // 二、模型用量明细
    p.push('<h2>二、模型用量明细</h2>');
    p.push('<table><thead><tr><th>模型</th><th>提供商</th><th>输入 Tokens</th><th>输出 Tokens</th><th>总计 Tokens</th><th>调用次数</th></tr></thead><tbody>');
    if (stats.byModel.length === 0) {
      p.push('<tr><td colspan="6" class="empty">暂无数据</td></tr>');
    } else {
      for (var i = 0; i < stats.byModel.length; i++) {
        var m = stats.byModel[i];
        p.push('<tr><td>' + esc(m.model) + '</td><td>' + esc(m.providerName || '-') + '</td>' +
          '<td>' + formatNum(m.promptTokens) + '</td><td>' + formatNum(m.completionTokens) + '</td>' +
          '<td>' + formatNum(m.totalTokens) + '</td><td>' + (m.calls || 0) + '</td></tr>');
      }
    }
    p.push('</tbody></table>');

    // 三、活跃时段分布
    p.push('<h2>三、活跃时段分布</h2>');
    var hourRows = [];
    var maxHour = 0;
    for (var h = 0; h < 24; h++) {
      if (stats.hourBuckets[h] > 0) {
        hourRows.push({ hour: h, count: stats.hourBuckets[h] });
        if (stats.hourBuckets[h] > maxHour) maxHour = stats.hourBuckets[h];
      }
    }
    if (maxHour === 0) maxHour = 1;
    if (hourRows.length === 0) {
      p.push('<div class="empty">暂无数据</div>');
    } else {
      for (var hr = 0; hr < hourRows.length; hr++) {
        var rh = hourRows[hr];
        var pct = Math.max(2, Math.round((rh.count / maxHour) * 100));
        p.push('<div class="bar-row"><div class="bar-lbl">' + pad2(rh.hour) + ':00-' + pad2(rh.hour) + ':59</div>' +
          '<div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<div class="bar-val">' + rh.count + ' 次</div></div>');
      }
    }

    // 四、高频关键词
    p.push('<h2>四、高频关键词 Top</h2>');
    if (stats.wordFreq.length === 0) {
      p.push('<div class="empty">暂无数据</div>');
    } else {
      var maxF = stats.wordFreq[0].count || 1;
      for (var w = 0; w < stats.wordFreq.length; w++) {
        var f = stats.wordFreq[w];
        var wpct = Math.max(2, Math.round((f.count / maxF) * 100));
        p.push('<div class="bar-row"><div class="bar-lbl" title="' + esc(f.word) + '">' + esc(f.word) + '</div>' +
          '<div class="bar-bg"><div class="bar-fill" style="width:' + wpct + '%"></div></div>' +
          '<div class="bar-val">' + f.count + ' 次</div></div>');
      }
    }

    // 五、AI 画像分析
    p.push('<h2>五、AI 画像分析</h2>');
    p.push('<div class="analysis">' + renderMarkdown(analysis) + '</div>');

    p.push('</div></body></html>');
    return p.join('\n');
  }

  function cardHtml(label, value, sub) {
    return '<div class="card"><div class="lbl">' + escapeHtml(label) + '</div>' +
      '<div class="val">' + value + '</div><div class="sub">' + escapeHtml(sub) + '</div></div>';
  }

  // 最小化 Markdown → HTML 渲染（用于报告中展示 AI 分析结果）
  function renderMarkdown(text) {
    if (!text) return '';
    var lines = String(text).replace(/\r/g, '').split('\n');
    var html = [];
    var inCode = false;
    var codeBuf = [];
    var listType = null; // 'ul' | 'ol' | null
    var inTable = false;

    function closeList() {
      if (listType) { html.push('</' + listType + '>'); listType = null; }
      if (inTable) { html.push('</tbody></table>'); inTable = false; }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      // 围栏代码块
      if (/^\s*(```|~~~)/.test(line)) {
        if (inCode) {
          html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      var trimmed = line.replace(/^\s+|\s+$/g, '');
      if (!trimmed) { closeList(); continue; }

      // 标题
      var hd = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (hd) {
        closeList();
        var level = hd[1].length;
        html.push('<h' + level + '>' + inline(escapeHtml(hd[2])) + '</h' + level + '>');
        continue;
      }
      // 分隔线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        closeList();
        html.push('<hr>');
        continue;
      }
      // 引用
      if (/^>\s?/.test(trimmed)) {
        closeList();
        html.push('<blockquote>' + inline(escapeHtml(trimmed.replace(/^>\s?/, ''))) + '</blockquote>');
        continue;
      }
      // 无序列表
      var ul = /^[-*+]\s+(.*)$/.exec(trimmed);
      if (ul) {
        if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
        html.push('<li>' + inline(escapeHtml(ul[1])) + '</li>');
        continue;
      }
      // 有序列表
      var ol = /^\d+[.)]\s+(.*)$/.exec(trimmed);
      if (ol) {
        if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
        html.push('<li>' + inline(escapeHtml(ol[1])) + '</li>');
        continue;
      }
      // 表格（简单支持：行首 | ）
      if (/^\s*\|/.test(trimmed)) {
        var cells = trimmed.replace(/^\||\|$/g, '').split('|').map(function (c) { return c.replace(/^\s+|\s+$/g, ''); });
        // 分隔行（|---|），忽略
        var isSep = cells.every(function (c) { return /^:?-{2,}:?$/.test(c || ''); });
        if (isSep) continue;
        // 关闭未闭合的列表（表格保持打开状态）
        if (listType) { html.push('</' + listType + '>'); listType = null; }
        if (inTable) {
          var td = cells.map(function (c) { return '<td>' + inline(escapeHtml(c)) + '</td>'; }).join('');
          html.push('<tr>' + td + '</tr>');
        } else {
          html.push('<table><thead><tr>');
          var th = cells.map(function (c) { return '<th>' + inline(escapeHtml(c)) + '</th>'; }).join('');
          html.push(th);
          html.push('</tr></thead><tbody>');
          inTable = true;
        }
        continue;
      }
      // 普通段落
      closeList();
      html.push('<p>' + inline(escapeHtml(trimmed)) + '</p>');
    }

    if (inCode && codeBuf.length) {
      html.push('<pre><code>' + escapeHtml(codeBuf.join('\n')) + '</code></pre>');
    }
    closeList();
    return html.join('\n');
  }

  // 行内样式：**加粗**、`行内代码`
  function inline(str) {
    return String(str)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  // ===== 暴露到全局 =====
  window.InsightAnalyzer = {
    analyze: analyze,
    attachExportButton: attachExportButton,
    parsePeriod: parsePeriod,
    buildReportHtml: buildReportHtml
  };
})();
