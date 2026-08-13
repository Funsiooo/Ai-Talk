/**
 * Skills 模块
 * 从 config/skills/ 目录加载技能定义。
 * 每个技能独立成文件夹，入口文件必须是 skill.md（或 SKILL.md），
 * 文件夹名与技能 name 一致（旧版扁平 .md 已由主进程启动时迁移）。
 * .md 文件使用 YAML Front Matter 定义元数据，正文为说明文档
 *
 * 格式示例：
 * ---
 * id: optimize
 * name: 优化 Prompt
 * type: system
 * config:
 *   temperature: 0.3
 * files:
 *   - scripts/scan.py
 * systemPrompt: |
 *   你是一个Prompt优化专家...
 * ---
 */
(function () {
  var _skillsCache = {}; // { skillId: skillDef }
  var _loaded = false;

  /**
   * 从 Markdown 文本中提取 YAML Front Matter 并解析为 skill 定义
   */
  function parseSkillFile(raw, filename) {
    if (!raw) return null;
    var parsed = window.YamlParser.parseFrontMatter(raw);
    if (!parsed || !parsed.frontMatter || !parsed.frontMatter.id) return null;
    // 将 body 内容与文件名也附加到定义中
    var def = parsed.frontMatter;
    def._body = parsed.body;
    def._filename = filename || '';
    def._relPath = filename || '';
    // 网络 skill（Anthropic/GitHub 风格）通常只有 name+description+正文，没有 systemPrompt：
    // 用 description + 正文兜底，保证模型能收到技能指令
    if (!def.systemPrompt) {
      var parts = [];
      if (def.description) parts.push(def.description);
      if (def._body) parts.push(def._body);
      def.systemPrompt = parts.join('\n\n');
    }
    return def;
  }

  /**
   * 从磁盘加载所有 .md skill 文件
   */
  function loadAll() {
    if (_loaded) return Promise.resolve(_skillsCache);
    return window.electron.getDataPath().then(function (dataDir) {
      // dataDir = {userData}/data, skills 在 {userData}/config/skills/
      // 用 [\\/] 同时兼容 Windows 反斜杠与 macOS/Linux 正斜杠路径（否则 Windows 上无法剥离 /data 后缀）
      var skillsDir = dataDir.replace(/[\\/]data[\\/]?$/, '') + '/config/skills';
      return window.electron.listDir(skillsDir).then(function (files) {
        var mdFiles = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i].split('\\').join('/');
          if (!f.endsWith('.md')) continue;
          // 唯一入口规则：文件夹内的 skill.md / SKILL.md 才是技能入口
          if (f.split('/').pop().toLowerCase() !== 'skill.md') continue;
          mdFiles.push(f);
        }
        var promises = mdFiles.map(function (filename) {
          var filePath = skillsDir + '/' + filename;
          return window.electron.readFile(filePath).then(function (raw) {
            if (raw) {
              var def = parseSkillFile(raw, filename);
              if (def && def.id) {
                // 记录技能文件夹绝对路径（工具层据此解析 @skill:<id>/ 访问技能自带资源）
                var slashIdx = filename.lastIndexOf('/');
                def._dir = slashIdx === -1 ? skillsDir : skillsDir + '/' + filename.substring(0, slashIdx);
                _skillsCache[def.id] = def;
              }
            }
          }).catch(function () {
            console.warn('[Skills] 未找到 skill 文件:', filename);
          });
        });
        return Promise.all(promises).then(function () {
          _loaded = true;
          return _skillsCache;
        });
      }).catch(function () {
        console.warn('[Skills] 无法列出 skills 目录');
        _loaded = true;
        return _skillsCache;
      });
    });
  }

  /**
   * 获取单个 skill 定义
   * @param {string} skillId - skill id，如 'optimize'、'translate'、'memory'
   */
  function get(skillId) {
    if (_skillsCache[skillId]) {
      return Promise.resolve(_skillsCache[skillId]);
    }
    return loadAll().then(function () {
      return _skillsCache[skillId] || null;
    });
  }

  /**
   * 获取所有已加载的 skill
   */
  function getAll() {
    if (_loaded) {
      var list = [];
      var keys = Object.keys(_skillsCache);
      for (var i = 0; i < keys.length; i++) {
        list.push(_skillsCache[keys[i]]);
      }
      return Promise.resolve(list);
    }
    return loadAll().then(function () {
      var list = [];
      var keys = Object.keys(_skillsCache);
      for (var i = 0; i < keys.length; i++) {
        list.push(_skillsCache[keys[i]]);
      }
      return list;
    });
  }

  /**
   * 使缓存失效（导入/删除技能后调用，下次读取自动重新扫描磁盘）
   */
  function invalidate() {
    _loaded = false;
    _skillsCache = {};
  }

  /**
   * 刷新缓存：使失效并立即重新扫描磁盘
   * @returns {Promise<Object>} 刷新后的完整缓存
   */
  function reload() {
    invalidate();
    return loadAll();
  }

  // ========== 暴露到全局 ==========
  window.Skills = {
    loadAll: loadAll,
    get: get,
    getAll: getAll,
    invalidate: invalidate,
    reload: reload
  };
})();
