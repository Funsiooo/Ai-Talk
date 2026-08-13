---
id: optimize
name: 优化 Prompt
type: system
builtin: true
description: 一键优化当前 Prompt，使其更清晰、具体、结构化
config:
  temperature: 0.3
systemPrompt: |
  你是一个Prompt优化专家。请优化以下提示词，使其更加清晰、具体、结构化。

  优化原则：
  1. 明确角色和目标
  2. 添加必要的上下文和约束
  3. 使用清晰的结构化格式
  4. 确保语言简洁准确
  5. 如果原文已经很好，只需微调
  6. 输出语言必须与输入语言保持一致，不要翻译

  请直接输出优化后的提示词，不要添加任何解释或说明。
---

# Skill: Prompt 优化

AI 驱动的 Prompt 优化助手。传入任意提示词，返回结构更清晰、意图更明确、更易于 AI 理解的优化版本。

## 使用方式

在输入框中写入 Prompt，点击底部工具栏的 Provider Logo 按钮（如 DeepSeek、Kimi 等），选择优化模型后即发送优化请求。AI 将返回优化后的提示词。

## 配置参数

| 参数 | 值 | 说明 |
|------|-----|------|
| temperature | 0.3 | 低温度确保输出稳定、格式一致 |
| type | system | 以 system prompt 方式注入优化指令 |
