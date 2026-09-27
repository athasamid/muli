const { contextBridge, ipcRenderer } = require('electron')

// Registration is idempotent: re-registering a callback replaces the old
// one instead of stacking duplicate listeners.
function listen(channel, cb) {
    ipcRenderer.removeAllListeners(channel)
    ipcRenderer.on(channel, (_, d) => cb(d))
}

contextBridge.exposeInMainWorld('system', {
    check: () => ipcRenderer.invoke('system:check'),
    stats: () => ipcRenderer.invoke('system:stats'),
    disks: () => ipcRenderer.invoke('system:disks')
})

// 'history' would collide with the built-in window.history and make
// contextBridge throw, killing the rest of this preload script.
contextBridge.exposeInMainWorld('moleHistory', {
    list: () => ipcRenderer.invoke('history:list')
})

contextBridge.exposeInMainWorld('updater', {
    check: () => ipcRenderer.send('update:check'),
    download: () => ipcRenderer.send('update:download'),
    onStatus: (cb) => listen('update:status', cb)
})

contextBridge.exposeInMainWorld('mole', {
    check: () => ipcRenderer.invoke('mole:check'),

    install: () => ipcRenderer.send('mole:install'),
    onInstallLog: (cb) => listen('mole:install:log', cb),
    onInstallPassword: (cb) => listen('mole:install:password', cb),
    onInstallEnd: (cb) => listen('mole:install:end', cb),

    clean: (opts) => ipcRenderer.send('mole:clean', opts),
    cancel: () => ipcRenderer.send('mole:cancel'),
    onCleanSection: (cb) => listen('mole:clean:section', cb),
    onCleanItem: (cb) => listen('mole:clean:item', cb),
    onCleanSummary: (cb) => listen('mole:clean:summary', cb),
    onCleanLog: (cb) => listen('mole:clean:log', cb),
    onCleanStatus: (cb) => listen('mole:clean:status', cb),
    onCleanPasswordRequest: (cb) => listen('mole:clean:password', cb),
    onCleanPasswordError: (cb) => listen('mole:clean:password-error', cb),
    onCleanConfirm: (cb) => listen('mole:clean:confirm', cb),
    onCleanEnd: (cb) => listen('mole:clean:end', cb),

    optimize: (opts) => ipcRenderer.send('mole:optimize', opts),
    onOptimizeLog: (cb) => listen('mole:optimize:log', cb),
    onOptimizePassword: (cb) => listen('mole:optimize:password', cb),
    onOptimizeEnd: (cb) => listen('mole:optimize:end', cb),

    listUninstallApps: () => ipcRenderer.invoke('mole:uninstall:list'),
    onUninstallScanStatus: (cb) => listen('mole:uninstall:scan-status', cb),
    uninstall: (appNames) => ipcRenderer.send('mole:uninstall', appNames),
    onUninstallLog: (cb) => listen('mole:uninstall:log', cb),
    onUninstallStatus: (cb) => listen('mole:uninstall:status', cb),
    onUninstallPassword: (cb) => listen('mole:uninstall:password', cb),
    onUninstallEnd: (cb) => listen('mole:uninstall:end', cb),

    sendEnter: () => ipcRenderer.send('mole:send-enter'),
    sendSkip: () => ipcRenderer.send('mole:send-skip'),
    sendPassword: (password) => ipcRenderer.send('mole:send-password', password)
})
