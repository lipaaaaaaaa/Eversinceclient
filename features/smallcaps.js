// smallcaps.js — ChatTriggers 3.0 (Fabric 1.21.10)
// Toggled by Settings.smallcapschat ("Small Caps Chat" in Misc).
// When on, any chat message you send is cancelled and re-sent with the
// latin alphabet replaced by small caps glyphs. Only plain chat is touched —
// commands (/...) are left alone so they don't get mangled.

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

let resending = false // guard so our own re-send doesn't loop forever

register("chat", (message) => {
    if (!Settings.smallcapschat) return
    if (resending) return          // this is our re-sent copy -> let it through untouched
    if (message.startsWith("/")) return // never touch commands

    cancel(message)
    const converted = toSmallCaps(message)

    if (converted === message) return // nothing to change (no latin letters) -> try once, no-op

    resending = true
    try {
        ChatLib.say(converted)
    } finally {
        resending = false
    }

    debugp(`smallcaps: sent "${converted}"`)
}).setCriteria("&r&").allowMissingArgs(true)

export { toSmallCaps }
