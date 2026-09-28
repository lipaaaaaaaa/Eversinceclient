// smallcaps.js — ChatTriggers 3.0 (Fabric 1.21.10)
// Toggled by Settings.smallcapschat ("Small Caps Chat" in Misc).
// When on, any plain chat message you send is cancelled and re-sent with the
// latin alphabet replaced by small caps glyphs. Commands (/...) are left
// alone so they don't get mangled.
//
// How it works: CT 3.0's "chat" trigger only fires for INCOMING messages and
// its ChatTrigger has no allowMissingArgs() (that caused the load error), so
// instead we poll the vanilla chat screen every tick. If the user pressed
// enter while it was open, vanilla already cleared the screen and started
// sending the original text; we detect that moment (previous-tick text still
// sitting in the history queue), remove it, and re-send the converted copy
// via ChatLib.say().

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
let lastInput = ""    // what was in the chat screen's text box last tick

register("tick", () => {
    if (!Settings.smallcapschat) { lastInput = ""; return }
    if (resending) return

    const mc = Client.getMinecraft()
    let screen = null
    try { screen = mc.screen } catch (e) { return }

    // ChatScreen class name differs by mappings; match loosely.
    const isChatScreen = screen != null && /ChatScreen/.test(String(screen.getClass().getName()))

    if (isChatScreen) {
        // remember exactly what the user was about to send
        try { lastInput = String(screen.input ?? "") } catch (e) { lastInput = "" }
        return
    }

    // Screen closed this tick. If it closed while holding non-empty text,
    // vanilla treated that as "press enter" and is sending `lastInput`.
    const sentText = lastInput
    lastInput = ""
    if (!sentText || sentText.startsWith("/")) return // never touch commands

    const converted = toSmallCaps(sentText)
    if (converted === sentText) return // no latin letters -> nothing to do

    // Try to undo the vanilla send before the packet goes out (~1 tick window):
    //  - remove it from the chat history queue (it was pushed on submit)
    //  - remove any echo line already drawn for it
    try {
        const gw = mc.gui
        const idx = gw.getChatHistory().indexOf(sentText)
        if (idx !== -1) gw.getChatHistory().remove(idx)
    } catch (e) { debugp(`smallcaps: history cleanup failed (${e})`) }
    try {
        const gt = mc.inGameHud.chat
        const lines = gt.getLines()
        for (let i = lines.size() - 1; i >= 0; i--) {
            const line = lines.get(i)
            let t = ""
            try { t = String(line.getContents?.()?.getString?.() ?? line.getString?.() ?? "") } catch (e) {}
            if (t.includes(sentText)) { gt.removeMessage(line); break }
        }
    } catch (e) { /* echo may not have rendered yet; server copy is what matters */ }

    // Re-send the converted message once.
    resending = true
    try {
        ChatLib.say(converted)
        debugp(`smallcaps: re-sent "${converted}"`)
    } catch (e) {
        debugp(`smallcaps: say() failed (${e})`)
    } finally {
        resending = false
    }
})

export { toSmallCaps }
