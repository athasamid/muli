const os = require('os')
const fs = require('fs')
const path = require('path')
const pty = require('node-pty')
const { BrowserWindow } = require('electron')
const Storage = require('./storage.service')
const stripAnsi = require('strip-ansi').default
const { createCleanParser } = require('./mole.parser')

// GUI apps launched from Finder/Dock don't inherit the shell PATH
// (they only get /usr/bin:/bin:/usr/sbin:/sbin), so mole's install
// locations must be searched explicitly.
const KNOWN_BIN_DIRS = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    path.join(os.homedir(), '.local', 'bin')
]
const BIN_NAMES = ['mo', 'mole']

const INSTALL_CMD =
    'curl -fsSL https://raw.githubusercontent.com/tw93/mole/main/install.sh | bash'

// Single operation at a time (clean OR install). node-pty process.
let activeProcess = null

function buildEnv() {
    const basePath = process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin'
    return {
        ...process.env,
        PATH: `${KNOWN_BIN_DIRS.join(':')}:${basePath}`,
        LANG: process.env.LANG || 'en_US.UTF-8'
    }
}

function detectMole() {
    for (const dir of KNOWN_BIN_DIRS) {
        for (const name of BIN_NAMES) {
            const p = path.join(dir, name)
            if (fs.existsSync(p)) return p
        }
    }
    return null
}

function resolveMolePath() {
    const saved = Storage.get('molePath')
    if (saved && fs.existsSync(saved)) return saved

    const detected = detectMole()
    if (detected) Storage.set('molePath', detected)
    return detected
}

async function check() {
    // Dev-only: force the install flow without touching the real install
    // (MULI_SIMULATE_NOT_INSTALLED=1 npm run dev)
    if (process.env.MULI_SIMULATE_NOT_INSTALLED === '1') {
        return { status: 'not_installed' }
    }

    const molePath = resolveMolePath()
    return molePath
        ? { status: 'ready', path: molePath }
        : { status: 'not_installed' }
}

// ============================================================
// Operations
// ============================================================

function spawnPty(command, args, onData, onExit) {
    const proc = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 32,
        cwd: os.homedir(),
        env: buildEnv()
    })
    proc.onData(onData)
    proc.onExit(onExit)
    return proc
}

function clean(event, opts = {}) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (activeProcess) return

    const molePath = resolveMolePath()
    if (!molePath) {
        win.webContents.send('mole:clean:end', {
            success: false,
            error: 'mole_not_found'
        })
        return
    }

    const args = ['clean']
    if (opts.dryRun) args.push('--dry-run')

    const parser = createCleanParser((channel, payload) =>
        win.webContents.send(channel, payload)
    )

    try {
        activeProcess = spawnPty(
            molePath,
            args,
            (chunk) => parser.feed(chunk),
            ({ exitCode }) => {
                parser.flush()
                activeProcess = null
                win.webContents.send('mole:clean:end', {
                    success: exitCode === 0
                })
            }
        )
    } catch (err) {
        activeProcess = null
        win.webContents.send('mole:clean:end', {
            success: false,
            error: err.message
        })
    }
}

function install(event) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (activeProcess) return

    let buffer = ''

    try {
        activeProcess = spawnPty(
            'bash',
            ['-c', INSTALL_CMD],
            (chunk) => {
                const text = stripAnsi(chunk)
                buffer += text
                win.webContents.send('mole:install:log', text)

                // The installer may need sudo to write into /usr/local/bin
                if (/Password:\s*$/.test(buffer.trim())) {
                    buffer = ''
                    win.webContents.send('mole:install:password')
                }
            },
            ({ exitCode }) => {
                activeProcess = null

                if (exitCode !== 0) {
                    win.webContents.send('mole:install:end', { success: false })
                    return
                }

                const detected = detectMole()
                if (detected) {
                    Storage.set('molePath', detected)
                    win.webContents.send('mole:install:end', {
                        success: true,
                        path: detected
                    })
                } else {
                    win.webContents.send('mole:install:end', { success: false })
                }
            }
        )
    } catch (err) {
        activeProcess = null
        win.webContents.send('mole:install:end', {
            success: false,
            error: err.message
        })
    }
}

// ============================================================
// User responses (written into the pty, like typing in a terminal)
// ============================================================

function sendPassword(event, password) {
    if (!activeProcess || typeof password !== 'string') return
    activeProcess.write(password + '\r')
    password = null
}

function sendEnter() {
    if (!activeProcess) return
    activeProcess.write('\r')
}

function sendSkip() {
    if (!activeProcess) return
    activeProcess.write(' ')
}

function cancel() {
    if (!activeProcess) return
    try {
        activeProcess.kill()
    } catch {
        // already dead
    }
    activeProcess = null
}

module.exports = {
    check,
    install,
    clean,
    sendPassword,
    sendEnter,
    sendSkip,
    cancel
}
