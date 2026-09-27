const stripAnsi = require('strip-ansi').default

// Parses `mo clean` pty output into UI events. Pure module (no Electron)
// so it can be tested standalone. `emit(channel, payload)` receives:
//   mole:clean:section | item | summary | log | status
//   mole:clean:confirm | password | password-error
//
// Prompts never end with a newline, so they are detected on the
// unterminated tail of the output buffer instead of on full lines.
const PROMPTS = [
    {
        // "System caches need sudo — Enter continue, Space skip:"
        test: /Enter.*continue.*Space.*skip/i,
        event: 'mole:clean:confirm'
    },
    {
        test: /Password:\s*$/,
        event: 'mole:clean:password'
    }
]

function createCleanParser(emit) {
    let buffer = ''
    let lastPromptEvent = null
    let passwordAttempt = 0

    function handleLine(text) {
        text = text.trim()
        if (!text) return

        // Prompt echoes / hints — not useful as list items
        if (/Enter.*continue.*Space.*skip/i.test(text)) return
        if (/Password:?\s*$/.test(text)) return
        if (/Touch ID dialog may appear/.test(text)) return

        if (/Incorrect password/i.test(text) || /Password cannot be empty/i.test(text)) {
            // mole re-prompts by itself; renderer just shows the error
            emit('mole:clean:password-error', { text })
            return
        }

        if (/Admin access (granted|already available)/i.test(text)) {
            emit('mole:clean:status', { type: 'admin_granted', text })
            return
        }

        if (/Authentication failed/i.test(text)) {
            emit('mole:clean:status', { type: 'admin_failed', text })
            return
        }

        // SECTION HEADER
        if (text.startsWith('➤')) {
            emit('mole:clean:section', {
                title: text.replace('➤', '').trim()
            })
            return
        }

        // CLEANED ITEM
        if (text.startsWith('✓')) {
            const match = text.match(/✓\s(.+?)(?:\s\((.+)\))?$/)
            emit('mole:clean:item', {
                label: match?.[1] ?? text,
                size: match?.[2] ?? null,
                status: 'cleaned'
            })
            return
        }

        // SKIPPED ITEM
        if (text.startsWith('◎') || text.includes('skipped')) {
            emit('mole:clean:item', {
                label: text.replace(/^◎/, '').trim(),
                status: 'skipped'
            })
            return
        }

        // SUMMARY
        if (text.includes('Cleanup complete') || text.includes('Space freed')) {
            emit('mole:clean:summary', { raw: text })
            return
        }

        // FALLBACK LOG
        emit('mole:clean:log', { text })
    }

    function detectPrompt() {
        const tail = buffer.trim()
        for (const prompt of PROMPTS) {
            if (!prompt.test.test(tail)) continue
            // The buffer tail persists across data events until a newline
            // consumes it — emit each prompt only once per appearance.
            if (lastPromptEvent === prompt.event) return
            lastPromptEvent = prompt.event

            const payload = {}
            if (prompt.event === 'mole:clean:password') {
                payload.attempt = ++passwordAttempt
            }
            emit(prompt.event, payload)
            return
        }
    }

    return {
        feed(chunk) {
            buffer += stripAnsi(chunk)

            // mole redraws progress lines with bare \r — treat as line breaks
            const lines = buffer.split(/\r\n|\n|\r/)
            buffer = lines.pop()
            if (lines.length > 0) lastPromptEvent = null

            lines.forEach(handleLine)
            detectPrompt()
        },
        flush() {
            if (buffer.trim()) handleLine(buffer)
            buffer = ''
        }
    }
}

module.exports = { createCleanParser }
