import Settings from "../config"
import { debugp, p } from "../utils"

const smallCapsMap = {
    'a': 'ａ', 'b': 'ｂ', 'c': 'ｃ', 'd': 'ｄ', 'e': 'ｅ',
    'f': 'ｆ', 'g': 'ｇ', 'h': 'ｈ', 'i': 'ｉ', 'j': 'ｊ',
    'k': 'ｋ', 'l': 'ｌ', 'm': 'ｍ', 'n': 'ｎ', 'o': 'ｏ',
    'p': 'ｐ', 'q': 'ｑ', 'r': 'ｒ', 's': 'ｓ', 't': 'ｔ',
    'u': 'ｕ', 'v': 'ｖ', 'w': 'ｗ', 'x': 'ｘ', 'y': 'ｙ', 'z': 'ｚ'
};

function toSmallCaps(text) {
    return text.replace(/[a-z]/gi, char => smallCapsMap[char.toLowerCase()] || char);
}

let resending = false 

register("messageSent", (message, event) => {
    if (!Settings.smallcapschat || resending) return
    if (message.startsWith("/")) return 

    const converted = toSmallCaps(message)
    if (converted === message) return 

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

register("command", () => {
    Settings.smallcapschat = !Settings.smallcapschat
    p(`Chat bypass: ${Settings.smallcapschat ? "ON" : "OFF"}`)
}).setName("chatbypasstoggle").setAliases("cbt")

export { toSmallCaps }