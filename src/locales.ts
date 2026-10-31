/**
 * `codexModelSelect` dictionaries.
 *
 * `trigger.*` repeats the shipped model seat's wording on purpose: the
 * compact trigger is the same control, so its accessible name must not change
 * when this plugin is installed.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger.fallback': '请选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '请选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'menu.aria': '模型与推理等级',
  'select.title': '选择模型',
  'effort.reset': '恢复默认等级',
  'effort.providerDefault': '默认',
  'status.loading': '正在刷新模型列表…',
  'empty.models': '没有可用的模型。',
  'error.action': '模型操作失败：{message}',
  'error.sessionInUse': '当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。',
  'action.reload': '重新加载',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'provider.account': 'DeepSeek 账号',
} satisfies Record<string, string>

/** The dictionary key union every locale must cover. */
export type CopyKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en: Record<CopyKey, string> = {
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'select.title': 'Choose model',
  'effort.reset': 'Reset to the default effort',
  'effort.providerDefault': 'Default',
  'status.loading': 'Refreshing model list…',
  'empty.models': 'No models available.',
  'error.action': 'Model operation failed: {message}',
  'error.sessionInUse': 'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
  'action.reload': 'Reload',
  'warning.groupLoad': '{name} failed to load: {message}',
  'provider.account': 'DeepSeek Account',
}
