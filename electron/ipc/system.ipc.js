const { ipcMain } = require('electron')
const { execFile } = require('child_process')
const os = require('os')
const fs = require('fs')

let cachedMacosVersion = null

function getMacosVersion() {
    return new Promise((resolve) => {
        if (cachedMacosVersion) return resolve(cachedMacosVersion)
        execFile('sw_vers', ['-productVersion'], (err, stdout) => {
            cachedMacosVersion = err ? null : stdout.trim()
            resolve(cachedMacosVersion)
        })
    })
}

// os.freemem() on macOS ignores reclaimable memory and always reads ~99%
// used, so derive "available" from vm_stat (free + inactive + purgeable).
function getAvailableMemory() {
    return new Promise((resolve) => {
        execFile('vm_stat', (err, stdout) => {
            if (err) return resolve(os.freemem())
            const pageSize = Number(stdout.match(/page size of (\d+)/)?.[1] ?? 16384)
            let pages = 0
            for (const key of ['Pages free', 'Pages inactive', 'Pages purgeable']) {
                pages += Number(stdout.match(new RegExp(`${key}:\\s+(\\d+)`))?.[1] ?? 0)
            }
            resolve(pages > 0 ? pages * pageSize : os.freemem())
        })
    })
}

module.exports = function registerSystemIpc() {
    ipcMain.handle('system:check', () => {
        return {
            platform: process.platform,
            release: os.release()
        }
    })

    ipcMain.handle('system:stats', async () => {
        let disk = null
        try {
            const s = fs.statfsSync('/')
            disk = {
                total: s.blocks * s.bsize,
                free: s.bavail * s.bsize
            }
        } catch {
            // disk stats unavailable — UI hides the card
        }

        const totalMem = os.totalmem()
        const available = await getAvailableMemory()
        const cpus = os.cpus()

        return {
            username: os.userInfo().username,
            hostname: os.hostname().replace(/\.local$/, ''),
            macosVersion: await getMacosVersion(),
            arch: process.arch,
            disk,
            memory: {
                total: totalMem,
                used: Math.max(totalMem - available, 0)
            },
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model ?? null,
                // 1-minute load average relative to core count (0..1+)
                load: os.loadavg()[0] / Math.max(cpus.length, 1)
            }
        }
    })
}
