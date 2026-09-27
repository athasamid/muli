<script setup lang="ts">
import { HardDrive, RefreshCw } from 'lucide-vue-next'

definePageMeta({ title: 'Disk', layout: 'dashboard' })

interface Disk { device: string; mount: string; total: number; used: number; free: number; capacity: string }
const disks = ref<Disk[]>([])
const loading = ref(true)
const error = ref('')

function bytes(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} GB`
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)} MB`
  return `${value} B`
}

async function load() {
  loading.value = true
  error.value = ''
  try { disks.value = await (window as any).system.disks() } catch { error.value = 'Disk information is unavailable.' }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-[960px] px-6 py-8">
    <div class="mb-8 flex items-start justify-between gap-4"><div><h1 class="text-2xl font-bold tracking-tight">Disk</h1><p class="mt-1 text-sm text-muted-foreground">Mounted volume capacity and available space.</p></div><Button variant="outline" size="sm" @click="load"><RefreshCw class="h-4 w-4" /> Refresh</Button></div>
    <div v-if="loading" class="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Reading disks…</div>
    <div v-else-if="error" class="rounded-xl border bg-card p-6 text-sm text-destructive">{{ error }}</div>
    <div v-else class="space-y-4"><div v-for="disk in disks" :key="`${disk.device}-${disk.mount}`" class="rounded-xl border bg-card p-5"><div class="flex items-start justify-between gap-4"><div class="flex min-w-0 gap-3"><HardDrive class="mt-0.5 h-5 w-5 text-primary" /><div class="min-w-0"><h2 class="font-semibold">{{ disk.mount }}</h2><p class="truncate text-sm text-muted-foreground">{{ disk.device }}</p></div></div><span class="font-semibold">{{ disk.capacity }}</span></div><div class="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div class="h-full bg-primary" :style="{ width: disk.capacity }" /></div><div class="mt-3 flex justify-between text-sm text-muted-foreground"><span>{{ bytes(disk.used) }} used</span><span>{{ bytes(disk.free) }} free of {{ bytes(disk.total) }}</span></div></div></div>
  </div>
</template>
