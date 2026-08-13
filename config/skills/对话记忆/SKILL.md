---
id: memory
name: 对话记忆
type: system
builtin: true
description: 自动压缩长对话历史为摘要，优化 Token 消耗；跨会话引用时提供摘要而非全量消息
config:
  keepRecent: 6
  triggerThreshold: 10
  summaryTemperature: 0.2
  maxSummaryTokens: 500
  # ===== 上下文预算管理（P0） =====
  contextWindow: 128000        # 全局默认上下文窗口（token），provider 可覆盖
  reserveRatio: 0.75           # 上下文预留比例：上下文最多占用窗口的 75%，其余留给输出
  triggerTokenThreshold: 20000 # Token 阈值：当前会话 token 超过此值也会触发摘要（与条数阈值双条件）
  maxSingleTokenLength: 6000   # 单条消息最大 token，超长自动截断保护
summaryPrompt: |
  请用简洁的语言总结以下对话的核心内容和关键结论。要求：
  1. 保留关键的技术决策、代码方案和重要结论
  2. 忽略寒暄、重复确认等无关内容
  3. 使用第三人称，如「用户询问了...」「AI 给出了...」
  4. 控制在 200 字以内
  5. 只输出摘要文本，不要加任何前缀或解释
refSummaryPrompt: |
  请用简洁的语言总结以下对话的核心内容和关键结论。要求：
  1. 保留关键的技术决策、代码方案和重要结论
  2. 忽略寒暄、重复确认等无关内容
  3. 控制在 150 字以内
  4. 只输出摘要文本
---

# Skill: 对话记忆

自动压缩长对话历史，优化 Token 消耗，同时保持上下文连贯性。

## 功能

### 当前会话记忆
- 对话超过 10 条消息时自动触发摘要压缩
- 保留最近 6 条消息（3 轮对话）为完整上下文
- 早期消息被压缩为摘要，以 system 消息形式注入

### 跨会话引用记忆
- 当用户 @mention 引用其他会话时，自动生成被引用会话的摘要
- 摘要缓存在会话对象中，避免重复生成
- 大幅减少跨会话引用的 Token 消耗

## 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| keepRecent | 6 | 保留最近 N 条消息不压缩 |
| triggerThreshold | 10 | 触发摘要的消息数阈值 |
| summaryTemperature | 0.2 | 摘要生成温度（低=更稳定） |
| maxSummaryTokens | 500 | 摘要目标最大 Token 数 |
| contextWindow | 128000 | 默认上下文窗口（token），provider 可覆盖 |
| reserveRatio | 0.75 | 上下文最多占用窗口的 75%，其余留给输出 |
| triggerTokenThreshold | 20000 | 触发摘要的 Token 阈值（与条数阈值双条件） |
| maxSingleTokenLength | 6000 | 单条消息最大 Token，超长自动截断 |

### 上下文预算管理（P0）
- 发送请求前估算全部消息 Token，若超过 `contextWindow × reserveRatio` 自动分级压缩：
  1. 单条超长消息截断保护（> `maxSingleTokenLength`）
  2. 从 `keepRecent` 逐级收窄最近保留消息（最低 2 条）
  3. 仍超出则按比例整体截断兜底
- 摘要触发条件由「仅按条数」升级为「条数 + Token」双条件：消息数 ≥ `triggerThreshold` 或 Token 数 ≥ `triggerTokenThreshold` 时触发
