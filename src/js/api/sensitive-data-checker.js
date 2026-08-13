/**
 * 敏感数据检测模块 v2
 * 
 * 纯客户端正则 + 算法校验，零网络请求。
 * 涵盖 PIPL / GDPR / 企业数据安全 定义的敏感数据类型。
 * 支持 Luhn 算法、身份证校验位、IP 上下文过滤。
 * 支持用户自定义规则，文件持久化存储。
 */
var SensitiveDataChecker = (function () {
  'use strict';

  var STORAGE_KEY = 'ai-talk-dlp-rules';
  var _filePath = null;

  // ===== 校验工具函数 =====

  /** Luhn 算法 — 银行卡/信用卡校验 */
  function luhnCheck(cardNum) {
    var sum = 0;
    var alt = false;
    for (var i = cardNum.length - 1; i >= 0; i--) {
      var n = parseInt(cardNum[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  /** 中国身份证校验位验证（GB 11643-1999） */
  function validateChineseId(id) {
    if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(id)) return false;
    var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var checkMap = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
    var sum = 0;
    for (var i = 0; i < 17; i++) sum += parseInt(id[i], 10) * weights[i];
    return checkMap[sum % 11].toUpperCase() === id[17].toUpperCase();
  }

  /** IP 上下文过滤 — 排除版本号/日期等误报 */
  function isIpContext(matchedValue, fullText, matchIndex) {
    var before = fullText.substring(Math.max(0, matchIndex - 30), matchIndex);
    // 排除 "版本" / "version" / "Ver." 前缀
    if (/版本\s*[:：]?\s*$/.test(before)) return false;
    if (/[Vv]er\.?\s*$/.test(before)) return false;
    if (/version\s*[:：]?\s*$/i.test(before)) return false;
    // 排除后面紧接日期模式（如 2026.07.26）
    var after = fullText.substring(matchIndex + matchedValue.length, matchIndex + matchedValue.length + 10);
    if (/^\s*[-/.\u5e74]/.test(after)) return false;
    // 排除前面是日期数字的
    if (/\d{4}[.\-/]\d{1,2}[.\-/]\s*$/.test(before)) return false;
    return true;
  }

  /** 银行卡校验（Luhn + 防递增序列） */
  function validateBankCard(cardNum) {
    if (!luhnCheck(cardNum)) return false;
    // 排除纯递增/递减/全同序列
    if (/^(?:0{16,}|123456|(\d)\1{15,})$/.test(cardNum)) return false;
    return true;
  }

  /** 根据类型字符串构建校验器 */
  function buildValidator(type) {
    switch (type) {
      case 'luhn':       return validateBankCard;
      case 'chineseId':  return validateChineseId;
      case 'ipContext':  return isIpContext;
      default:           return null;
    }
  }

  // ===== 默认规则配置 =====

  var DEFAULT_RULE_CONFIGS = [
    // ===== PIPL 个人信息保护法 =====
    {
      name: '身份证号码',
      severity: 'high',
      pattern: '\\b[1-9]\\d{5}(?:18|19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]\\b',
      showFirst: 6,
      showLast: 4,
      validatorType: 'chineseId'
    },
    {
      name: '手机号码',
      severity: 'high',
      pattern: '\\b1[3-9]\\d{9}\\b',
      showFirst: 3,
      showLast: 4
    },
    {
      name: '银行卡号',
      severity: 'high',
      pattern: '\\b\\d{16,19}\\b',
      showFirst: 0,
      showLast: 4,
      validatorType: 'luhn'
    },
    {
      name: '邮箱地址',
      severity: 'medium',
      pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
      emailMask: true
    },
    {
      name: '公网 IP 地址',
      severity: 'medium',
      pattern: '\\b(?!(?:0|127|10|192\\.168|172\\.(?:1[6-9]|2\\d|3[01]))\\.)' +
               '(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}' +
               '(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b',
      showFirst: 1,
      showLast: 1,
      validatorType: 'ipContext'
    },
    {
      name: '内网 IP 地址',
      severity: 'medium',
      pattern: '\\b(?:10\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)' +
               '|172\\.(?:1[6-9]|2\\d|3[01])\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)' +
               '|192\\.168\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?))\\b',
      showFirst: 1,
      showLast: 1
    },
    {
      name: 'API Key / Token',
      severity: 'high',
      pattern: '\\b(?:sk|api|key|token|secret|auth|bearer)[-_][A-Za-z0-9]{16,}\\b',
      fullMask: true,
      caseInsensitive: true
    },
    {
      name: '护照号码',
      severity: 'high',
      pattern: '\\b[EeDdSsPpGgLl]\\d{7,8}\\b',
      showFirst: 1,
      showLast: 3
    },
    {
      name: '港澳通行证',
      severity: 'high',
      pattern: '\\b[Cc]\\d{8}\\b',
      showFirst: 1,
      showLast: 3
    },
    {
      name: '统一社会信用代码',
      severity: 'medium',
      pattern: '\\b[0-9A-HJ-NPQRTUWXY]{2}\\d{6}[0-9A-HJ-NPQRTUWXY]{10}\\b',
      showFirst: 4,
      showLast: 4
    },
    {
      name: '车牌号',
      severity: 'medium',
      pattern: '\\b[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁]' +
               '[A-Z](?:[A-HJ-NP-Z0-9]{4,5}[A-HJ-NP-Z0-9挂学警港澳]|[DF][A-HJ-NP-Z0-9]{5})\\b',
      showFirst: 2,
      showLast: 1
    },
    {
      name: '营业执照编号',
      severity: 'medium',
      pattern: '\\b\\d{15}\\b',
      showFirst: 4,
      showLast: 4
    },

    // ===== GDPR 补充规则 =====
    {
      name: '信用卡号',
      severity: 'high',
      pattern: '\\b(?:4\\d{12}(?:\\d{3})?|5[1-5]\\d{14}|3[47]\\d{13}|6(?:011|5\\d{2})\\d{12}|(?:2131|1800|35\\d{3})\\d{11})\\b',
      fullMask: true
    },
    {
      name: 'IBAN',
      severity: 'high',
      pattern: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b',
      showFirst: 4,
      showLast: 4
    },
    {
      name: '出生日期',
      severity: 'medium',
      pattern: '\\b(?:19|20)\\d{2}[-/.年](?:0[1-9]|1[0-2])[-/.月](?:0[1-9]|[12]\\d|3[01])[日号]?\\b',
      fullMask: true,
      skipInDirListing: true
    },
    {
      name: 'GPS 坐标',
      severity: 'medium',
      pattern: '\\b[-+]?\\d{1,3}\\.\\d{4,10}\\s*[,，]\\s*[-+]?\\d{1,3}\\.\\d{4,10}\\b',
      showFirst: 3,
      showLast: 3
    },

    // ===== 企业数据安全 — 云厂商密钥 =====
    {
      name: 'OpenAI API Key',
      severity: 'high',
      pattern: '\\bsk-(?:proj-|svcacct-)?[A-Za-z0-9-_]{20,}\\b',
      fullMask: true
    },
    {
      name: 'AWS Access Key',
      severity: 'high',
      pattern: '\\bAKIA[0-9A-Z]{16}\\b',
      fullMask: true
    },
    {
      name: '阿里云 AccessKey',
      severity: 'high',
      pattern: '\\bLTAI[a-zA-Z0-9]{12,}\\b',
      fullMask: true
    },
    {
      name: '腾讯云 SecretId',
      severity: 'high',
      pattern: '\\bAKID[a-zA-Z0-9]{32,}\\b',
      fullMask: true
    },
    {
      name: 'GitHub Token',
      severity: 'high',
      pattern: '\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\\b',
      fullMask: true
    },
    {
      name: 'GitLab Token',
      severity: 'high',
      pattern: '\\bglpat-[A-Za-z0-9_-]{20,}\\b',
      fullMask: true
    },
    {
      name: 'JWT Token',
      severity: 'high',
      pattern: '\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\b',
      fullMask: true
    },

    // ===== 企业数据安全 — 认证凭据 =====
    {
      name: '用户名密码',
      severity: 'high',
      pattern: '\\b(?:password|passwd|pwd|secret)\\s*[=:：]\\s*\\S+|密码\\s*[=:：]\\s*\\S+|口令\\s*[=:：]\\s*\\S+',
      fullMask: true,
      caseInsensitive: true
    },
    {
      name: '数据库连接串',
      severity: 'high',
      pattern: '\\b(?:jdbc|mongodb|redis|mysql|postgres(?:ql)?|mssql|oracle|sqlite)[+a-z]*://[^\\s]+',
      fullMask: true,
      caseInsensitive: true
    },

    // ===== 企业数据安全 — 密钥文件 =====
    {
      name: 'SSH 私钥',
      severity: 'high',
      pattern: '-----BEGIN\\s+(?:RSA|OPENSSH|EC|DSA|ED25519)\\s+PRIVATE\\s+KEY-----',
      fullMask: true
    },
    {
      name: '通用私钥头',
      severity: 'high',
      pattern: '-----BEGIN\\s+PRIVATE\\s+KEY-----',
      fullMask: true
    }
  ];

  var RULES = [];

  // ===== 文件路径 =====

  function getFilePath() {
    if (_filePath) return Promise.resolve(_filePath);
    return window.electron.getConfigPath().then(function (configPath) {
      _filePath = configPath + '/dlp-rules.json';
      return _filePath;
    });
  }

  // ===== Mask 函数构建 =====

  function buildMaskFn(cfg) {
    if (cfg.fullMask) {
      return function () { return '********'; };
    }
    if (cfg.emailMask) {
      return function (v) {
        var parts = v.split('@');
        var local = parts[0];
        var prefix = local.length > 2 ? local.substr(0, 2) : local.substr(0, 1);
        return prefix + '***@' + parts[1];
      };
    }
    // 默认：保留首尾字符
    var sf = (typeof cfg.showFirst === 'number') ? cfg.showFirst : 3;
    var sl = (typeof cfg.showLast === 'number') ? cfg.showLast : 4;
    return function (v) {
      if (v.length <= sf + sl + 2) {
        var half = Math.floor(v.length / 2);
        return v.substr(0, Math.max(1, half - 2)) + '****' + v.substr(-Math.max(1, half - 2));
      }
      var prefix = sf > 0 ? v.substr(0, sf) : '';
      var suffix = sl > 0 ? v.substr(-sl) : '';
      return prefix + '****' + suffix;
    };
  }

  // ===== 规则构建 =====

  function buildRules(configs) {
    if (!configs || !configs.length) return [];

    return configs.map(function (cfg) {
      var flags = 'g';
      if (cfg.caseInsensitive) flags += 'i';
      var patternStr = cfg.pattern;
      return {
        name: cfg.name || '未命名规则',
        severity: cfg.severity || 'medium',
        pattern: new RegExp(patternStr, flags),
        mask: buildMaskFn(cfg),
        validator: buildValidator(cfg.validatorType),
        skipInDirListing: !!cfg.skipInDirListing,
        // 保留原始配置用于序列化/回显（不含函数）
        _config: {
          name: cfg.name,
          severity: cfg.severity,
          pattern: patternStr,
          showFirst: cfg.showFirst,
          showLast: cfg.showLast,
          fullMask: !!cfg.fullMask,
          emailMask: !!cfg.emailMask,
          caseInsensitive: !!cfg.caseInsensitive,
          validatorType: cfg.validatorType || null,
          skipInDirListing: !!cfg.skipInDirListing
        }
      };
    });
  }

  // ===== 持久化 =====

  function persist(configs) {
    var data = JSON.stringify(configs, null, 2);
    // 同步写 localStorage
    try { localStorage.setItem(STORAGE_KEY, data); } catch (e) {}
    // 异步写文件
    getFilePath().then(function (filePath) {
      return window.electron.writeFile(filePath, data);
    }).catch(function (e) {
      console.error('[DLP] 规则文件保存失败:', e);
    });
  }

  // ===== 对外 API =====

  /**
   * 扫描文本，返回所有匹配项
   * @param {string} text - 待扫描文本
   * @param {object} [opts] - 可选上下文：{ context: 'dirListing' } 表示目录清单（文件名列表），
   *                          命中带 skipInDirListing 标记的规则（如「出生日期」）时跳过，避免文件名误报
   * @returns {{ found: boolean, items: Array, highCount: number, mediumCount: number }}
   */
  function scan(text, opts) {
    if (!text || typeof text !== 'string') return { found: false, items: [] };

    var items = [];
    var seenPositions = {};
    var isDirListing = !!(opts && opts.context === 'dirListing');

    for (var ri = 0; ri < RULES.length; ri++) {
      var rule = RULES[ri];
      // 目录清单（文件名）场景跳过标记规则，仅对文件内容检测
      if (isDirListing && rule.skipInDirListing) continue;
      rule.pattern.lastIndex = 0;
      var match;
      try {
        while ((match = rule.pattern.exec(text)) !== null) {
          // 算法校验器过滤（Luhn、身份证校验位、IP 上下文等）
          if (rule.validator && !rule.validator(match[0], text, match.index)) continue;

          var posKey = match.index + '-' + match[0];
          if (seenPositions[posKey]) continue;
          seenPositions[posKey] = true;

          items.push({
            name: rule.name,
            severity: rule.severity,
            value: match[0],
            masked: rule.mask(match[0]),
            ruleIndex: ri,
            index: match.index
          });
        }
      } catch (e) {
        console.warn('[DLP] 规则 "' + rule.name + '" 正则无效:', e.message);
      }
    }

    items.sort(function (a, b) { return a.index - b.index; });

    return {
      found: items.length > 0,
      items: items,
      highCount: items.filter(function (it) { return it.severity === 'high'; }).length,
      mediumCount: items.filter(function (it) { return it.severity === 'medium'; }).length
    };
  }

  /**
   * 获取当前规则原始配置（可序列化，供 UI 回显）
   */
  function getRuleConfigs() {
    return RULES.map(function (r) { return r._config; });
  }

  /**
   * 替换规则集（UI 编辑后调用）
   * @param {Array} configs - 原始规则配置数组
   */
  function saveCustomRules(configs) {
    RULES = buildRules(configs);
    persist(configs);
  }

  /**
   * 恢复默认规则
   */
  function resetToDefaults() {
    RULES = buildRules(DEFAULT_RULE_CONFIGS);
    // 持久化默认规则（validatorType 保留，加载时可重建校验器）
    var cleanConfigs = DEFAULT_RULE_CONFIGS.map(function (cfg) {
      return {
        name: cfg.name,
        severity: cfg.severity,
        pattern: cfg.pattern,
        showFirst: cfg.showFirst,
        showLast: cfg.showLast,
        fullMask: !!cfg.fullMask,
        emailMask: !!cfg.emailMask,
        caseInsensitive: !!cfg.caseInsensitive,
        validatorType: cfg.validatorType || null,
        skipInDirListing: !!cfg.skipInDirListing
      };
    });
    persist(cleanConfigs);
  }

  /**
   * 添加单条规则
   */
  function addRule(cfg) {
    var configs = getRuleConfigs();
    configs.push(cfg);
    saveCustomRules(configs);
  }

  /**
   * 删除规则（按索引）
   */
  function removeRule(index) {
    var configs = getRuleConfigs();
    if (index >= 0 && index < configs.length) {
      configs.splice(index, 1);
      saveCustomRules(configs);
    }
  }

  /**
   * 更新单条规则
   */
  function updateRule(index, cfg) {
    var configs = getRuleConfigs();
    if (index >= 0 && index < configs.length) {
      // 编辑保存时未显式提供的标记字段沿用原值（如「目录清单忽略」），避免规则配置被意外清空
      if (!Object.prototype.hasOwnProperty.call(cfg, 'skipInDirListing')) {
        cfg.skipInDirListing = !!configs[index].skipInDirListing;
      }
      configs[index] = cfg;
      saveCustomRules(configs);
    }
  }

  /**
   * 重新从文件加载规则
   */
  function reload() {
    return getFilePath().then(function (filePath) {
      return window.electron.readFile(filePath);
    }).then(function (raw) {
      if (raw) {
        var configs = JSON.parse(raw);
        if (configs && configs.length > 0) {
          RULES = buildRules(configs);
          try { localStorage.setItem(STORAGE_KEY, raw); } catch (e) {}
          return;
        }
      }
      loadFromLocalStorage();
    }).catch(function () {
      loadFromLocalStorage();
    });
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var configs = JSON.parse(raw);
        if (configs && configs.length > 0) {
          RULES = buildRules(configs);
          return;
        }
      }
    } catch (e) {}
    // 无自定义规则，使用默认
    RULES = buildRules(DEFAULT_RULE_CONFIGS);
  }

  // ===== 初始化 =====

  // localStorage 同步加载，随后异步从文件覆盖
  loadFromLocalStorage();
  reload();

  return {
    scan: scan,
    getRuleConfigs: getRuleConfigs,
    saveCustomRules: saveCustomRules,
    resetToDefaults: resetToDefaults,
    addRule: addRule,
    removeRule: removeRule,
    updateRule: updateRule,
    reload: reload
  };
})();
