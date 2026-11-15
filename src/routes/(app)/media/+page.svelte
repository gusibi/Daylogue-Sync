<script lang="ts">
  let { data } = $props();

  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }
</script>

<div class="p-4 md:p-6 space-y-4">
  <div>
    <h1 class="text-lg font-semibold tracking-tight">媒体文件</h1>
    <p class="text-xs text-muted-foreground mt-0.5">R2 托管的语音记录与图片附件（基于 SHA-256 内容寻址）</p>
  </div>

  {#if data.blobs.length === 0}
    <div class="rounded-lg border border-border bg-card p-12 text-center text-xs text-muted-foreground">
      暂无上传的媒体文件
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {#each data.blobs as b}
        {@const isImg = b.mime?.startsWith('image/')}
        {@const isAudio = b.mime?.startsWith('audio/')}
        <div class="rounded-lg border border-border bg-card overflow-hidden flex flex-col shadow-none">
          <div class="h-28 bg-muted/40 flex items-center justify-center p-2 relative overflow-hidden">
            {#if isImg}
              <img
                src="/api/v1/blobs/{b.hash}"
                alt="媒体预览"
                loading="lazy"
                class="max-h-full max-w-full object-contain rounded"
              />
            {:else if isAudio}
              <div class="text-3xl">🎙️</div>
            {:else}
              <div class="text-3xl">📁</div>
            {/if}
          </div>
          <div class="p-2 text-[11px] space-y-1 flex-1 flex flex-col justify-between">
            <div>
              <div class="font-mono text-foreground font-medium truncate" title={b.hash}>{b.hash}</div>
              <div class="text-[10px] text-muted-foreground">{b.mime || '未知格式'} · {formatBytes(b.size)}</div>
            </div>
            <div class="pt-1 flex items-center justify-between border-t border-border text-[10px] text-muted-foreground">
              <span>{new Date(b.created_at).toLocaleDateString('zh-CN')}</span>
              <a href="/api/v1/blobs/{b.hash}" target="_blank" class="text-primary hover:underline">查看</a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
