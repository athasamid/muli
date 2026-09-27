const os = require('os')
const fs = require('fs')
const path = require('path')
const pty = require('node-pty')
const { BrowserWindow } = require('electron')
const Storage = require('./storage.service')
const stripAnsi = require('strip-ansi').default
const { createCleanParser } = require('./mole.parser')
const History = require('./history.service')
const Log = require('./log.service')

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
    Log.log('mole', 'spawn:', command, args.join(' '))
    const proc = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 32,
        cwd: os.homedir(),
        env: buildEnv()
    })
    proc.onData((chunk) => {
        if (Log.enabled) {
            for (const line of stripAnsi(chunk).split(/\r?\n|\r/)) {
                const trimmed = line.trim()
                if (trimmed) Log.log('mole', trimmed)
            }
        }
        onData(chunk)
    })
    proc.onExit((event) => {
        Log.log('mole', 'exit:', event.exitCode)
        onExit(event)
    })

    // Every write into the pty is logged too; pass sensitive=true to keep
    // the payload (e.g. a password) out of the terminal.
    const write = proc.write.bind(proc)
    proc.write = (data, sensitive) => {
        Log.log('mole', 'write:', sensitive ? '(hidden)' : JSON.stringify(data))
        write(data)
    }
    return proc
}

function clean(event, opts = {}) {
    const startedAt = new Date().toISOString()
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
                const success = exitCode === 0
                History.record({ operation: 'clean', startedAt, success, dryRun: Boolean(opts.dryRun) })
                win.webContents.send('mole:clean:end', { success })
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

function runOperation(event, operation, args = [], audit = {}, opts = {}) {
    const startedAt = new Date().toISOString()
    const win = BrowserWindow.fromWebContents(event.sender)
    Log.log('mole', `${operation} requested:`, JSON.stringify(args))
    if (activeProcess) {
        Log.log('mole', `${operation} blocked: another operation is still running`)
        win.webContents.send(`mole:${operation}:end`, {
            success: false,
            error: 'operation_in_progress'
        })
        return
    }

    const molePath = resolveMolePath()
    if (!molePath) {
        Log.log('mole', `${operation} blocked: mole binary not found`)
        win.webContents.send(`mole:${operation}:end`, {
            success: false,
            error: 'mole_not_found'
        })
        return
    }

    let buffer = ''
    let pendingLine = ''
    let lastLine = ''

    try {
        activeProcess = spawnPty(
            molePath,
            [operation, ...args],
            (chunk) => {
                const text = stripAnsi(chunk)
                buffer += text
                win.webContents.send(`mole:${operation}:log`, text)
                pendingLine += text
                const lines = pendingLine.split(/\r?\n|\r/)
                pendingLine = lines.pop() || ''
                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed) continue
                    lastLine = trimmed
                    win.webContents.send(`mole:${operation}:status`, { line: trimmed })
                }

                if (/Password:\s*$/.test(buffer.trim())) {
                    buffer = ''
                    Log.log('mole', `${operation}: password prompt -> asking UI`)
                    win.webContents.send(`mole:${operation}:password`)
                }

                // The UI already asked the user before starting, so answer
                // the CLI's own prompts automatically: first "Proceed? [y/N]",
                // then the final "Enter confirm, ESC cancel" summary prompt.
                if (opts.autoConfirm && /\[y\/N\]\s*$/i.test(buffer.trim())) {
                    buffer = ''
                    Log.log('mole', `${operation}: [y/N] prompt -> auto-answered y`)
                    activeProcess.write('y\r')
                }
                if (opts.autoConfirm && /Enter\s+confirm[^\n]*ESC\s+cancel[^\n]*:\s*$/i.test(buffer.trim())) {
                    buffer = ''
                    Log.log('mole', `${operation}: final confirm prompt -> auto-answered enter`)
                    activeProcess.write('\r')
                }
            },
            ({ exitCode }) => {
                activeProcess = null
                const finalLine = pendingLine.trim()
                if (finalLine) {
                    lastLine = finalLine
                    win.webContents.send(`mole:${operation}:status`, { line: finalLine })
                }
                const success = exitCode === 0
                const error = success ? undefined : lastLine || `operation_failed_exit_${exitCode}`
                History.record({ operation, startedAt, success, error, ...audit })
                win.webContents.send(`mole:${operation}:end`, { success, error, exitCode })
            }
        )
    } catch (err) {
        activeProcess = null
        win.webContents.send(`mole:${operation}:end`, {
            success: false,
            error: err.message
        })
    }
}

