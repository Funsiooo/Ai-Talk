/**
 * 审计日志模块 (Audit Log)
 * 纯本地记录，不调用任何外部 API；JSONL 逐行存储于 audit-logs/YYYY-MM-DD.jsonl。
 *
 * 日志内容：
 * - 时间戳、会话 ID、提供商、模型、目标端点
 * - 外发内容全文（用户消息 + 引用的历史会话）
 * - API 返回结果摘要（状态码、内容长度、耗时）
 * - 事件 ID 用于唯一追溯
 */

var AuditLog = (function () {
  'use strict';

  var _logsDir = null;

  function getLogsDir() {
    if (_logsDir) return Promise.resolve(_logsDir);
    return window.electron.getDataPath().then(function (dataPath) {
      _logsDir = dataPath + '/audit-logs';
      return _logsDir;
    });
  }

  /**
   * 生成当天日志文件路径
   * 格式: audit-logs/2026-07-22.jsonl
   */
  function getDailyLogPath() {
    var now = new Date();
    var y = now.getFullYear();
    var m = ('0' + (now.getMonth() + 1)).slice(-2);
    var d = ('0' + now.getDate()).slice(-2);
    var dateStr = y + '-' + m + '-' + d;
    return getLogsDir().then(function (dir) {
      return dir + '/' + dateStr + '.jsonl';
    });
  }

  /**
   * 生成唯一事件 ID
   */
  function generateEventId() {
    var ts = Date.now();
    var rand = Math.random().toString(36).substr(2, 6);
    return 'evt_' + ts + '_' + rand;
  }

  /**
   * 生成当前时间戳（ISO 8601 + 时区）
   */
  function getTimestamp() {
    var now = new Date();
    var offset = -now.getTimezoneOffset();
    var sign = offset >= 0 ? '+' : '-';
    var hours = ('0' + Math.floor(Math.abs(offset) / 60)).slice(-2);
    var mins = ('0' + (Math.abs(offset) % 60)).slice(-2);
    return now.getFullYear() + '-' +
      ('0' + (now.getMonth() + 1)).slice(-2) + '-' +
      ('0' + now.getDate()).slice(-2) + 'T' +
      ('0' + now.getHours()).slice(-2) + ':' +
      ('0' + now.getMinutes()).slice(-2) + ':' +
      ('0' + now.getSeconds()).slice(-2) + '.' +
      ('00' + now.getMilliseconds()).slice(-3) +
      sign + hours + ':' + mins;
  }

  /**
   * 记录一条审计事件
   * @param {Object} event - 审计事件对象
   * @param {string} [eventId] - 可选，预先指定事件 ID（用于关联请求-响应）
   * @returns {Promise<string>} 事件 ID
   */
  function logEvent(event, eventId) {
    if (!event || !event.eventType) return Promise.resolve('');

    event.eventId = eventId || generateEventId();
    event.timestamp = getTimestamp();

    var line = JSON.stringify(event) + '\n';

    return getDailyLogPath().then(function (filePath) {
      return window.electron.appendAuditLog(filePath, line);
    }).then(function () {
      return event.eventId;
    }).catch(function (err) {
      console.error('[AuditLog] 写入失败:', err);
      return event.eventId;
    });
  }

  /**
   * 记录 API 请求事件（发送前调用）
   */
  function logApiRequest(params, eventId) {
    return logEvent({
      eventType: 'api_request',
      session: {
        conversationId: params.conversationId || '',
        conversationTitle: params.conversationTitle || ''
      },
      provider: {
        id: params.providerId || '',
        name: params.providerName || '',
        model: params.model || ''
      },
      outbound: {
        endpoint: params.endpoint || '',
        method: params.method || 'POST',
        messageCount: params.messageCount || 0,
        totalCharacters: params.totalCharacters || 0,
        userContent: params.userContent || '',
        hasContextReference: !!params.hasContextReference,
        referenceConvIds: params.referenceConvIds || [],
        referenceContent: params.referenceContent || '',
        attachments: (params.attachments || []).map(function (a) {
          return { name: a.name || '', path: a.path || '', kind: a.kind || 'file' };
        }),
        skills: (params.skills || []).map(function (s) {
          return { id: s.id || '', name: s.name || '' };
        })
      }
    }, eventId);
  }

  /**
   * 记录 API 响应事件（收到响应后调用）
   * 通过 eventId 关联到对应的请求事件
   */
  function logApiResponse(params, eventId) {
    var usage = params.usage || null;
    return logEvent({
      eventType: 'api_response',
      requestEventId: params.requestEventId || '',
      result: {
        status: params.status || 'unknown',
        httpStatus: params.httpStatus || 0,
        responseLength: params.responseLength || 0,
        durationMs: params.durationMs || 0,
        aiContent: params.aiContent || '',
        error: params.error || ''
      },
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined
    }, eventId);
  }

  /**
   * 记录错误事件
   */
  function logError(params, eventId) {
    return logEvent({
      eventType: 'api_error',
      requestEventId: params.requestEventId || '',
      error: {
        message: params.message || '',
        httpStatus: params.httpStatus || 0,
        providerId: params.providerId || '',
        endpoint: params.endpoint || ''
      }
    }, eventId);
  }

  /**
   * 记录用户交互操作事件
   * @param {Object} params - { action: string, detail: string }
   */
  function logUserAction(params) {
    return logEvent({
      eventType: 'user_action',
      action: params.action || '',
      detail: params.detail || ''
    });
  }

  return {
    logApiRequest: logApiRequest,
    logApiResponse: logApiResponse,
    logError: logError,
    logEvent: logEvent,
    logUserAction: logUserAction
  };
})();
