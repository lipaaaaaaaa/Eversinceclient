import Settings from "../config"
import { isPlayerInBox } from "../utils"

// ===================================================================
// Text Overlay - movable, config-toggleable HUD text (26.1 mojmap CT)
//
//  /edithud            open the drag editor GUI (test showcase values)
//  /edithud reset      snap back to 0,0 (top-left corner, visible on any screen)
//  /edithud save       force-save position + data
//
//  Rendered string is built from these variables (see buildString):
//     {name}  your username
//     {box}   name of the first zone box you are standing inside
//     {x} {y} {z} your rounded coords
//     format: "name: box" -> `${name}: ${box}`
//
//  Zone boxes live in a SEPARATE json one folder back from the module:
//     ./config/ChatTriggers/data/overlay.json
//  Format (min/max corners, order doesn't matter, isPlayerInBox normalises):
//     [{ "name": "F3", "min": [10, 110, 120], "max": [14, 118, 124] }]
// ===================================================================

const File = Java.type("java.io.File")
const FileWriter = Java.type("java.io.FileWriter")
const FileReader = Java.type("java.io.FileReader")
const BufferedReader = Java.type("java.io.BufferedReader")

const mc = Client.getMinecraft()

// net.minecraft.world.phys.Vec2 via Rhino's automatic mojmap remapping
function V2(x, y) { return new Vec2(x, y) }

function clampPos() {
    const w = mc.getWindow()
    pos.x = Math.max(0, Math.min(pos.x, w.getGuiScaledWidth() - 20))
    pos.y = Math.max(0, Math.min(pos.y, w.getGuiScaledHeight() - 10))
}

// ----- files -------------------------------------------------------
// position/state lives next to the module, the box DATA is one folder back in /data
const stateDir = new File("./config/ChatTriggers/modules/Eversinceclient/")
const stateFile = new File(stateDir, "textoverlay.json")

const dataDir = new File("./config/ChatTriggers/data/")
const dataFile = new File(dataDir, "overlay.json")

// ----- editable state ----------------------------------------------
let pos = { x: 0, y: 0 } // screen pixels, default 0,0 so it shows on every screen
let scale = 1.0
let shadow = true
let showBg = false
let enabledOverride = null // null = follow the Vigilance config switch

let zones = [] // loaded from dataFile
let dirty = false

const DEFAULT_ZONES = [
    { name: "ExampleZone", min: [0, 60, 0], max: [10, 70, 10] },
]

function readText(file) {
    const reader = new BufferedReader(new FileReader(file))
    let content = ""
    let line
    while ((line = reader.readLine()) != null) content += line
    reader.close()
    return content
}

function writeText(file, dir, text) {
    if (!dir.exists()) dir.mkdirs()
    const writer = new FileWriter(file)
    writer.write(text)
    writer.close()
}

function loadState() {
    try {
        if (!stateFile.exists()) { saveState(); return }
        const s = JSON.parse(readText(stateFile))
        pos = { x: Number(s.x) || 0, y: Number(s.y) || 0 }
        scale = Number(s.scale) || 1.0
        shadow = s.shadow !== false
        showBg = s.showBg === true
        if (typeof s.enabled === "boolean") enabledOverride = s.enabled
    } catch (e) {
        ChatLib.chat("&c[Overlay] failed to load position: " + e)
    }
}

function saveState() {
    try {
        writeText(stateFile, stateDir, JSON.stringify({
            x: pos.x, y: pos.y, scale: scale, shadow: shadow,
            showBg: showBg, enabled: enabledOverride,
        }, null, 2))
    } catch (e) {
        ChatLib.chat("&c[Overlay] failed to save position: " + e)
    }
}

function loadData() {
    try {
        if (!dataFile.exists()) {
            zones = DEFAULT_ZONES
            saveData()
            return
        }
        zones = JSON.parse(readText(dataFile))
    } catch (e) {
        ChatLib.chat("&c[Overlay] failed to load data/overlay.json: " + e)
        zones = []
    }
}

function saveData() {
    try {
        writeText(dataFile, dataDir, JSON.stringify(zones, null, 2))
    } catch (e) {
        ChatLib.chat("&c[Overlay] failed to save data/overlay.json: " + e)
    }
}

loadState()
loadData()

// ----- helpers ------------------------------------------------------
function isEnabled() {
    return enabledOverride === null ? Settings.textoverlay : enabledOverride
}

// first matching box wins; utils.isPlayerInBox handles reversed corners
function currentZoneName() {
    for (const z of zones) {
        if (!z || !z.min || !z.max) continue
        if (isPlayerInBox(z.min[0], z.min[1], z.min[2], z.max[0], z.max[1], z.max[2])) return z.name
    }
    return null
}

