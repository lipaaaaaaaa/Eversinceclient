// smallcaps.js — ChatTriggers 3.0 (Fabric 1.21.10)
// Toggled by Settings.smallcapschat ("Small Caps Chat" in Misc).
// When on, any plain chat message you send is cancelled and re-sent with the
// latin alphabet replaced by small caps glyphs. Commands (/...) are left
// alone so they don't get mangled.

import Settings from "../config"
import { debugp } from "../utils"

const smallCapsMap = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ',
    'f': 'ғ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ',
    'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ',
    'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ',
    'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ'
}

function toSmallCaps(text) {
    let out = ""
    for (const char of text) {
        const mapped = smallCapsMap[char.toLowerCase()]
        out += mapped !== undefined ? mapped : char
    }
    return out
}

let resending = false // guard so our own re-send doesn't get intercepted again

register("messageSent", (message, event) => {
    if (!Settings.smallcapschat || resending) return
    if (message.startsWith("/")) return // never touch commands

    const converted = toSmallCaps(message)
    if (converted === message) return // no latin letters, let vanilla send it

    cancel(event)

    resending = true
    try {
        ChatLib.say(converted)
        debugp(`smallcaps: sent "${converted}"`)
    } catch (e) {
        debugp(`smallcaps: say() failed (${e})`)
    } finally {
        resending = false
    }
})

export { toSmallCaps }