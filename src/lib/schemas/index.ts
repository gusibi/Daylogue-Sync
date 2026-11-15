export interface SchemaField {
  label: string;
  key: string;
  format?: (val: any) => string;
  isSecret?: boolean;
}

export interface TypeSchema {
  type: string;
  label: string;
  summary: (data: Record<string, any>) => string;
  fields: SchemaField[];
}

export function maskSecret(val: unknown): string {
  if (typeof val !== 'string' || !val) return '';
  if (val.length <= 8) return '********';
  return `${val.slice(0, 3)}****${val.slice(-4)}`;
}

export const typeSchemas: Record<string, TypeSchema> = {
  message: {
    type: 'message',
    label: '对话消息',
    summary: (d) => d.content || (d.media ? `[${d.media.kind || '媒体'}]` : ''),
    fields: [
      { label: '会话日期', key: 'sessionKey' },
      { label: '角色', key: 'role', format: (r) => (r === 0 ? '用户' : 'AI') },
      { label: '类型', key: 'type', format: (t) => ['文本', '语音', '图片', '日记', '重置'][t] ?? t },
      { label: '内容', key: 'content' },
      { label: '时间', key: 'timestamp', format: (ts) => new Date(ts).toLocaleString('zh-CN') },
      { label: '意图', key: 'intent' }
    ]
  },
  diary: {
    type: 'diary',
    label: '日记',
    summary: (d) => (d.content ? d.content.slice(0, 40) + '...' : ''),
    fields: [
      { label: '会话日期', key: 'sessionKey' },
      { label: '心情分', key: 'moodScore' },
      { label: '心情标签', key: 'moodLabel' },
      { label: '关键词', key: 'keywords' },
      { label: '正文', key: 'content' },
      { label: '创建时间', key: 'createdAt', format: (ts) => new Date(ts).toLocaleString('zh-CN') }
    ]
  },
  todo: {
    type: 'todo',
    label: '待办事项',
    summary: (d) => `${d.isCompleted ? '✓ ' : '○ '}${d.content || ''}`,
    fields: [
      { label: '内容', key: 'content' },
      { label: '状态', key: 'isCompleted', format: (c) => (c ? '已完成' : '未完成') },
      { label: '标签', key: 'tags' },
      { label: '截止日期', key: 'dueDate', format: (ts) => (ts ? new Date(ts).toLocaleDateString('zh-CN') : '无') }
    ]
  },
  bill: {
    type: 'bill',
    label: '账本明细',
    summary: (d) => `${d.isIncome ? '+' : '-'}${d.amount} · ${d.category} · ${d.description || ''}`,
    fields: [
      { label: '金额', key: 'amount', format: (a) => `¥${a}` },
      { label: '类型', key: 'isIncome', format: (inc) => (inc ? '收入' : '支出') },
      { label: '分类', key: 'category' },
      { label: '描述', key: 'description' },
      { label: '发生时间', key: 'occurredAt', format: (ts) => new Date(ts).toLocaleString('zh-CN') }
    ]
  },
  session: {
    type: 'session',
    label: '每日会话',
    summary: (d) => `${d.dateString} · ${d.lastMessagePreview || ''}`,
    fields: [
      { label: '日期', key: 'dateString' },
      { label: '心情分', key: 'moodScore' },
      { label: '关键词', key: 'keywords' },
      { label: '日记摘要', key: 'diaryMarkdown' }
    ]
  },
  tag: {
    type: 'tag',
    label: '标签',
    summary: (d) => `#${d.name}`,
    fields: [
      { label: '名称', key: 'name' },
      { label: '创建时间', key: 'createdAt', format: (ts) => new Date(ts).toLocaleString('zh-CN') }
    ]
  },
  setting: {
    type: 'setting',
    label: '应用配置',
    summary: (d) => (d.language ? `语言: ${d.language}` : d.providers ? '模型供应商与分配' : 'AI参数设置'),
    fields: [
      { label: '语言', key: 'language' },
      { label: '模型配置', key: 'providers' },
      { label: '模型分配', key: 'assignments' },
      { label: '思考强度', key: 'thinkingEffort' },
      { label: '超时时长', key: 'timeoutSecs' }
    ]
  }
};