// edit mode uses fake showcase values so you can see what it looks like
function buildString(editing) {
    const name = editing ? "Steve" : Player.getName()
    const box = editing ? "BoxName" : (currentZoneName() || "?")
    // "name: box" style output, easy to change from code:
    return `${name}: ${box}`
}

function drawOverlay(editing, gui) {
    const str = buildString(editing)
    const font = mc.font
    const tw = font.width(str) * scale
    const th = 9 * scale

    if (showBg) {
        gui.fill(V2(0, 0), V2(tw + 4 * scale, th + 2 * scale), 0x90000000)
    }

    new Text(str, 2 * scale, 1 * scale)
        .setShadow(shadow)
        .setScale(scale)
        .draw(gui)
}

// ----- render trigger (manual draw(), per 26.1 Display changes) ------
const overlayTrigger = register("renderOverlay", (gui) => {
    if (editOpen) return // editor draws its own showcase copy, avoid double render
    if (!mc.level || !mc.player) return
    gui.pushPose()
    gui.translate(pos.x, pos.y, 0)
    drawOverlay(false, gui)
    gui.popPose()
})
overlayTrigger.unregister()

// keep the trigger in sync with the config switch / overrides
let lastEnabled = null
register("tick", () => {
    const on = isEnabled()
    if (on === lastEnabled) return
    lastEnabled = on
    if (on) overlayTrigger.register()
    else overlayTrigger.unregister()
})

// ===================================================================
// Editor GUI - drag the overlay around with the mouse
// ===================================================================
let editOpen = false
let dragging = false
let grabOff = { x: 0, y: 0 }
let screen = null

// whole-screen editor: renderer draws the dimmed world + showcase text,
// mouse handlers do the dragging. No widget needed since we draw everything ourselves.
try {
screen = new Screen("Edit HUD Overlay")
    .withTitle("Edit HUD Overlay - drag me, RMB/ESC to close")
    .withKeyPress((key) => {
        if (key === 256 || key === 293) mc.setScreen(null) // ESCAPE / ENTER
        return false
    })
    .withMousePress((gui, mouse) => {
        if (mouse.isRight()) { mc.setScreen(null); return true } // RMB closes
        if (!mouse.isLeft()) return false
        dragging = true
        grabOff = { x: mouse.getX() - pos.x, y: mouse.getY() - pos.y }
        return true
    })
    .withMouseDrag((gui, mouse) => {
        if (!dragging) return false
        pos.x = Math.round(mouse.getX() - grabOff.x)
        pos.y = Math.round(mouse.getY() - grabOff.y)
        clampPos()
        dirty = true
        return true
    })
    .withMouseRelease((gui, mouse) => {
        if (!dragging) return false
        dragging = false
        saveState()
        return true
    })
    .withRenderer((gui, mouse, partialTicks) => {
        // dim backdrop so the text is readable over the world
        gui.fill(V2(0, 0), V2(screen.width, screen.height), 0x66000000)
        gui.pushPose()
        gui.translate(pos.x, pos.y, 0)
        drawOverlay(true, gui)
        gui.popPose()

        new Text("&e" + Player.getName() + ": &aBoxName &7(showcase)", 2, screen.height - 12)
            .setShadow(true).draw(gui)
        new Text("pos: " + pos.x + "," + pos.y + "  scale: " + scale.toFixed(2),
                 2, screen.height - 22).setShadow(true).draw(gui)
    })
    .withOnCloseHandler(() => {
        editOpen = false
        dragging = false
        if (dirty) { saveState(); dirty = false }
        ChatLib.chat("&a[Overlay] position saved: " + pos.x + "," + pos.y)
    })
} catch (e) {
    // Screen builder API mismatch -> overlay still renders, only the editor GUI is unavailable
    console.log("[Overlay] failed to build editor GUI: " + e)
}

// ----- command -------------------------------------------------------
register("command", (...args) => {
    const sub = args[0]?.toLowerCase()

    if (sub === "reset") {
        pos = { x: 0, y: 0 }
        clampPos()
        saveState()
        ChatLib.chat("&a[Overlay] position reset to 0,0")
        return
    }
    if (sub === "save") {
        saveState()
        saveData()
        ChatLib.chat("&a[Overlay] saved ( " + dataFile.getPath() + ")")
        return
    }
    if (sub === "reload") {
        loadData()
        ChatLib.chat("&a[Overlay] reloaded " + zones.length + " zone box(es)")
        return
    }

    if (!screen) {
        ChatLib.chat("&c[Overlay] editor GUI failed to build, check console")
        return
    }
    if (editOpen) return
    editOpen = true
    Client.currentGui.set(screen)
}).setName("edithud")
