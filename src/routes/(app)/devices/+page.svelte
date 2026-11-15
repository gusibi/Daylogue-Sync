<script lang="ts">
  let { data } = $props();

  function platformIcon(platform: string | null): string {
    if (!platform) return '💻';
    const p = platform.toLowerCase();
    if (p.includes('mac')) return '🍎';
    if (p.includes('ios')) return '📱';
    if (p.includes('android')) return '🤖';
    if (p.includes('windows')) return '🪟';
    if (p.includes('linux')) return '🐧';
    return '💻';
  }
</script>

<div class="p-4 md:p-6 space-y-6">
  <div>
    <h1 class="text-lg font-semibold tracking-tight">连接设备</h1>
    <p class="text-xs text-muted-foreground mt-0.5">所有已连接并进行数据增量交换的客户端终端</p>
  </div>

  <!-- 设备列表 -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    <div class="p-3 border-b border-border font-medium text-xs text-foreground">已注册终端 ({data.devices.length})</div>
    {#if data.devices.length === 0}
      <div class="p-8 text-center text-xs text-muted-foreground">尚无连接设备</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-muted/40 text-muted-foreground font-medium">
            <tr>
              <th class="py-2 px-3">平台</th>
              <th class="py-2 px-3">设备名 / ID</th>
              <th class="py-2 px-3">使用令牌</th>
              <th class="py-2 px-3">首次同步</th>
              <th class="py-2 px-3">最近活跃</th>
              <th class="py-2 px-3 text-right">已拉取游标</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.devices as d}
              <tr class="hover:bg-muted/40 transition-colors">
                <td class="py-2.5 px-3 whitespace-nowrap text-base">
                  {platformIcon(d.platform)}
                </td>
                <td class="py-2.5 px-3">
                  <div class="font-medium text-foreground">{d.name || '未命名终端'}</div>
                  <div class="font-mono text-[11px] text-muted-foreground truncate max-w-xs">{d.id}</div>
                </td>
                <td class="py-2.5 px-3 text-muted-foreground">
                  {d.token_name || '已归档令牌'}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                  {new Date(d.first_seen).toLocaleString('zh-CN')}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap text-foreground text-[11px] font-medium">
                  {new Date(d.last_seen).toLocaleString('zh-CN')}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground">
                  {d.last_pull_seq ?? 0}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

  <!-- 同步操作流水日志 -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    <div class="p-3 border-b border-border font-medium text-xs text-foreground">同步请求流水日志 (最近 100 条)</div>
    {#if data.logs.length === 0}
      <div class="p-8 text-center text-xs text-muted-foreground">暂无流水记录</div>
    {:else}
      <div class="overflow-x-auto max-h-96">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-muted/40 text-muted-foreground font-medium sticky top-0">
            <tr>
              <th class="py-2 px-3">时间</th>
              <th class="py-2 px-3">设备</th>
              <th class="py-2 px-3">动作</th>
              <th class="py-2 px-3">条数</th>
              <th class="py-2 px-3">冲突数</th>
              <th class="py-2 px-3 text-right">耗时</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.logs as l}
              <tr class="hover:bg-muted/40 transition-colors">
                <td class="py-1.5 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  {new Date(l.at).toLocaleString('zh-CN')}
                </td>
                <td class="py-1.5 px-3 font-mono text-[11px] text-foreground max-w-xs truncate">
                  {l.device_id || '—'}
                </td>
                <td class="py-1.5 px-3 uppercase text-[10px] font-mono">
                  <span class="rounded bg-muted px-1.5 py-0.5">{l.kind}</span>
                </td>
                <td class="py-1.5 px-3 font-mono text-[11px]">
                  {l.count}
                </td>
                <td class="py-1.5 px-3 font-mono text-[11px] {l.conflicts > 0 ? 'text-amber-500 font-semibold' : 'text-muted-foreground'}">
                  {l.conflicts}
                </td>
                <td class="py-1.5 px-3 text-right font-mono text-[11px] text-muted-foreground">
                  {l.ms}ms
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>
