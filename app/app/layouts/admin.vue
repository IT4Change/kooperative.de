<template>
  <div class="min-h-screen bg-gray-100 text-gray-800 flex">
    <!-- Sidebar -->
    <aside class="w-56 shrink-0 bg-[#1f2d3d] text-gray-200 flex flex-col min-h-screen">
      <div class="px-4 py-4 border-b border-white/10">
        <NuxtLink to="/admin" class="flex items-center gap-2">
          <span class="text-lg font-bold text-white">Kooperative</span>
        </NuxtLink>
        <p class="text-[11px] uppercase tracking-wide text-gray-400 mt-0.5">Administration</p>
      </div>
      <nav class="flex-1 py-2 text-sm">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2 px-4 py-2.5 hover:bg-white/10 transition"
          :class="isActive(item) ? 'bg-[#00af8c] text-white font-medium' : 'text-gray-200'"
        >
          <span>{{ item.label }}</span>
          <span v-if="item.badge && pendingCount > 0" class="ml-auto text-[11px] font-semibold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5">{{ pendingCount }}</span>
          <span v-else-if="item.readonly" class="ml-auto text-[10px] uppercase text-gray-400 border border-gray-500 rounded px-1">nur Anzeige</span>
        </NuxtLink>
      </nav>
      <div class="px-4 py-3 border-t border-white/10 text-[11px] text-gray-400">
        Neuer Shop · Admin
      </div>
    </aside>

    <!-- Content -->
    <div class="flex-1 min-w-0 flex flex-col">
      <header class="bg-white border-b border-gray-200 px-6 py-3">
        <h1 class="text-base font-semibold text-gray-800">{{ pageTitle }}</h1>
      </header>
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
interface NavItem { label: string, to: string, readonly?: boolean, badge?: boolean, match?: string[] }

const nav: NavItem[] = [
  { label: 'Übersicht', to: '/admin' },
  // Pending orders are merged into the order list — the badge shows how many await confirmation.
  { label: 'Bestellungen', to: '/admin/orders', match: ['/admin/orders', '/admin/pending'], badge: true },
  { label: 'Produkte', to: '/admin/products', match: ['/admin/products'], readonly: true },
  { label: 'Kunden', to: '/admin/customers', match: ['/admin/customers'], readonly: true },
]

// Badge: count of orders awaiting customer confirmation.
const { data: dash } = await useFetch<{ pendingCount: number }>('/admin/api/dashboard')
const pendingCount = computed(() => dash.value?.pendingCount ?? 0)

const route = useRoute()
function isActive(item: NavItem): boolean {
  if (item.match) return item.match.some(m => route.path.startsWith(m))
  return route.path === item.to
}

const pageTitle = computed(() => {
  const active = nav.find(isActive)
  return active?.label ?? 'Administration'
})
</script>
