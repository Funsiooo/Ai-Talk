---
id: translate
name: 语言翻译
type: instruction
builtin: true
description: 指定 AI 在本次对话中的回答语言
instructionTemplate: 请在本次对话中始终使用 {lang} 进行回答，无论用户使用何种语言提问
languages:
  - value: ""
    label: 跟随（不指定）
  - value: 中文
    label: 中文
  - value: 英文
    label: 英文
  - value: 日文
    label: 日文
  - value: 韩文
    label: 韩文
  - value: 法文
    label: 法文
  - value: 德文
    label: 德文
  - value: 西班牙文
    label: 西班牙文
  - value: 俄文
    label: 俄文
---

# Skill: 语言翻译

指定 AI 在本次对话中始终使用用户选择的语言进行回答，无论用户使用何种语言提问。

## 使用方式

在输入框上方的语言选择器中选择目标语言，选中的语言将作为隐藏 system 消息注入到每次对话请求中。

## 配置参数

| 参数 | 说明 |
|------|------|
| type | instruction — 以隐藏 system 消息方式注入 |
| instructionTemplate | 使用 `{lang}` 占位符替换所选语言 |
