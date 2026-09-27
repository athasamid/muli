const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const STORE_FILE = path.join(app.getPath('userData'), 'store.json')

function read() {
    try {
        if (!fs.existsSync(STORE_FILE)) return {}
        return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    } catch {
        // Corrupt store — start fresh rather than crash on every get()
        return {}
    }
}

function write(data) {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data))
}

module.exports = {
    get(key) {
        return read()[key]
    },
    set(key, value) {
        const data = read()
        data[key] = value
        write(data)
    }
}
