<script setup lang="ts">
import {
  AppWindow,
  ChartPie,
  Code2,
  Gauge,
  HardDrive,
  History,
  LayoutDashboard,
  Package,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-vue-next'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'

// `cap` names the Mole capability a feature needs; items whose capability
// is missing on the installed Mole render disabled.
const capabilities = ref<Record<string, boolean> | null>(null)

onMounted(async () => {
  try {
    capabilities.value = await (window as any).mole?.capabilities?.() ?? null
  } catch {
    capabilities.value = null
  }
})

function unsupported(item: { cap?: string }) {
  if (!item.cap || !capabilities.value) return false
  return capabilities.value[item.cap] === false
}

const groups = [
  {
    label: 'Cleanup',
    items: [
      { label: 'Overview', icon: LayoutDashboard, href: '/dashboard' },
      { label: 'Smart Clean', icon: Trash2, href: '/dashboard', cap: 'clean' },
      { label: 'Developer Files', icon: Code2, href: '/developer', cap: 'purge' },
      { label: 'Installers', icon: Package, href: '/installer', cap: 'installer' },
    ],
  },
  {
    label: 'Storage',
    items: [
      { label: 'Storage Analyzer', icon: ChartPie, href: '/storage', cap: 'analyze' },
      { label: 'Volumes', icon: HardDrive, href: '/disk' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Uninstall Apps', icon: AppWindow, href: '/uninstall', cap: 'uninstall' },
      { label: 'Optimize', icon: Gauge, href: '/optimize', cap: 'optimize' },
      { label: 'History', icon: History, href: '/history', cap: 'history' },
    ],
  },
]
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader class="flex flex-row items-center gap-2.5 px-3 py-3">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0070eb]">
        <Sparkles class="h-4.5 w-4.5 text-white" />
      </div>
      <div class="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
        <span class="text-[13px] font-semibold">Mole</span>
        <span class="text-[11px] text-muted-foreground">System Utility</span>
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup v-for="group in groups" :key="group.label">
        <SidebarGroupLabel class="text-[10px] font-semibold uppercase tracking-widest">
          {{ group.label }}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in group.items" :key="item.label">
              <NuxtLink v-if="!unsupported(item)" :to="item.href">
                <SidebarMenuButton
                  class="cursor-pointer"
                  :is-active="item.href === $route.path"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                  <span>{{ item.label }}</span>
                </SidebarMenuButton>
              </NuxtLink>
              <SidebarMenuButton v-else class="cursor-default opacity-50" disabled title="This feature needs a newer version of Mole">
                <component :is="item.icon" class="h-4 w-4" />
                <span>{{ item.label }}</span>
                <span class="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">
                  Update Mole
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-default opacity-50" disabled>
            <Settings class="h-4 w-4" />
            <span>Settings</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
</template>
