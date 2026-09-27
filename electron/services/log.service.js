const { app } = require('electron')

// Dev-only terminal logging (npm run dev). Enabled automatically when the
// app is unpackaged; force it on a packaged build with MULI_DEBUG=1.
const enabled = !app.isPackaged || process.env.MULI_DEBUG === '1'

function timestamp() {
    return new Date().toISOString().slice(11, 23)
}

function log(tag, ...args) {
    if (!enabled) return
    console.log(`[${timestamp()}] [${tag}]`, ...args)
}

module.exports = { log, enabled }
