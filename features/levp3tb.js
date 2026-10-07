import Settings from "../config"
import {senduseitem} from "../utils"
const InteractionHand = Java.type("net.minecraft.world.InteractionHand")

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

function reset() {clicked.clear()}

register("tick",() => {
    //if(!Settings.levtb) return
    const mc = Client.getMinecraft()
    const hit = mc.hitResult
    if(!hit || hit.getType().toString() !== "BLOCK") return

    const p = hit.getBlockPos()
    const key = p.getX() + "," + p.getY() + "," + p.getZ()
    if(!levers.has(key) || clicked.has(key)) return

    clicked.add(key)
    senduseitem()
    mc.player.swing(InteractionHand.MAIN_HAND)
})

register("chat",(msg) => {
const text = ChatLib.removeFormatting(msg)
if(starts.some((s) => text.includes(s))) {reset()}})

register("worldUnload",() => {reset()})