/**
 * 轻量 YAML 解析器
 * 仅支持 Skills 文件所需子集：标量、嵌套对象、数组、多行字符串(|)
 */
(function () {
  /**
   * 解析 YAML Front Matter（--- 之间的内容）
   * @param {string} raw - 完整的 .md 文件内容
   * @returns {{ frontMatter: object|null, body: string }}
   */
  function parseFrontMatter(raw) {
    if (!raw) return { frontMatter: null, body: raw || '' };

    // 必须以 --- 开头
    var trimmed = raw.trimStart();
    if (!trimmed.startsWith('---')) return { frontMatter: null, body: raw };

    // 查找结束的 ---
    var endIdx = trimmed.indexOf('\n---', 3);
    var oneLineFront = false;
    if (endIdx === -1) {
      // 可能只有一行 ---key: value--- 之类的
      var altEnd = trimmed.indexOf('---', 3);
      if (altEnd === -1) return { frontMatter: null, body: raw };
      endIdx = altEnd;
      oneLineFront = true;
    }

    // endIdx 指向 \n--- 中的 \n（或单行形式的第一个 -），body 需跳过整个结束符
    var yamlText = trimmed.substring(3, endIdx).trim();
    var body = trimmed.substring(endIdx + (oneLineFront ? 3 : 4)).trim();

    if (!yamlText) return { frontMatter: {}, body: body };

    var parsed = parseYaml(yamlText);
    return { frontMatter: parsed, body: body };
  }

  /**
   * 解析 YAML 文本为 JS 对象
   */
  function parseYaml(text) {
    var lines = text.split('\n');
    var result = {};
    var multilineKey = null;
    var multilineBuf = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];
      // 跳过空行和纯注释行
      if (line.trim() === '' || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      // 如果正在收集多行字符串
      if (multilineKey !== null) {
        // 检查是否遇到下一个顶层 key（无缩进），结束多行收集
        if (line.length > 0 && line[0] !== ' ' && line.indexOf(':') !== -1 && !line.startsWith('  ')) {
          setNestedValue(result, multilineKey, multilineBuf.join('\n').trim());
          multilineKey = null;
          multilineBuf = [];
          continue; // 重新处理当前行
        }
        multilineBuf.push(line);
        i++;
        continue;
      }

      // 检查是否是顶层 key: value（不带缩进）
      var keyMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
      if (keyMatch) {
        var key = keyMatch[1];
        var value = keyMatch[2].trim();

        if (value === '|') {
          // 多行字符串开始
          multilineKey = [key];
          multilineBuf = [];
          i++;
          continue;
        }

        if (value === '') {
          // 可能是嵌套对象的开始，或值为空
          // 检查后续行是否有缩进内容
          var nestedLines = [];
          var j = i + 1;
          while (j < lines.length) {
            var nextLine = lines[j];
            if (nextLine.trim() === '') { j++; continue; }
            if (nextLine.startsWith('  ') || nextLine.startsWith('\t')) {
              nestedLines.push(nextLine);
              j++;
            } else if (nextLine.trim().startsWith('-')) {
              nestedLines.push(nextLine);
              j++;
            } else {
              break;
            }
          }
          if (nestedLines.length > 0) {
            var nestedText = nestedLines.join('\n');
            // 去掉每行开头的 2 空格缩进
            var unindented = nestedLines.map(function (l) {
              return l.replace(/^  /, '');
            }).join('\n');
            result[key] = parseYamlValue(unindented);
            i = j;
          } else {
            result[key] = '';
            i++;
          }
          continue;
        }

        // 简单标量值
        result[key] = parseScalar(value);
        i++;
        continue;
      }

      // 检查是否是数组项（顶层）
      if (line.trim().startsWith('- ')) {
        // 简单数组项
        var itemVal = line.trim().substring(2).trim();
        // 这种情况不应该出现在顶层，跳过
        i++;
        continue;
      }

      i++;
    }

    // 处理剩余的多行字符串
    if (multilineKey !== null && multilineBuf.length > 0) {
      setNestedValue(result, multilineKey, multilineBuf.join('\n').trim());
    }

    return result;
  }

  /**
   * 解析缩进的 YAML 值（可能是嵌套对象、数组、或多行字符串）
   */
  function parseYamlValue(text) {
    var lines = text.split('\n');
    // 过滤空行
    lines = lines.filter(function (l) { return l.trim() !== ''; });
    if (lines.length === 0) return '';

    // 检查是否是数组
    if (lines[0].trim().startsWith('- ')) {
      var arr = [];
      var currentObj = null;
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i].trim();
        if (l.startsWith('- ')) {
          // 开始新数组项：先保存上一个对象
          if (currentObj !== null) {
            arr.push(currentObj);
            currentObj = null;
          }
          var itemStr = l.substring(2).trim();
          var itemKv = itemStr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
          if (itemKv) {
            currentObj = {};
            currentObj[itemKv[1]] = parseScalar(itemKv[2].trim());
          } else {
            arr.push(parseScalar(itemStr));
          }
        } else if (currentObj !== null) {
          // 继续为当前数组项添加属性（多行数组项）
          var contKv = l.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
          if (contKv) {
            currentObj[contKv[1]] = parseScalar(contKv[2].trim());
          }
        }
      }
      // 保存最后一个数组项对象
      if (currentObj !== null) {
        arr.push(currentObj);
      }
      return arr;
    }

    // 检查是否是嵌套对象（每行都是 key: value）
    var isObject = true;
    var obj = {};
    for (var j = 0; j < lines.length; j++) {
      var l = lines[j].trim();
      var kv = l.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)/);
      if (kv) {
        obj[kv[1]] = parseScalar(kv[2].trim());
      } else {
        isObject = false;
        break;
      }
    }
    if (isObject) return obj;

    // 默认作为多行字符串
    return text.trim();
  }

  /**
   * 解析标量值
   */
  function parseScalar(val) {
    if (!val) return '';
    // 去掉可能的首尾引号
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    // 布尔值
    if (val === 'true') return true;
    if (val === 'false') return false;
    // 数字
    if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
    return val;
  }

  /**
   * 按路径设置嵌套值
   * setNestedValue(obj, ['config', 'temperature'], 0.3)
   */
  function setNestedValue(obj, path, value) {
    var current = obj;
    for (var i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  // 暴露到全局
  window.YamlParser = {
    parseFrontMatter: parseFrontMatter,
    parse: parseYaml
  };
})();
