<script setup lang="ts">
import { Download, RefreshCw, X } from 'lucide-vue-next'
import AppSidebar from '@/components/app/Sidebar.vue'

interface UpdateStatus { state: string; version?: string }
const update = ref<UpdateStatus>({ state: 'idle' })
const dismissed = ref(false)
let updater: any

onMounted(() => {
  updater = (window as any).updater
  updater?.onStatus?.((status: UpdateStatus) => { update.value = status })
})

function checkUpdate() {
  dismissed.value = false
  if (!updater) return
  updater.check()
}

function downloadUpdate() {
  if (!updater) return
  updater.download()
}
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <div v-if="update.state === 'available' && !dismissed" class="mx-4 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <div class="flex-1"><strong>Muli {{ update.version }} tersedia.</strong> Unduh DMG lalu ganti aplikasi lama.</div>
        <Button size="sm" @click="downloadUpdate"><Download class="h-4 w-4" /> Download update</Button>
        <Button size="icon" variant="ghost" @click="dismissed = true"><X class="h-4 w-4" /></Button>
      </div>
      <div class="flex items-center justify-end px-4 pt-3"><Button size="sm" variant="ghost" :disabled="!updater || update.state === 'checking'" @click="checkUpdate"><RefreshCw class="h-4 w-4" :class="update.state === 'checking' ? 'animate-spin' : ''" /> Check update</Button></div>
      <div class="flex flex-1 flex-col gap-4 p-4 pt-0"><slot class="p-4 lg:p-6 min-h-[calc(100vh-4rem)]" /></div>
    </SidebarInset>
  </SidebarProvider>
</template>