function optimize(event, opts = {}) {
    runOperation(event, 'optimize', opts.dryRun ? ['--dry-run'] : [], {
        dryRun: Boolean(opts.dryRun)
    })
}

function listUninstallApps(event) {
    const win = BrowserWindow.fromWebContents(event.sender)
    const molePath = resolveMolePath()
    Log.log('mole', 'uninstall list requested')
    if (!molePath) {
        Log.log('mole', 'uninstall list blocked: mole binary not found')
        return Promise.reject(new Error('mole_not_found'))
    }
    if (activeProcess) {
        Log.log('mole', 'uninstall list blocked: another operation is still running')
        return Promise.reject(new Error('operation_in_progress'))
    }

    // mo emits the JSON list only when stdout is NOT a TTY, but live spinner
    // progress on stderr only when stderr IS one. Running it in a pty with
    // stdout redirected to a temp file gives both: progress lines stream to
    // the UI while the JSON lands in the file.
    const outFile = path.join(os.tmpdir(), `muli-uninstall-list-${Date.now()}.json`)

    return new Promise((resolve, reject) => {
        let pendingLine = ''
        let lastLine = ''

        function emitStatus(chunk) {
            pendingLine += stripAnsi(chunk)
            const lines = pendingLine.split(/\r?\n|\r/)
            pendingLine = lines.pop() || ''
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                lastLine = trimmed
                win.webContents.send('mole:uninstall:scan-status', { line: trimmed })
            }
        }

        try {
            activeProcess = spawnPty(
                'sh',
                ['-c', `'${molePath}' uninstall --list > '${outFile}'`],
                emitStatus,
                ({ exitCode }) => {
                    activeProcess = null
                    const finalLine = pendingLine.trim()
                    if (finalLine) {
                        lastLine = finalLine
                        win.webContents.send('mole:uninstall:scan-status', { line: finalLine })
                    }

                    let output = ''
                    try {
                        output = fs.readFileSync(outFile, 'utf8')
                    } catch {
                        // scan failed before producing output
                    }
                    try {
                        fs.unlinkSync(outFile)
                    } catch {
                        // never created, or already gone
                    }

                    if (exitCode !== 0) {
                        return reject(new Error(lastLine || `scan_failed_exit_${exitCode}`))
                    }
                    try {
                        const apps = JSON.parse(output)
                        Log.log('mole', `uninstall list: ${apps.length} apps`)
                        resolve(apps)
                    } catch {
                        Log.log('mole', 'uninstall list: invalid JSON output', output.slice(0, 200))
                        reject(new Error(lastLine || 'scan_invalid_output'))
                    }
                }
            )
        } catch (err) {
            activeProcess = null
            reject(err)
        }
    })
}

function uninstall(event, appNames) {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!Array.isArray(appNames) || appNames.length === 0) {
        win.webContents.send('mole:uninstall:end', {
            success: false,
            error: 'no_apps_selected'
        })
        return
    }

    runOperation(event, 'uninstall', appNames, { targets: appNames }, { autoConfirm: true })
}

function install(event) {
    const startedAt = new Date().toISOString()
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
                    History.record({ operation: 'install', startedAt, success: false })
                    win.webContents.send('mole:install:end', { success: false })
                    return
                }

                const detected = detectMole()
                if (detected) {
                    Storage.set('molePath', detected)
                    History.record({ operation: 'install', startedAt, success: true })
                    win.webContents.send('mole:install:end', {
                        success: true,
                        path: detected
                    })
                } else {
                    History.record({ operation: 'install', startedAt, success: false })
                    win.webContents.send('mole:install:end', { success: false })
                }
            }
        )
    } catch (err) {
        activeProcess = null
        History.record({ operation: 'install', startedAt, success: false, error: err.message })
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
    activeProcess.write(password + '\r', true)
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
    Log.log('mole', 'cancel: killing active process')
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
    optimize,
    listUninstallApps,
    uninstall,
    sendPassword,
    sendEnter,
    sendSkip,
    cancel
}
