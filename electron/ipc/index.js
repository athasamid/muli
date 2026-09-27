const { ipcMain } = require('electron')
const Log = require('../services/log.service')
const registerMoleIpc = require('./mole.ipc')
const registerSystemIpc = require('./system.ipc')
const registerHistoryIpc = require('./history.ipc')
const registerUpdaterIpc = require('./updater.ipc')

// Dev only: echo every incoming IPC message to the terminal before its
// handler runs. Password payloads are never printed.
function traceIpc() {
    for (const method of ['on', 'handle']) {
        const original = ipcMain[method].bind(ipcMain)
        ipcMain[method] = (channel, handler) =>
            original(channel, (event, ...args) => {
                const shown = channel.includes('password') ? ['(hidden)'] : args
                Log.log('ipc', channel, ...shown)
                return handler(event, ...args)
            })
    }
}

module.exports = function registerIpc() {
    if (Log.enabled) traceIpc()
    registerSystemIpc()
    registerHistoryIpc()
    registerUpdaterIpc()
    registerMoleIpc()
}
