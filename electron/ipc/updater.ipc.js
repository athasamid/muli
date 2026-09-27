const { ipcMain } = require('electron')
const Updater = require('../services/updater.service')

module.exports = function registerUpdaterIpc() {
    ipcMain.on('update:check', Updater.check)
    ipcMain.on('update:download', Updater.download)
}
