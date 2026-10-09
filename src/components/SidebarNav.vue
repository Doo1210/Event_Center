<template>
  <div>
    <div v-if="open" class="ec-sidebar-scrim" @click="$emit('close')" />
    <aside class="ec-sidebar" :class="{ 'is-open': open }" aria-label="主导航">
      <div class="ec-sidebar-brand">
        <span class="ec-sidebar-brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="5.5"/><path d="M12 8.5v3.8l2.4 1.3"/></svg>
        </span>
        <span class="ec-sidebar-brand__copy"><strong>工业智能平台</strong><small>INDUSTRIAL AI</small></span>
      </div>

      <div class="ec-sidebar-tenant"><span><i />默认工作空间</span><span aria-hidden="true">⌄</span></div>

      <nav class="ec-sidebar-nav" aria-label="功能导航">
        <span class="ec-sidebar-label">工作台</span>
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">⌂</span>工作概览</button>
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">⬡</span>智能体</button>
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">▤</span>工作流</button>

        <span class="ec-sidebar-label">事件驱动</span>
        <button type="button" class="ec-sidebar-item is-active" aria-current="page" @click="$emit('center')"><span class="ec-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 12h3l2-6 4 12 2-6h5"/><circle cx="12" cy="12" r="9"/></svg></span>事件中心</button>

        <span class="ec-sidebar-label">资源管理</span>
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">▧</span>资源库</button>
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">◉</span>工具管理</button>
      </nav>

      <div class="ec-sidebar-bottom">
        <button type="button" class="ec-sidebar-item" @click="$emit('static-click')"><span class="ec-sidebar-icon" aria-hidden="true">⚙</span>系统设置</button>
        <div class="ec-sidebar-profile"><span class="ec-sidebar-avatar">A</span><span><strong>admin</strong><small>系统管理员</small></span></div>
      </div>
    </aside>
  </div>
</template>

<script>
export default {
  name: 'SidebarNav',
  props: { open: { type: Boolean, default: false } },
};
</script>
