const { app, shell, BrowserWindow } = require('electron')
const https = require('https')
const Log = require('./log.service')

const REPO = 'athasamid/muli'
let updateUrl = null

function send(channel, payload) {
    Log.log('updater', channel, payload)
    BrowserWindow.getAllWindows().forEach((win) => win.webContents.send(channel, payload))
}

function requestRelease() {
    return new Promise((resolve, reject) => {
        https.get({ hostname: 'api.github.com', path: `/repos/${REPO}/releases/latest`, headers: { 'User-Agent': 'Muli' } }, (response) => {
            let body = ''
            response.on('data', (chunk) => { body += chunk })
            response.on('end', () => {
                if (response.statusCode !== 200) return reject(new Error(`release_check_failed_${response.statusCode}`))
                try { resolve(JSON.parse(body)) } catch (error) { reject(error) }
            })
        }).on('error', reject)
    })
}

function versionGreater(remote, local) {
    const a = remote.replace(/^v/, '').split('.').map(Number)
    const b = local.replace(/^v/, '').split('.').map(Number)
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
        const difference = (a[index] || 0) - (b[index] || 0)
        if (difference !== 0) return difference > 0
    }
    return false
}

async function check() {
    updateUrl = null
    send('update:status', { state: 'checking' })
    try {
        const release = await requestRelease()
        if (!versionGreater(release.tag_name, app.getVersion())) return send('update:status', { state: 'not-available' })
        const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
        const asset = release.assets.find((item) => item.name === `Muli-${arch}.dmg`)
        updateUrl = asset?.browser_download_url || release.html_url
        send('update:status', { state: 'available', version: release.tag_name.replace(/^v/, '') })
    } catch (error) {
        send('update:status', { state: 'error', error: error.message })
    }
}

function download() {
    if (updateUrl) shell.openExternal(updateUrl)
}

module.exports = { check, download }
