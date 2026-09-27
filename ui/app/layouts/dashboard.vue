<script setup lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
  import { Bell, LogOut, User } from 'lucide-vue-next'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
  import { Button } from '@/components/ui/button'
  import AppSidebar from '@/components/app/Sidebar.vue'
  import ModeToggle from '@/components/app/ModeToggle.vue'
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <!-- <header class="flex h-16 shrink-0 items-center shadow-md gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div class="flex w-full flex-row justify-between items-center gap-2 px-4">
          <div class="flex items-center gap-2">
            <SidebarTrigger class="-ml-1" />
            <h1 class="text-2xl font-bold">{{  'Admin Panel' }}</h1>
          </div>
        
          <div class="flex items-center gap-2">
            <ModeToggle />
            <Button  variant="outline" class="inline-flex items-center justify-center">
              <Bell class="size-4" />
              <span class="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <Avatar>
                    <AvatarFallback>{{  }}</AvatarFallback>
                  </Avatar> 
                  <div class="flex flex-col items-start">
                    <span class="text-sm font-medium">{{  'Admin' }}</span>
                    <span class="text-xs text-muted-foreground">{{  '' }}</span>
                  </div>
                </div>
              </DropdownMenuTrigger>
                <DropdownMenuContent class="w-56" align="end">
                  <DropdownMenuItem>
                    <User class="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header> -->
      <div class="flex flex-1 flex-col gap-4 p-4 pt-0">
        <slot class="p-4 lg:p-6 min-h-[calc(100vh-4rem)]" />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
