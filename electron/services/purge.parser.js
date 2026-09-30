const { parseSize } = require('./size.util')

// Parses `mo purge --dry-run` output into artifact entries and warnings.
// Line shape: "✓ [DRY RUN] ~/path/node_modules, 380.3MB"
// Pure module (no Electron) so it can be tested standalone.

const CATEGORY_RULES = [
    { test: /node_modules$/, category: 'Node modules' },
    { test: /DerivedData(\/|$)/, category: 'Xcode DerivedData' },
    { test: /Xcode\/Archives(\/|$)/, category: 'Xcode Archives' },
    { test: /(^|\/)Pods$/, category: 'CocoaPods' },
    { test: /(^|\/)(\.next|\.nuxt|\.output|\.svelte-kit|\.turbo|dist|build|out)$/, category: 'Build output' },
    { test: /(^|\/)target$/, category: 'Compiled targets' },
    { test: /(^|\/)(\.venv|venv|__pycache__)$/, category: 'Python environments' },
    { test: /(^|\/)\.gradle(\/|$)/, category: 'Gradle cache' }
]

function categorize(artifactPath) {
    for (const rule of CATEGORY_RULES) {
        if (rule.test.test(artifactPath)) return rule.category
    }
    return 'Other artifacts'
}

function parsePurgePreview(output) {
    const items = []
    const warnings = []

    for (const rawLine of output.split(/\r?\n|\r/)) {
        const line = rawLine.trim()
        if (!line) continue

        const item = line.match(/^✓\s*(?:\[DRY RUN\]\s*)?(.+),\s*([\d.]+\s*[KMGT]?B)$/)
        if (item) {
            const itemPath = item[1].trim()
            items.push({
                path: itemPath,
                size: item[2].trim(),
                bytes: parseSize(item[2]),
                category: categorize(itemPath)
            })
            continue
        }

        if (line.startsWith('◎') || /^Re-run with/.test(line)) {
            warnings.push(line.replace(/^◎\s*/, ''))
        }
    }

    const totalBytes = items.reduce((sum, item) => sum + item.bytes, 0)
    return { items, warnings, totalBytes }
}

module.exports = { parsePurgePreview, categorize }
