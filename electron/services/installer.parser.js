const { parseSize } = require('./size.util')

// Parses the `mo installer --dry-run` selector list (rendered once when
// stdout is not a TTY) into installer entries. Line shape after ANSI strip:
//   "➤ ○ balenaEtcher-2.1.7-arm64.dmg              154.7MB | Downloads"
// Pure module (no Electron) so it can be tested standalone.

function parseInstallerList(output) {
    const items = []

    for (const rawLine of output.split(/\r?\n|\r/)) {
        const line = rawLine.replace(/^[➤\s]*/, '').trim()
        const match = line.match(/^[○●]\s+(.+?)\s{2,}([\d.]+\s*[KMGT]?B)\s*\|\s*(.+)$/)
        if (!match) continue

        const name = match[1].trim()
        const extension = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'other').toLowerCase()
        items.push({
            name,
            size: match[2].trim(),
            bytes: parseSize(match[2]),
            location: match[3].trim(),
            type: extension
        })
    }

    return items
}

module.exports = { parseInstallerList }
