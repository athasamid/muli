const { ipcMain } = require('electron')
const History = require('../services/history.service')

module.exports = function registerHistoryIpc() {
    ipcMain.handle('history:list', () => History.list())
}
