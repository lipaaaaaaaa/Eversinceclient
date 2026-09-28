// smallcaps.js — ChatTriggers 3.0 (Fabric 1.21.10)
// Toggled by Settings.smallcapschat ("Small Caps Chat" in Misc).
// When on, any plain chat message you send is cancelled and re-sent with the
// latin alphabet replaced by fullwidth glyphs. Commands (/...) are left
// alone so they don't get mangled.

import Settings from "../config"
import { debugp } from "../utils"

const smallCapsMap = {
    'a': 'ａ', 'b': 'ｂ', 'c': 'ｃ', 'd': 'ｄ', 'e': 'ｅ',
    'f': 'ｆ', 'g': 'ｇ', 'h': 'ｈ', 'i': 'ｉ', 'j': 'ｊ',
    'k': 'ｋ', 'l': 'ｌ', 'm': 'ｍ', 'n': 'ｎ', 'o': 'ｏ',
    'p': 'ｐ', 'q': 'ｑ', 'r': 'ｒ', 's': 'ｓ', 't': 'ｔ',
    'u': 'ｕ', 'v': 'ｖ', 'w': 'ｗ', 'x': 'ｘ', 'y': 'ｙ', 'z': 'ｚ'
};

/**
 * Converts standard English letters in a string to fullwidth characters.
 * @param {string} text The input string to convert.
 * @returns {string} The formatted string.
 */
function toSmallCaps(text) {
    return text.replace(/[a-z]/gi, char => smallCapsMap[char.toLowerCase()] || char);
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
      //  ChatLib.chat(converted)
        ChatLib.say(converted)
        debugp(`smallcaps: sent "${converted}"`)
    } catch (e) {
      ChatLib.chat(`smallcaps fired: ${message}`)
    } finally {
        resending = false
    }
})

export { toSmallCaps }