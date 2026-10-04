import Settings from "../config"

const File = Java.type("java.io.File")
const FileWriter = Java.type("java.io.FileWriter")
const FileReader = Java.type("java.io.FileReader")
const BufferedReader = Java.type("java.io.BufferedReader")

const configDir = new File("./config/ChatTriggers/modules/Eversinceclient/features/data/")
const configFile = new File(configDir, "DBTB.json")

let editMode = false
let wasUse = false
let holdingAttack = false
let whitelist = new Set()

const mc = Client.getMinecraft()
const BLOCK = Java.type("net.minecraft.world.phys.HitResult$Type").BLOCK
const MAIN_HAND = Java.type("net.minecraft.world.InteractionHand").MAIN_HAND
const ActionPacket = Java.type("net.minecraft.network.protocol.game.ServerboundPlayerActionPacket")
const DestroyAction = Java.type("net.minecraft.network.protocol.game.ServerboundPlayerActionPacket$Action")

function loadWhitelist() {
    try {
        if (!configFile.exists()) {
            saveWhitelist()
            return
        }

        const reader = new BufferedReader(new FileReader(configFile))
        let content = ""
        let line

        while ((line = reader.readLine()) != null) {
            content += line
        }
        reader.close()

        if (content.length > 0) {
            whitelist = new Set(JSON.parse(content))
        }
    } catch (e) {
        ChatLib.chat("Error loading whitelist: " + e)
    }
}

function saveWhitelist() {
    try {
        if (!configDir.exists()) {
            configDir.mkdirs()
        }

        const writer = new FileWriter(configFile)
        writer.write(JSON.stringify(Array.from(whitelist), null, 2))
        writer.close()
    } catch (e) {
        ChatLib.chat("Error saving whitelist: " + e)
    }
}

function keyOf(pos) {
    return pos.getX() + "," + pos.getY() + "," + pos.getZ()
}

function holdingDB() {
    const stack = mc.player.getMainHandItem()
    return !stack.isEmpty() && stack.getHoverName().getString().includes("Dungeonbreaker")
}

// hitResult is already limited to vanilla reach
function target() {
    const hit = mc.hitResult
    return hit && hit.getType() === BLOCK ? hit : null
}

function releaseAttack() {
    if (!holdingAttack) return
    mc.options.keyAttack.setDown(false)
    holdingAttack = false
}

function reset() {
    wasUse = false
    releaseAttack()
}

function isInstantBreak(pos) {
    return mc.level.getBlockState(pos).getDestroyProgress(mc.player, mc.level, pos) >= 1
}

function toggleEdit() {
    editMode = !editMode
    releaseAttack()
    ChatLib.chat("Dungeonbreaker edit mode: " + (editMode ? "ON" : "OFF"))
}

function runEdit(hit) {
    const use = mc.options.keyUse.isDown()

    if (use && !wasUse && hit && whitelist.delete(keyOf(hit.getBlockPos()))) {
        saveWhitelist()
        ChatLib.chat("Removed from whitelist")
    }
    wasUse = use
}

function onBreakPacket(packet) {
    if (!Settings.dbtb || !editMode) return
    if (packet.getAction().toString() !== "START_DESTROY_BLOCK") return

    const key = keyOf(packet.getPos())
    if (whitelist.has(key)) return

    whitelist.add(key)
    saveWhitelist()
}

function breakBlock(pos, direction) {
    mc.getConnection().send(new ActionPacket(DestroyAction.START_DESTROY_BLOCK, pos, direction))
    mc.getConnection().send(new ActionPacket(DestroyAction.STOP_DESTROY_BLOCK, pos, direction))
}

function runBreak(hit) {
    if (!hit || !whitelist.has(keyOf(hit.getBlockPos()))) return releaseAttack()

    const pos = hit.getBlockPos()
    if (isInstantBreak(pos)) {
        releaseAttack()
        breakBlock(pos, hit.getDirection())
        mc.player.swing(MAIN_HAND)
        return
    }

    // vanilla mining: hold attack so the client keeps its own break progress
    mc.options.keyAttack.setDown(true)
    holdingAttack = true
}

function onTick() {
    if (!Settings.dbtb || !mc.player || !mc.level || mc.screen || !holdingDB()) return reset()
    if (editMode) runEdit(target())
    else runBreak(target())
}

function testBreak() {
    const hit = target()
    if (!hit) return ChatLib.chat("Not looking at a block in reach")

    const pos = hit.getBlockPos()
    if (!isInstantBreak(pos)) return ChatLib.chat("Not an instant break here, auto-break mines it normally")

    breakBlock(pos, hit.getDirection())
    mc.player.swing(MAIN_HAND)
    ChatLib.chat("Sent break at " + keyOf(pos))
}

function onWorldUnload() {
    reset()
}

register("command", () => {
    toggleEdit()
}).setName("dbedit")

register("command", () => {
    testBreak()
}).setName("dbtest")

register("packetSent", (packet) => {
    onBreakPacket(packet)
}).setFilteredClass(ActionPacket)

register("tick", () => {
    onTick()
})

register("worldUnload", () => {
    onWorldUnload()
})

loadWhitelist()