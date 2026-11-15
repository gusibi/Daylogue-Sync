<script lang="ts">
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let createModalOpen = $state(false);
  let tokenName = $state('');
  let copied = $state(false);

  function copyRawToken(text: string) {
    navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<div class="p-4 md:p-6 space-y-6">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-lg font-semibold tracking-tight">用户与同步凭证</h1>
      <p class="text-xs text-muted-foreground mt-0.5">管理家庭组用户，每个用户拥有独立的 UID 与唯一的专属同步令牌</p>
    </div>
    <button
      onclick={() => (createModalOpen = true)}
      class="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      + 添加用户与凭证
    </button>
  </div>

  <!-- 新建成功的明文展示横幅（仅展示一次） -->
  {#if form?.created && form?.rawToken}
    <div class="rounded-lg border border-border bg-card p-4 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-foreground">用户「{form.name}」添加成功 (UID: {form.userId})</span>
        <span class="text-[10px] text-muted-foreground">此密钥仅展示一次，请复制并在对应用户的 App 设置中填入</span>
      </div>
      <div class="flex items-center space-x-2">
        <input
          type="text"
          readonly
          value={form.rawToken}
          class="flex-1 rounded-md border border-input bg-muted px-3 py-1.5 text-xs font-mono text-foreground select-all"
        />
        <button
          onclick={() => copyRawToken(form.rawToken)}
          class="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          {copied ? '✓ 已复制' : '复制密钥'}
        </button>
      </div>
    </div>
  {/if}

  <!-- 用户与令牌列表 -->
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    {#if data.tokens.length === 0}
      <div class="p-8 text-center text-xs text-muted-foreground">暂无用户，请点击右上角「+ 添加用户与凭证」</div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-border bg-muted/40 text-muted-foreground font-medium">
            <tr>
              <th class="py-2 px-3">用户昵称</th>
              <th class="py-2 px-3">UID</th>
              <th class="py-2 px-3">专属 Token 前缀</th>
              <th class="py-2 px-3">关联设备</th>
              <th class="py-2 px-3">创建时间</th>
              <th class="py-2 px-3">上次使用</th>
              <th class="py-2 px-3">状态</th>
              <th class="py-2 px-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.tokens as t}
              <tr class="hover:bg-muted/40 transition-colors">
                <td class="py-2.5 px-3 font-medium text-foreground">
                  {t.user_name || t.name}
                </td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                  {t.uid}
                </td>
                <td class="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                  {t.prefix}...
                </td>
                <td class="py-2.5 px-3 text-[11px] text-muted-foreground">
                  {t.device_count || 0} 台设备
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                  {new Date(t.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                  {t.last_used ? new Date(t.last_used).toLocaleString('zh-CN') : '从未'}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap">
                  {#if t.revoked_at}
                    <span class="rounded bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px]">已吊销</span>
                  {:else}
                    <span class="rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px]">正常</span>
                  {/if}
                </td>
                <td class="py-2.5 px-3 text-right">
                  {#if !t.revoked_at}
                    <form
                      action="?/revokeToken"
                      method="POST"
                      use:enhance={() => {
                        if (!confirm(`确认吊销用户「${t.user_name || t.name}」的专属令牌吗？该用户的所有设备将立刻失去同步权限。`)) return () => {};
                        return async ({ update }) => update();
                      }}
                      class="inline"
                    >
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" class="text-destructive hover:underline text-[11px]">
                        吊销
                      </button>
                    </form>
                  {:else}
                    <span class="text-muted-foreground text-[11px]">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<!-- 新建用户弹窗 -->
{#if createModalOpen}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
    <div class="w-full max-w-sm rounded-lg border border-border bg-card p-5 space-y-4 shadow-lg">
      <div>
        <h3 class="text-sm font-semibold text-foreground">添加家庭组用户</h3>
        <p class="text-xs text-muted-foreground mt-1">创建新用户并自动生成专属唯一的同步 Token（支持该用户多端设备登录）</p>
      </div>

      <form
        action="?/createToken"
        method="POST"
        use:enhance={() => {
          return async ({ update }) => {
            createModalOpen = false;
            tokenName = '';
            update();
          };
        }}
        class="space-y-3"
      >
        <div>
          <label for="name" class="block text-xs font-medium text-foreground mb-1">用户姓名 / 昵称</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            bind:value={tokenName}
            placeholder="例如: 爸爸、妈妈、我的手机"
            class="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div class="flex justify-end space-x-2 pt-2">
          <button
            type="button"
            onclick={() => (createModalOpen = false)}
            class="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            取消
          </button>
          <button
            type="submit"
            class="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
          >
            创建用户与 Token
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
