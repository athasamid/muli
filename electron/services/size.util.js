// Parses mole's human sizes ("380.3MB", "3.02GB", "0B") into bytes.
// Pure module so parsers and tests can share it.
const UNITS = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 }

function parseSize(text) {
    if (typeof text !== 'string') return 0
    const match = text.trim().match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/i)
    if (!match) return 0
    return Math.round(Number(match[1]) * (UNITS[match[2].toUpperCase()] ?? 1))
}

function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`
    return `${bytes} B`
}

module.exports = { parseSize, formatSize }
