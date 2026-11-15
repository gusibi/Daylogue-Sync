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

export interface RecordMeta {
  key: string;
  label: string;
  subLabel?: string;
  badgeClass: string;
}

export function getRecordMeta(record: { type: string; deleted?: boolean; data?: any }): RecordMeta {
  if (record.deleted) {
    return {
      key: 'deleted',
      label: '已删除',
      badgeClass: 'bg-destructive/10 text-destructive border border-destructive/20'
    };
  }

  if (record.type === 'message') {
    const isAi = record.data?.role === 1;
    const msgType = record.data?.type;
    let sub: string | undefined = undefined;
    if (msgType === 1) sub = '🎤 语音';
    else if (msgType === 2) sub = '🖼 图片';
    else if (msgType === 3) sub = '📝 日记卡片';

    if (isAi) {
      return {
        key: 'ai_reply',
        label: '🤖 AI 回复',
        subLabel: sub,
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30'
      };
    } else {
      return {
        key: 'my_message',
        label: '👤 我的消息',
        subLabel: sub,
        badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30'
      };
    }
  }

  switch (record.type) {
    case 'diary':
      return {
        key: 'diary',
        label: '📝 日记',
        badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30'
      };
    case 'todo':
      return {
        key: 'todo',
        label: '✓ 待办',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
      };
    case 'bill':
      return {
        key: 'bill',
        label: '¥ 账本',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
      };
    case 'session':
      return {
        key: 'session',
        label: '📅 会话',
        badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30'
      };
    case 'tag':
      return {
        key: 'tag',
        label: '🏷 标签',
        badgeClass: 'bg-teal-500/15 text-teal-600 dark:text-teal-300 border border-teal-500/30'
      };
    case 'setting':
      return {
        key: 'setting',
        label: '⚙ 设置',
        badgeClass: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300 border border-zinc-500/30'
      };
    default:
      return {
        key: record.type,
        label: record.type,
        badgeClass: 'bg-muted text-foreground border border-border'
      };
  }
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
