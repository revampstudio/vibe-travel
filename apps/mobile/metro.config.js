const { getDefaultConfig } = require('expo/metro-config')
const config = getDefaultConfig(__dirname)
// Useful on CI or a workstation whose Watchman service is unavailable.
if (process.env.VIBE_NO_WATCHMAN === '1') config.resolver.useWatchman = false
module.exports = config
