<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let loading = $state(false);
  let showPassword = $state(false);
  let keyInput = $state('');
</script>

<svelte:head>
  <title>常记 Daylogue · 登录控制台</title>
</svelte:head>

<div class="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#FBF9F5] dark:bg-[#0C0C0D] text-foreground selection:bg-neutral-900 selection:text-white dark:selection:bg-neutral-100 dark:selection:text-black transition-colors duration-300">
  <!-- 背景细腻微柔光装饰 -->
  <div class="fixed inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
    <div class="w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-orange-200/20 to-red-100/10 dark:from-neutral-800/20 dark:to-neutral-900/10 blur-3xl"></div>
  </div>

  <div class="w-full max-w-[360px] relative z-10 flex flex-col items-center">
    <!-- 品牌标志卡片 -->
    <div class="relative group mb-6">
      <div class="absolute -inset-1 rounded-2xl bg-gradient-to-b from-neutral-200/50 to-transparent dark:from-neutral-700/30 blur-sm opacity-60"></div>
      <div class="relative w-28 h-28 rounded-2xl overflow-hidden bg-[#FAF5ED] border border-black/[0.08] dark:border-white/[0.1] shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.02]">
        <img
          src="/logo.png"
          alt="常记 Daylogue"
          class="w-full h-full object-cover"
        />
      </div>
    </div>

    <!-- 登录卡片容器 -->
    <div class="w-full rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white/80 dark:bg-[#161618]/90 backdrop-blur-xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      <div class="text-center mb-6">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-2">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          同步服务控制台
        </div>
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          请输入部署时配置的管理密钥
        </p>
      </div>

      <form
        method="POST"
        use:enhance={() => {
          loading = true;
          return async ({ update }) => {
            loading = false;
            update();
          };
        }}
        class="space-y-4"
      >
        <div>
          <label for="adminKey" class="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300 mb-1.5 ml-0.5">
            访问密钥 (ADMIN_KEY)
          </label>
          <div class="relative">
            <input
              id="adminKey"
              name="adminKey"
              type={showPassword ? 'text' : 'password'}
              required
              autofocus
              bind:value={keyInput}
              placeholder="••••••••••••"
              autocomplete="current-password"
              class="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 px-3.5 py-2.5 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-white/20 focus:border-neutral-900 dark:focus:border-white transition-all font-mono tracking-wider pr-10"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 text-xs p-1 rounded transition-colors"
              tabindex="-1"
              title={showPassword ? '隐藏密钥' : '显示密钥'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {#if form?.error}
          <div class="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 p-2.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in duration-200">
            <span>⚠️</span>
            <span>{form.error}</span>
          </div>
        {/if}

        <button
          type="submit"
          disabled={loading || !keyInput}
          class="w-full rounded-xl bg-neutral-900 dark:bg-white px-4 py-2.5 text-xs font-semibold text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {#if loading}
            <span class="inline-block w-3.5 h-3.5 border-2 border-white/20 dark:border-black/20 border-t-white dark:border-t-black rounded-full animate-spin"></span>
            <span>验证中...</span>
          {:else}
            <span>解锁控制台</span>
            <span class="text-[10px] opacity-70">↵</span>
          {/if}
        </button>
      </form>
    </div>

    <!-- 底部状态与协议信息 -->
    <div class="mt-6 text-center space-y-1">
      <div class="text-[11px] text-neutral-400 dark:text-neutral-600 font-mono tracking-tight">
        Daylogue Sync v0.1 · Cloudflare D1 / R2
      </div>
      <div class="text-[10px] text-neutral-400/80 dark:text-neutral-600/80">
        所有数据均由自托管服务端进行增量同步
      </div>
    </div>
  </div>
</div>
