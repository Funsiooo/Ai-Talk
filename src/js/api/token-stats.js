/**
 * Token 用量统计模块
 * 记录每次 API 调用的 token 消耗，按 provider + model 聚合，
 * 持久化到 token-stats.json，供数据面板读取
 */
var TokenStats = (function () {
  'use strict';

  var _statsFilePath = null;
  var _statsCache = null;

  // 数据永久保存：不做自动清理，是否删除由用户在「数据管理」中手动决定

  function getStatsPath() {
    if (_statsFilePath) return Promise.resolve(_statsFilePath);
    return window.electron.getDataPath().then(function (dataPath) {
      _statsFilePath = dataPath + '/token-stats.json';
      return _statsFilePath;
    });
  }

  /**
   * 加载统计数据（内存缓存）
   */
  function loadStats() {
    if (_statsCache) return Promise.resolve(_statsCache);
    return getStatsPath().then(function (filePath) {
      return window.electron.readFile(filePath);
    }).then(function (raw) {
      if (raw) {
        _statsCache = JSON.parse(raw);
      } else {
        _statsCache = { records: [], totals: {} };
      }
      if (!_statsCache.records) _statsCache.records = [];
      if (!_statsCache.totals) _statsCache.totals = {};
      return _statsCache;
    }).catch(function () {
      _statsCache = { records: [], totals: {} };
      return _statsCache;
    });
  }

  function saveStats(stats) {
    var data = JSON.stringify(stats, null, 2);
    _statsCache = stats;
    return getStatsPath().then(function (filePath) {
      return window.electron.writeFile(filePath, data);
    }).catch(function (e) {
      console.error('[TokenStats] 保存失败:', e);
    });
  }

  /**
   * 记录一次 API 的 token 消耗
   */
  function recordUsage(providerId, providerName, model, promptTokens, completionTokens, totalTokens) {
    return loadStats().then(function (stats) {
      var record = {
        timestamp: Date.now(),
        providerId: providerId,
        providerName: providerName,
        model: model,
        promptTokens: promptTokens || 0,
        completionTokens: completionTokens || 0,
        totalTokens: totalTokens || 0
      };

      stats.records.push(record);

      // 更新聚合
      var key = providerId + '|' + model;
      if (!stats.totals[key]) {
        stats.totals[key] = {
          providerId: providerId,
          providerName: providerName,
          model: model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          calls: 0
        };
      }
      stats.totals[key].promptTokens += record.promptTokens;
      stats.totals[key].completionTokens += record.completionTokens;
      stats.totals[key].totalTokens += record.totalTokens;
      stats.totals[key].calls += 1;

      return saveStats(stats);
    });
  }

  /**
   * 获取统计摘要（用于数据面板）
   * @param {number} days - 时间范围（天数），0 表示全部
   */
  function getSummary(days) {
    days = days || 0;
    return loadStats().then(function (stats) {
      // 时间过滤
      var records = stats.records;
      if (days > 0) {
        var cutoff = Date.now() - days * 86400000;
        records = stats.records.filter(function (r) {
          return r.timestamp >= cutoff;
        });
      }

      // 基于过滤后的 records 重新计算聚合
      var totalPrompt = 0, totalCompletion = 0, totalTokens = 0, totalCalls = 0;
      var modelMap = {};
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        totalPrompt += r.promptTokens;
        totalCompletion += r.completionTokens;
        totalTokens += r.totalTokens;
        totalCalls += 1;
        var key = r.providerId + '|' + r.model;
        if (!modelMap[key]) {
          modelMap[key] = {
            providerId: r.providerId,
            providerName: r.providerName,
            model: r.model,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            calls: 0
          };
        }
        modelMap[key].promptTokens += r.promptTokens;
        modelMap[key].completionTokens += r.completionTokens;
        modelMap[key].totalTokens += r.totalTokens;
        modelMap[key].calls += 1;
      }

      var byModel = [];
      var keys = Object.keys(modelMap);
      for (var j = 0; j < keys.length; j++) {
        byModel.push(modelMap[keys[j]]);
      }
      // 按 totalTokens 降序
      byModel.sort(function (a, b) { return b.totalTokens - a.totalTokens; });

      // 活跃天数
      var daysMap = {};
      for (var k = 0; k < records.length; k++) {
        var d = new Date(records[k].timestamp);
        var dayKey = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
        daysMap[dayKey] = true;
      }

      return {
        totalPromptTokens: totalPrompt,
        totalCompletionTokens: totalCompletion,
        totalTokens: totalTokens,
        totalCalls: totalCalls,
        activeDays: Object.keys(daysMap).length,
        byModel: byModel,
        records: records
      };
    });
  }

  /**
   * 清空全部 Token 用量统计
   */
  function clearStats() {
    _statsCache = { records: [], totals: {} };
    return saveStats(_statsCache);
  }

  return {
    recordUsage: recordUsage,
    getSummary: getSummary,
    loadStats: loadStats,
    clearStats: clearStats
  };
})();
