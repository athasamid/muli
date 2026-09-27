const { contextBridge, ipcRenderer } = require('electron')

// Registration is idempotent: re-registering a callback replaces the old
// one instead of stacking duplicate listeners.
function listen(channel, cb) {
    ipcRenderer.removeAllListeners(channel)
    ipcRenderer.on(channel, (_, d) => cb(d))
}

contextBridge.exposeInMainWorld('system', {
    check: () => ipcRenderer.invoke('system:check'),
    stats: () => ipcRenderer.invoke('system:stats')
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

    sendEnter: () => ipcRenderer.send('mole:send-enter'),
    sendSkip: () => ipcRenderer.send('mole:send-skip'),
    sendPassword: (password) => ipcRenderer.send('mole:send-password', password)
})
