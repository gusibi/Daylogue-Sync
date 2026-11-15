<script lang="ts">
  import '../../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  const navItems = [
    { href: '/overview', label: '概览', icon: '📊' },
    { href: '/data', label: '数据明细', icon: '📋' },
    { href: '/media', label: '媒体文件', icon: '🖼️' },
    { href: '/devices', label: '连接设备', icon: '📱' },
    { href: '/tokens', label: '访问令牌', icon: '🔑' },
    { href: '/settings', label: '系统设置', icon: '⚙️' }
  ];

  let isDark = $state(false);

  $effect(() => {
    isDark = document.documentElement.classList.contains('dark');
  });

  function toggleDark() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }
</script>

<div class="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
  <!-- 侧边导航 -->
  <aside class="w-full md:w-60 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col shrink-0">
    <div class="h-14 flex items-center justify-between px-4 border-b border-border">
      <div class="flex items-center space-x-2.5">
        <img src="/logo.png" alt="Daylogue Logo" class="h-6 w-6 rounded-md object-contain" />
        <span class="text-base font-semibold tracking-tight">Daylogue</span>
        <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Sync</span>
      </div>
      <button
        type="button"
        onclick={toggleDark}
        class="h-7 w-7 rounded-md border border-border flex items-center justify-center text-xs hover:bg-muted transition-colors"
        title="切换主题"
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    </div>

    <nav class="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {#each navItems as item}
        {@const active = $page.url.pathname.startsWith(item.href)}
        <a
          href={item.href}
          class="flex items-center space-x-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors {active
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
        >
          <span class="text-sm">{item.icon}</span>
          <span>{item.label}</span>
        </a>
      {/each}
    </nav>

    <div class="p-3 border-t border-border">
      <form action="/logout" method="POST">
        <button
          type="submit"
          class="w-full rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-center"
        >
          退出登录
        </button>
      </form>
    </div>
  </aside>

  <!-- 主体内容区 -->
  <main class="flex-1 flex flex-col min-w-0 overflow-y-auto max-h-screen">
    {@render children()}
  </main>
</div>
