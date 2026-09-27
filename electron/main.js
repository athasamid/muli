const { app, BrowserWindow } = require('electron')
const path = require('path')
const serve = require('electron-serve')
const registerIpc = require('./ipc')
const MoleService = require('./services/mole.service')

let win

const isDev = !app.isPackaged

// The packaged app gets its name/icon from electron-builder (productName +
// build/icon.png); this fixes the menu bar and Dock during development.
app.setName('Muli')

// Nuxt emits absolute asset paths (/_nuxt/...), which break under file://,
// so the packaged build is served over the app:// protocol instead.
const loadProd = isDev
    ? null
    : serve({ directory: path.join(__dirname, '../ui/.output/public') })

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    if (isDev) {
        win.loadURL('http://localhost:3000')
        win.webContents.openDevTools()
    } else {
        loadProd(win)
    }
}

app.whenReady().then(() => {
    if (isDev && process.platform === 'darwin') {
        try {
            app.dock.setIcon(path.join(__dirname, '../build/icon.png'))
        } catch {
            // dev-only nicety
        }
    }

    createWindow()
    registerIpc()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Don't leave a running mo clean (and its sudo keepalive) behind
app.on('before-quit', () => {
    MoleService.cancel()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
