const { ipcMain } = require('electron')
const MoleService = require('../services/mole.service')

module.exports = function registerMoleIpc() {
    ipcMain.handle('mole:check', MoleService.check)
    ipcMain.on('mole:install', MoleService.install)
    ipcMain.on('mole:clean', MoleService.clean)
    ipcMain.on('mole:optimize', MoleService.optimize)
    ipcMain.handle('mole:uninstall:list', MoleService.listUninstallApps)
    ipcMain.on('mole:uninstall', MoleService.uninstall)
    ipcMain.on('mole:cancel', MoleService.cancel)
    ipcMain.on('mole:send-enter', MoleService.sendEnter)
    ipcMain.on('mole:send-skip', MoleService.sendSkip)
    ipcMain.on('mole:send-password', MoleService.sendPassword)
}
