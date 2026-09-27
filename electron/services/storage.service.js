const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const STORE_FILE = path.join(app.getPath('userData'), 'store.json')

function read() {
    try {
        if (!fs.existsSync(STORE_FILE)) return {}
        return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'))
    } catch {
        return {}
    }
}

function write(data) {
    const tempFile = `${STORE_FILE}.tmp`
    fs.writeFileSync(tempFile, JSON.stringify(data))
    fs.renameSync(tempFile, STORE_FILE)
}

module.exports = {
    get(key) {
        return read()[key]
    },
    set(key, value) {
        const data = read()
        data[key] = value
        write(data)
    },
    appendHistory(entry) {
        const data = read()
        const history = Array.isArray(data.history) ? data.history : []
        data.history = [entry, ...history].slice(0, 100)
        write(data)
    },
    listHistory() {
        const history = read().history
        return Array.isArray(history) ? history : []
    }
}
