<script lang="ts">
  import { typeSchemas, maskSecret, getRecordMeta } from '$lib/schemas';
  import { enhance } from '$app/forms';

  let { data } = $props();

  const tabs = [
    { id: 'all', label: '全部' },
    { id: 'my_message', label: '我的消息' },
    { id: 'ai_message', label: 'AI 回复' },
    { id: 'diary', label: '日记' },
    { id: 'todo', label: '待办' },
    { id: 'bill', label: '账本' },
    { id: 'session', label: '会话' },
    { id: 'tag', label: '标签' },
    { id: 'setting', label: '设置' },
    { id: 'other', label: '其他' }
  ];

  let selectedRecord = $state<any>(null);
  let showRawKeys = $state(false);
  let copied = $state(false);
  let deleteModalOpen = $state(false);

  function getSummary(record: any): string {
    if (record.deleted) return '（已删除墓碑）';
    const schema = typeSchemas[record.type];
    if (schema && record.data) {
      return schema.summary(record.data);
    }
    return JSON.stringify(record.data || '').slice(0, 50);
  }

  function copyJson() {
    if (!selectedRecord) return;
    navigator.clipboard.writeText(JSON.stringify(selectedRecord, null, 2));
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }
</script>

<div class="p-4 md:p-6 space-y-4">
  <!-- 顶部标题与说明 -->
  <div>
    <h1 class="text-lg font-semibold tracking-tight">数据明细</h1>
    <p class="text-xs text-muted-foreground mt-0.5">多端同步的原始结构化数据及最新同步状态</p>
  </div>

  <!-- Tab 分类切换器 -->
  <div class="flex items-center space-x-1 border-b border-border overflow-x-auto pb-1 text-xs">
    {#each tabs as t}
      <a
        href="?tab={t.id}&q={data.q}&deleted={data.showDeleted ? '1' : '0'}"
        class="px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors {data.tab === t.id
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
      >
        {t.label}
      </a>
    {/each}
  </div>

  <!-- 搜索与过滤器 -->
  <form method="GET" class="flex flex-wrap items-center gap-2">
    <input type="hidden" name="tab" value={data.tab} />
    <input
      type="text"
      name="q"
      value={data.q}
      placeholder="搜索 ID 或内容关键词..."
      class="rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring w-64"
    />
    <label class="flex items-center space-x-1.5 text-xs text-muted-foreground select-none cursor-pointer">
      <input
        type="checkbox"
        name="deleted"
        value="1"
        checked={data.showDeleted}
        onchange={(e) => (e.currentTarget.form as HTMLFormElement).submit()}
        class="rounded border-input text-primary focus:ring-ring"
      />
      <span>包含已删除</span>
    </label>
    <button
      type="submit"
      class="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
    >
      筛选
    </button>
  </form>

  <!-- 数据列表 -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if data.records.length === 0}
      <div class="p-8 text-center text-xs text-muted-foreground">暂无符合条件的同步记录</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-muted/40 text-muted-foreground font-medium">
            <tr>
              <th class="py-2 px-3">时间</th>
              <th class="py-2 px-3">类型</th>
              <th class="py-2 px-3">用户</th>
              <th class="py-2 px-3">主键 ID</th>
              <th class="py-2 px-3">内容摘要</th>
              <th class="py-2 px-3">设备</th>
              <th class="py-2 px-3 text-right">游标 (seq)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.records as r}
              {@const meta = getRecordMeta(r)}
              <tr
                onclick={() => (selectedRecord = r)}
                class="hover:bg-muted/50 cursor-pointer transition-colors {selectedRecord?.id === r.id ? 'bg-muted' : ''}"
              >
                <td class="py-2 px-3 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                  {new Date(r.ts).toLocaleString('zh-CN')}
                </td>
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium {meta.badgeClass}"
                  >
                    <span>{meta.label}</span>
                    {#if meta.subLabel}
                      <span class="opacity-75 text-[10px]">{meta.subLabel}</span>
                    {/if}
                    {#if r.deleted}
                      <span class="opacity-75">· 已删</span>
                    {/if}
                  </span>
                </td>
                <td class="py-2 px-3 whitespace-nowrap font-medium text-foreground text-[11px]" title={r.uid}>
                  {r.userName}
                </td>
                <td class="py-2 px-3 font-mono text-[11px] max-w-[120px] truncate" title={r.id}>
                  {r.id}
                </td>
                <td class="py-2 px-3 max-w-xs md:max-w-md truncate text-foreground">
                  {getSummary(r)}
                </td>
                <td class="py-2 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                  {r.deviceId}
                </td>
                <td class="py-2 px-3 whitespace-nowrap text-right font-mono text-[11px] text-muted-foreground">
                  {r.seq}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- 右侧抽屉：结构化呈现 + 原始 JSON -->
{#if selectedRecord}
  {@const drawerMeta = getRecordMeta(selectedRecord)}
  <div class="fixed inset-0 z-40 bg-black/40 flex justify-end">
    <div class="w-full max-w-lg bg-card border-l border-border h-full flex flex-col shadow-xl animate-in slide-in-from-right duration-200">
      <!-- 抽屉头部 -->
      <div class="h-14 px-4 border-b border-border flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-2">
          <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium {drawerMeta.badgeClass}">
            {drawerMeta.label}
          </span>
          <span class="font-semibold text-sm">详情</span>
          {#if selectedRecord.deleted}
            <span class="rounded bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px]">已删除墓碑</span>
          {/if}
        </div>
        <button
          onclick={() => (selectedRecord = null)}
          class="h-7 w-7 rounded-md border border-border flex items-center justify-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <!-- 抽屉内容主体 -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        <!-- 基础元数据 -->
        <div class="rounded-md border border-border bg-muted/20 p-3 space-y-1.5 font-mono text-[11px]">
          <div class="flex justify-between"><span class="text-muted-foreground">主键 ID:</span> <span>{selectedRecord.id}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">所属用户:</span> <span class="text-foreground">{selectedRecord.userName} <span class="text-muted-foreground">({selectedRecord.uid})</span></span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">游标 seq:</span> <span>{selectedRecord.seq}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">HLC:</span> <span>{selectedRecord.hlc}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">来源设备:</span> <span>{selectedRecord.deviceId}</span></div>
          <div class="flex justify-between"><span class="text-muted-foreground">同步时间:</span> <span>{new Date(selectedRecord.updatedAt).toLocaleString('zh-CN')}</span></div>
        </div>

        <!-- 媒体内联预览 (如果是图片或语音) -->
        {#if selectedRecord.data?.media}
          {@const media = selectedRecord.data.media}
          <div class="rounded-md border border-border p-3 space-y-2">
            <div class="font-medium text-foreground">媒体附件</div>
            {#if media.kind === 'image' || media.mime?.startsWith('image/')}
              <img
                src="/api/v1/blobs/{media.hash}"
                alt="媒体预览"
                class="max-h-60 rounded border border-border object-contain bg-background"
              />
            {:else if media.kind === 'voice' || media.mime?.startsWith('audio/')}
              <audio controls src="/api/v1/blobs/{media.hash}" class="w-full h-8"></audio>
            {/if}
            <div class="text-[10px] text-muted-foreground font-mono">
              HASH: {media.hash} ({media.mime || '未知类型'}, {media.size ? `${(media.size / 1024).toFixed(1)} KB` : ''})
            </div>
          </div>
        {/if}

        <!-- 结构化字段解析 -->
        {#if selectedRecord.data && !selectedRecord.deleted}
          <div class="rounded-md border border-border p-3 space-y-2">
            <div class="font-medium text-foreground">解析字段</div>
            <div class="space-y-1.5">
              {#each Object.entries(selectedRecord.data) as [k, v]}
                {#if k !== 'media'}
                  <div class="flex flex-col py-1 border-b border-border/50 last:border-b-0">
                    <span class="text-[11px] text-muted-foreground font-mono">{k}</span>
                    <span class="text-foreground mt-0.5 break-all">
                      {#if typeof v === 'object' && v !== null}
                        <pre class="bg-muted p-2 rounded text-[11px] overflow-x-auto">{JSON.stringify(v, null, 2)}</pre>
                      {:else}
                        {String(v)}
                      {/if}
                    </span>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <!-- 原始 JSON 与复制 -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-medium text-foreground">原始 JSON 数据</span>
            <button
              onclick={copyJson}
              class="rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted transition-colors"
            >
              {copied ? '✓ 已复制' : '复制 JSON'}
            </button>
          </div>
          <pre class="rounded-md border border-border bg-muted/60 p-3 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">{JSON.stringify(selectedRecord, null, 2)}</pre>
        </div>
      </div>

      <!-- 抽屉底部危险动作 -->
      {#if !selectedRecord.deleted}
        <div class="p-3 border-t border-border flex justify-end">
          <button
            onclick={() => (deleteModalOpen = true)}
            class="rounded-md bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1.5 text-xs hover:bg-destructive/20 transition-colors"
          >
            删除此记录（同步至各端）
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- 单条记录删除确认弹窗 -->
{#if deleteModalOpen && selectedRecord}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-lg border border-border bg-card p-5 space-y-4 shadow-lg">
      <div>
        <h3 class="text-sm font-semibold text-foreground">确认删除此记录？</h3>
        <p class="text-xs text-muted-foreground mt-1">
          删除后将标记墓碑并生成新的同步游标，所有连接设备在下次同步时都会在本地同步删除此项。
        </p>
      </div>

      <div class="rounded bg-muted p-2 text-xs font-mono">
        {selectedRecord.type} · {selectedRecord.id}
      </div>

      <div class="flex justify-end space-x-2 pt-2">
        <button
          onclick={() => (deleteModalOpen = false)}
          class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          取消
        </button>
        <form
          action="?/deleteRecord"
          method="POST"
          use:enhance={() => {
            return async ({ update }) => {
              deleteModalOpen = false;
              selectedRecord = null;
              update();
            };
          }}
        >
          <input type="hidden" name="type" value={selectedRecord.type} />
          <input type="hidden" name="id" value={selectedRecord.id} />
          <button
            type="submit"
            class="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive/90"
          >
            确认删除
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}
