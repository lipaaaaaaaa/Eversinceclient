import Settings from "../config"
const InteractionHand = Java.type("net.minecraft.world.InteractionHand")
const KeyMapping = Java.type("net.minecraft.client.KeyMapping")

const starts = [
    "[BOSS] Goldor: Don't think you can hide from me",
    "[BOSS] Goldor: Who dares trespass into my domain?",
    "[BOSS] Goldor: Little ants,plotting and scheming",
    "[BOSS] Goldor: I won",
    "[BOSS] Goldor: No one matches me in close quarters."
] // I HATE REGEX

const coords = [106,124,113,94,124,113,23,132,138,27,124,127,2,122,55,14,122,55,84,121,34,86,128,46,62,133,142,62,136,142,60,135,142,60,134,142,58,136,142,58,133,142]

const levers = new Set()
for (let i = 0; i < coords.length; i += 3) {levers.add(coords.slice(i,i + 3).join(","))}

const clicked = new Set()
let pressed = false

function reset(why) {
    clicked.clear()
   // ChatLib.chat("levtb reset: " + why)
}

// allowed: Set of "x,y,z" keys, or null for any block. done: Set of keys already clicked.
// Queues a vanilla right click so the game sends it at the start of the next tick.
function clickBlock(allowed, done) {
    const mc = Client.getMinecraft()
    const hit = mc.hitResult
    if(!hit || hit.getType().toString() !== "BLOCK") return false

    const p = hit.getBlockPos()
    const key = p.getX() + "," + p.getY() + "," + p.getZ()
    if((allowed && !allowed.has(key)) || done.has(key)) return false

    KeyMapping.click(mc.options.keyUse.getDefaultKey())
    mc.options.keyUse.setDown(true)
    pressed = true
    done.add(key)
    //ChatLib.chat("levtb click: " + key)
    return true
}

register("tick",() => {
    if(pressed) {
        Client.getMinecraft().options.keyUse.setDown(false)
        pressed = false
    }
    if(!Settings.levtb) return
    clickBlock(levers, clicked)
})

register("command",() => {
    ChatLib.chat(clickBlock(null, new Set()) ? "clicked" : "nothing clicked")
}).setName("clickblocktest")

register("chat",(msg) => {
    const text = ChatLib.removeFormatting(msg)
    if(starts.some((s) => text.includes(s))) {reset("start message")}
})

register("worldUnload",() => {
    reset("world unload")
})