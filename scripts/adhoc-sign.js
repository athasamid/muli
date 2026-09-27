// electron-builder afterPack hook: give the app a VALID ad-hoc signature.
// Without any signature Gatekeeper reports a quarantined download as
// "damaged" (dead end for users); with a valid ad-hoc one it becomes
// "unverified developer", which users can bypass via right-click → Open
// (macOS ≤ 14) or System Settings → Open Anyway (macOS 15+) — no Terminal.
// Skipped automatically when real Developer ID signing is configured.
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function adhocSign(context) {
    if (context.electronPlatformName !== 'darwin') return
    if (process.env.CSC_LINK || process.env.CSC_NAME) return

    const appPath = path.join(
        context.appOutDir,
        `${context.packager.appInfo.productFilename}.app`
    )
    console.log(`  • ad-hoc signing ${appPath}`)
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' })
    execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' })
}
