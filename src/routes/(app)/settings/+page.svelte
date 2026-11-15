<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let wipeModalOpen = $state(false);
  let inputPhrase = $state('');
  let isWiping = $state(false);

  let isPhraseMatched = $derived(inputPhrase.trim() === data.wipePhrase);
</script>

<div class="p-4 md:p-6 space-y-6 max-w-2xl">
  <div>
    <h1 class="text-lg font-semibold tracking-tight">系统设置</h1>
    <p class="text-xs text-muted-foreground mt-0.5">服务端运行状态、数据导出与危险操作</p>
  </div>

  <!-- 服务状态 -->
  <div class="rounded-lg border border-border bg-card p-4 space-y-3">
    <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">运行信息</h2>
    <div class="space-y-1.5 text-xs">
      <div class="flex justify-between py-1 border-b border-border">
        <span class="text-muted-foreground">协议版本</span>
        <span class="font-mono">v{data.protocol}</span>
      </div>
      <div class="flex justify-between py-1 border-b border-border">
        <span class="text-muted-foreground">服务端版本</span>
        <span class="font-mono">v{data.serverVersion}</span>
      </div>
      <div class="flex justify-between py-1">
        <span class="text-muted-foreground">全局单调游标 (seq)</span>
        <span class="font-mono">{data.currentSeq}</span>
      </div>
    </div>
  </div>

  <!-- 数据主权与导出 -->
  <div class="rounded-lg border border-border bg-card p-4 space-y-3">
    <h2 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">数据导出</h2>
    <p class="text-xs text-muted-foreground">
      下载服务端存储的全部结构化数据记录（包含消息、日记、待办、账本及配置）。
    </p>
    <a
      href="/settings/export"
      download
      class="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
    >
      📥 导出为 JSON 备份
    </a>
  </div>

  <!-- 成功提示横幅 -->
  {#if form?.wiped}
    <div class="rounded-lg border border-border bg-card p-3 text-xs text-foreground flex items-center space-x-2">
      <span>✓</span>
      <span>远端数据已成功清空，生成最新基线游标：{form.cursor}</span>
    </div>
  {/if}

  <!-- 危险区 -->
  <div class="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
    <h2 class="text-xs font-semibold text-destructive uppercase tracking-wider">危险区</h2>
    <p class="text-xs text-muted-foreground">
      清空远端所有数据将会为所有活跃记录标记删除墓碑，并清理 R2 中的全部媒体。
      <strong class="text-foreground">所有已连接的设备在下一次进行同步拉取时，也将同步清空其本地数据。</strong>
    </p>
    <button
      onclick={() => {
        wipeModalOpen = true;
        inputPhrase = '';
      }}
      class="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive/90 transition-colors"
    >
      清空远端全部数据...
    </button>
  </div>
</div>

<!-- 危险区清空确认弹窗（严格短语比对） -->
{#if wipeModalOpen}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-4 shadow-lg">
      <div class="space-y-1">
        <h3 class="text-sm font-semibold text-destructive">危险操作：清空远端数据</h3>
        <p class="text-xs text-muted-foreground leading-relaxed">
          此操作不可撤销。所有已同步的设备在下一次同步拉取时，本地数据也会被全部清空。<br />
          请输入下方精确短语确认执行：
        </p>
      </div>

      <div class="rounded bg-muted p-2 text-xs font-mono select-all text-center font-semibold text-foreground">
        {data.wipePhrase}
      </div>

      <form
        action="?/wipeRemote"
        method="POST"
        use:enhance={() => {
          isWiping = true;
          return async ({ update }) => {
            isWiping = false;
            wipeModalOpen = false;
            inputPhrase = '';
            update();
          };
        }}
        class="space-y-3"
      >
        <div>
          <input
            type="text"
            name="phrase"
            bind:value={inputPhrase}
            placeholder="请在此输入确认短语"
            autocomplete="off"
            class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive font-mono"
          />
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onclick={() => (wipeModalOpen = false)}
            class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={!isPhraseMatched || isWiping}
            class="rounded-md bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-medium hover:bg-destructive/90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
          >
            {isWiping ? '正在清理中...' : '我知晓后果，确认清空'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
