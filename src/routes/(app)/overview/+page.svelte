<script lang="ts">
  let { data } = $props();

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  function formatTime(ts: number | null): string {
    if (!ts) return '暂无同步记录';
    return new Date(ts).toLocaleString('zh-CN');
  }

  const typeLabels: Record<string, string> = {
    message: '对话消息',
    diary: '日记',
    todo: '待办',
    bill: '账单',
    session: '每日会话',
    tag: '标签',
    setting: '应用配置'
  };
</script>

<div class="p-4 md:p-6 space-y-6">
  <div>
    <h1 class="text-lg font-semibold tracking-tight">概览</h1>
    <p class="text-xs text-muted-foreground mt-0.5">多端增量数据同步与云端资产状态</p>
  </div>

  <!-- 顶部紧凑指标卡片 -->
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div class="rounded-lg border border-border bg-card p-3 shadow-none">
      <div class="text-[11px] text-muted-foreground font-medium">有效记录总数</div>
      <div class="text-xl font-semibold mt-1">{data.stats.total}</div>
      <div class="text-[10px] text-muted-foreground mt-0.5">跨 7 种数据模型</div>
    </div>
    <div class="rounded-lg border border-border bg-card p-3 shadow-none">
      <div class="text-[11px] text-muted-foreground font-medium">已同步设备</div>
      <div class="text-xl font-semibold mt-1">{data.stats.devices}</div>
      <div class="text-[10px] text-muted-foreground mt-0.5">活跃连接终端</div>
    </div>
    <div class="rounded-lg border border-border bg-card p-3 shadow-none">
      <div class="text-[11px] text-muted-foreground font-medium">R2 媒体文件</div>
      <div class="text-xl font-semibold mt-1">{data.stats.blobsCount}</div>
      <div class="text-[10px] text-muted-foreground mt-0.5">{formatBytes(data.stats.blobsBytes)} 占用</div>
    </div>
    <div class="rounded-lg border border-border bg-card p-3 shadow-none">
      <div class="text-[11px] text-muted-foreground font-medium">最近同步</div>
      <div class="text-xs font-medium mt-2 truncate" title={formatTime(data.stats.lastSyncAt)}>
        {formatTime(data.stats.lastSyncAt)}
      </div>
      <div class="text-[10px] text-muted-foreground mt-0.5">自动增量更新</div>
    </div>
  </div>

  <!-- 分类细分统计 -->
  <div class="rounded-lg border border-border bg-card p-4">
    <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">按类型分布</h2>
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
      {#each Object.entries(typeLabels) as [key, label]}
        {@const count = data.stats.byType[key] || 0}
        <div class="rounded-md bg-muted/50 p-2.5 text-center">
          <div class="text-[11px] text-muted-foreground">{label}</div>
          <div class="text-base font-semibold mt-0.5">{count}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- 最近同步活动日志 -->
  <div class="rounded-lg border border-border bg-card p-4">
    <div class="flex items-center justify-between mb-3">
      <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">最近同步活动</h2>
      <a href="/devices" class="text-xs text-primary hover:underline">查看全部日志 →</a>
    </div>

    {#if data.recentLogs.length === 0}
      <div class="text-xs text-muted-foreground py-4 text-center">暂无同步活动</div>
    {:else}
      <div class="divide-y divide-border text-xs">
        {#each data.recentLogs as log}
          <div class="py-2 flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-mono text-[11px] text-muted-foreground">{new Date(log.at).toLocaleTimeString('zh-CN')}</span>
              <span class="font-medium text-foreground">{log.device_id || '未知设备'}</span>
              <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-mono">{log.kind}</span>
            </div>
            <div class="flex items-center space-x-3 text-muted-foreground font-mono text-[11px]">
              <span>推送: {log.count}</span>
              {#if log.conflicts > 0}
                <span class="text-amber-500">冲突: {log.conflicts}</span>
              {/if}
              <span>{log.ms}ms</span>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
