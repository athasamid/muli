// Detects which subcommands the installed Mole supports by parsing
// `mo --help`, so the UI can disable unsupported features gracefully.
// Pure parse function kept separate for tests.

const KNOWN = [
    'clean',
    'uninstall',
    'optimize',
    'analyze',
    'status',
    'history',
    'purge',
    'installer',
    'touchid'
]

function parseCapabilities(helpText) {
    const caps = {}
    for (const command of KNOWN) {
        caps[command] = new RegExp(`^\\s*mo ${command}\\b`, 'm').test(helpText)
    }
    return caps
}

module.exports = { parseCapabilities, KNOWN }
