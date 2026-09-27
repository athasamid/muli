const registerMoleIpc = require('./mole.ipc')
const registerSystemIpc = require('./system.ipc')

module.exports = function registerIpc() {
    registerSystemIpc()
    registerMoleIpc()
}