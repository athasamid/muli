<script setup lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
  import { Bell, LogOut, User } from 'lucide-vue-next'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
  import { Button } from '@/components/ui/button'
  import AppSidebar from '@/components/app/Sidebar.vue'
  import ModeToggle from '@/components/app/ModeToggle.vue'
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <slot />
  </div>
</template>
