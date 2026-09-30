const { test } = require('node:test')
const assert = require('node:assert')
const { parseSize, formatSize } = require('../electron/services/size.util')
const { parsePurgePreview, categorize } = require('../electron/services/purge.parser')
const { parseInstallerList } = require('../electron/services/installer.parser')
const { parseCapabilities } = require('../electron/services/capabilities')

test('parseSize handles mole size strings', () => {
    assert.equal(parseSize('380.3MB'), 380300000)
    assert.equal(parseSize('3.02GB'), 3020000000)
    assert.equal(parseSize('0B'), 0)
    assert.equal(parseSize('49KB'), 49000)
    assert.equal(parseSize('garbage'), 0)
})

test('formatSize renders human sizes', () => {
    assert.equal(formatSize(3020000000), '3.02 GB')
    assert.equal(formatSize(0), '0 B')
})

test('parsePurgePreview extracts items, categories and warnings', () => {
    const fixture = [
        '→ DRY RUN MODE, No project artifacts will be removed',
        '',
        'Purge Project Artifacts',
        '',
        '◎ Skipped 1 project scan root because scanning did not complete:',
        '  ~/Projects (status 124)',
        "Re-run with 'mo purge --debug' to inspect the scan failure.",
        '',
        '✓ [DRY RUN] ~/Downloads/site/node_modules, 380.3MB',
        '✓ [DRY RUN] ~/Downloads/site/.next, 360KB',
        '✓ [DRY RUN] ~/www/theme/dist, 33.6MB'
    ].join('\n')

    const result = parsePurgePreview(fixture)
    assert.equal(result.items.length, 3)
    assert.equal(result.items[0].category, 'Node modules')
    assert.equal(result.items[1].category, 'Build output')
    assert.equal(result.items[0].bytes, 380300000)
    assert.equal(result.warnings.length, 2)
    assert.equal(result.totalBytes, 380300000 + 360000 + 33600000)
})

test('categorize maps developer artifact paths', () => {
    assert.equal(categorize('~/Library/Developer/Xcode/DerivedData/App-x'), 'Xcode DerivedData')
    assert.equal(categorize('~/proj/Pods'), 'CocoaPods')
    assert.equal(categorize('~/proj/target'), 'Compiled targets')
    assert.equal(categorize('~/proj/something-else'), 'Other artifacts')
})

test('parseInstallerList extracts selector rows', () => {
    const fixture = [
        '→ DRY RUN MODE, No installer files will be removed',
        'Select Installers to Remove , 0B, 0 selected',
        '➤ ○ CapCut_764_installer.dmg    3.6MB | Downloads',
        '  ○ Volume License.pkg         11.5MB | Downloads',
        '  ○ Muli-arm64 (1).dmg        112.1MB | Downloads',
        '↑↓  |  Space Select  |  Enter Confirm  |  A All  |  I Invert  |  Q Quit'
    ].join('\n')

    const items = parseInstallerList(fixture)
    assert.equal(items.length, 3)
    assert.equal(items[0].name, 'CapCut_764_installer.dmg')
    assert.equal(items[0].type, 'dmg')
    assert.equal(items[1].type, 'pkg')
    assert.equal(items[2].name, 'Muli-arm64 (1).dmg')
    assert.equal(items[2].bytes, 112100000)
    assert.equal(items[0].location, 'Downloads')
})

test('parseCapabilities detects supported commands from mo --help', () => {
    const fixture = [
        'COMMANDS',
        '  mo clean                     Free up disk space',
        '  mo uninstall                 Remove apps completely',
        '  mo analyze                   Explore disk usage',
        '  mo history                   Review cleanup activity',
        '  mo purge                     Remove old project artifacts'
    ].join('\n')

    const caps = parseCapabilities(fixture)
    assert.equal(caps.analyze, true)
    assert.equal(caps.purge, true)
    assert.equal(caps.installer, false)
    assert.equal(caps.status, false)
})
