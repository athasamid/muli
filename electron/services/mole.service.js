const os = require('os')
const fs = require('fs')
const path = require('path')
const pty = require('node-pty')
const { execFile } = require('child_process')
const { BrowserWindow, shell } = require('electron')
const Storage = require('./storage.service')
const stripAnsi = require('strip-ansi').default
const { createCleanParser } = require('./mole.parser')
const { parsePurgePreview } = require('./purge.parser')
const { parseInstallerList } = require('./installer.parser')
const { parseCapabilities } = require('./capabilities')
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

// Read-only scans (analyze / purge preview / installer list) get their own
// slot so a long scan never blocks a cleanup and vice versa.
let activeScan = null

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

function shQuote(value) {
    return `'${String(value).replace(/'/g, `'\\''`)}'`
}

// mo emits machine-readable output only when stdout is NOT a TTY, but live
// spinner progress only when the terminal IS one. Running it in a pty with
// stdout redirected to a temp file gives both: progress lines stream to the
// UI on statusChannel while the real output lands in the file.
// `allowPartial` accepts a non-zero exit when output was still produced
// (e.g. purge skipping one scan root that timed out).
function runScanToFile(event, args, statusChannel, { allowPartial = false } = {}) {
    const win = BrowserWindow.fromWebContents(event.sender)
    const molePath = resolveMolePath()
    Log.log('mole', 'scan requested:', JSON.stringify(args))
    if (!molePath) {
        Log.log('mole', 'scan blocked: mole binary not found')
        return Promise.reject(new Error('mole_not_found'))
    }
    if (activeScan) {
        Log.log('mole', 'scan blocked: another scan is still running')
        return Promise.reject(new Error('scan_in_progress'))
    }

    const outFile = path.join(os.tmpdir(), `muli-scan-${Date.now()}.out`)
    const command = `${shQuote(molePath)} ${args.map(shQuote).join(' ')} > ${shQuote(outFile)}`

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
                win.webContents.send(statusChannel, { line: trimmed })
            }
        }

        try {
            activeScan = spawnPty(
                'sh',
                ['-c', command],
                emitStatus,
                ({ exitCode }) => {
                    activeScan = null
                    const finalLine = pendingLine.trim()
                    if (finalLine) {
                        lastLine = finalLine
                        win.webContents.send(statusChannel, { line: finalLine })
                    }

                    let output = ''
                    try {
                        // Some commands (e.g. installer's selector) still
                        // write ANSI control codes into redirected stdout.
                        output = stripAnsi(fs.readFileSync(outFile, 'utf8'))
                    } catch {
                        // scan failed before producing output
                    }
                    try {
                        fs.unlinkSync(outFile)
                    } catch {
                        // never created, or already gone
                    }

                    if (exitCode !== 0 && !(allowPartial && output.trim())) {
                        return reject(new Error(lastLine || `scan_failed_exit_${exitCode}`))
                    }
                    resolve({ output, exitCode, lastLine })
                }
            )
        } catch (err) {
            activeScan = null
            reject(err)
        }
    })
}

function cancelScan() {
    if (!activeScan) return
    Log.log('mole', 'cancel: killing active scan')
    try {
        activeScan.kill()
    } catch {
        // already dead
    }
    activeScan = null
}

async function listUninstallApps(event) {
    const { output, lastLine } = await runScanToFile(
        event,
        ['uninstall', '--list'],
        'mole:uninstall:scan-status'
    )
    try {
        const apps = JSON.parse(output)
        Log.log('mole', `uninstall list: ${apps.length} apps`)
        return apps
    } catch {
        Log.log('mole', 'uninstall list: invalid JSON output', output.slice(0, 200))
        throw new Error(lastLine || 'scan_invalid_output')
    }
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

// ============================================================
// Disk analyzer (mo analyze --json)
// ============================================================

async function analyze(event, opts = {}) {
    const scanPath = typeof opts.path === 'string' && opts.path.trim() ? opts.path.trim() : null

    if (scanPath) {
        if (!path.isAbsolute(scanPath) || !fs.existsSync(scanPath)) {
            throw new Error('invalid_path')
        }
    } else if (!opts.refresh) {
        // The machine-wide overview takes minutes; serve the cached scan and
        // let the UI offer an explicit rescan.
        const cached = Storage.get('analyzeOverview')
        if (cached?.data) return { ...cached.data, scannedAt: cached.at, cached: true }
    }

    const args = scanPath ? ['analyze', '--json', scanPath] : ['analyze', '--json']
    const { output, lastLine } = await runScanToFile(event, args, 'mole:analyze:status')

    let data
    try {
        data = JSON.parse(output)
    } catch {
        Log.log('mole', 'analyze: invalid JSON output', output.slice(0, 200))
        throw new Error(lastLine || 'scan_invalid_output')
    }

    const scannedAt = new Date().toISOString()
    if (!scanPath) Storage.set('analyzeOverview', { at: scannedAt, data })
    return { ...data, scannedAt, cached: false }
}

// ============================================================
// Developer cleanup (mo purge)
// ============================================================

async function purgePreview(event) {
    const { output, exitCode } = await runScanToFile(
        event,
        ['purge', '--dry-run'],
        'mole:purge:scan-status',
        { allowPartial: true }
    )
    const preview = parsePurgePreview(output)
    Log.log('mole', `purge preview: ${preview.items.length} artifacts, exit ${exitCode}`)
    return preview
}

function purgeRun(event) {
    // The UI shows its own confirmation with the previewed artifacts first;
    // --yes then runs the eligible cleanup unattended.
    runOperation(event, 'purge', ['--yes'], {}, { autoConfirm: true })
}

// ============================================================
// Installer cleanup (mo installer + Electron trash)
// ============================================================

// Only paths returned by the latest installer scan may be trashed — a
// session allowlist so the renderer can never point this at other files.
let trashableInstallers = new Set()

const INSTALLER_LOCATION_DIRS = ['Downloads', 'Desktop', 'Documents']

function resolveInstallerPath(item) {
    const home = os.homedir()
    const candidates = []
    if (INSTALLER_LOCATION_DIRS.includes(item.location)) {
        candidates.push(path.join(home, item.location, item.name))
    }
    if (item.location === 'Home') candidates.push(path.join(home, item.name))
    candidates.push(path.join(home, 'Downloads', item.name))
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

async function installerList(event) {
    const { output } = await runScanToFile(
        event,
        ['installer', '--dry-run'],
        'mole:installer:scan-status'
    )
    const items = parseInstallerList(output).map((item) => ({
        ...item,
        path: resolveInstallerPath(item)
    }))
    trashableInstallers = new Set(items.map((item) => item.path).filter(Boolean))
    Log.log('mole', `installer list: ${items.length} files`)
    return items
}

async function trashInstallers(event, paths) {
    if (!Array.isArray(paths) || paths.length === 0) throw new Error('no_files_selected')
    const startedAt = new Date().toISOString()
    const trashed = []
    const failed = []

    for (const target of paths) {
        if (typeof target !== 'string' || !trashableInstallers.has(target)) {
            failed.push({ path: String(target), error: 'not_in_scan' })
            continue
        }
        try {
            await shell.trashItem(target)
            trashableInstallers.delete(target)
            trashed.push(target)
            Log.log('mole', 'installer trashed:', target)
        } catch (err) {
            failed.push({ path: target, error: err.message })
            Log.log('mole', 'installer trash failed:', target, err.message)
        }
    }

    History.record({
        operation: 'installer',
        startedAt,
        success: failed.length === 0,
        error: failed.length ? `${failed.length} file(s) failed` : null,
        targets: trashed
    })
    return { trashed, failed }
}

// ============================================================
// Mole history + capabilities (piped, structured output)
// ============================================================

function execMoleJson(args) {
    const molePath = resolveMolePath()
    if (!molePath) return Promise.reject(new Error('mole_not_found'))
    return new Promise((resolve, reject) => {
        execFile(molePath, args, { env: buildEnv(), maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
            if (err) return reject(err)
            try {
                resolve(JSON.parse(stdout))
            } catch {
                reject(new Error('invalid_json_output'))
            }
        })
    })
}

async function moleHistory() {
    const data = await execMoleJson(['history', '--json', '--limit', '200'])
    return data
}

let cachedCapabilities = null

function capabilities() {
    if (cachedCapabilities) return Promise.resolve(cachedCapabilities)
    const molePath = resolveMolePath()
    if (!molePath) return Promise.resolve(null)
    return new Promise((resolve) => {
        execFile(molePath, ['--help'], { env: buildEnv() }, (err, stdout, stderr) => {
            // mo --help prints to stderr on some versions and may exit non-zero
            const text = `${stdout || ''}\n${stderr || ''}`
            cachedCapabilities = parseCapabilities(text)
            Log.log('mole', 'capabilities:', JSON.stringify(cachedCapabilities))
            resolve(cachedCapabilities)
        })
    })
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
    analyze,
    purgePreview,
    purgeRun,
    installerList,
    trashInstallers,
    moleHistory,
    capabilities,
    sendPassword,
    sendEnter,
    sendSkip,
    cancel,
    cancelScan
}
