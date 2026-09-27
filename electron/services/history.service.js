const crypto = require('crypto')
const Storage = require('./storage.service')

function record({ operation, startedAt, success, error, dryRun = false, targets = [], summary = null }) {
    const endedAt = new Date().toISOString()
    Storage.appendHistory({
        id: crypto.randomUUID(),
        operation,
        startedAt,
        endedAt,
        durationMs: Date.now() - new Date(startedAt).getTime(),
        success,
        error: error || null,
        dryRun,
        targets: Array.isArray(targets) ? targets.slice(0, 50) : [],
        summary
    })
}

module.exports = { record, list: () => Storage.listHistory() }
