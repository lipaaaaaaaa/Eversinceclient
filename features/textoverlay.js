import Settings from "../config"
const File = Java.type("java.io.File")
const Files = Java.type("java.nio.file.Files")

const mc = Client.getMinecraft()

const stateFile = new File("./config/ChatTriggers/modules/Eversinceclient", "textoverlay.json")

let pos = { x: 0, y: 0 }
let scale = 1.0
let shadow = true
let showBg = false
let enabledOverride = null
let dirty = false

let editOpen = false
let dragging = false
let grabOff = { x: 0, y: 0 }
let editorGui = null

let otherDistSq = 6400

const ZONES = [
    { name: "S4", x1: 17, x2: 90, y1: 100, y2: 160, z1: 27, z2: 50 },
    { name: "S3", x1: -6, x2: 19, y1: 100, y2: 160, z1: 50, z2: 123 },
    { name: "S2", x1: 19, x2: 91, y1: 100, y2: 160, z1: 121, z2: 145 },
    { name: "S1", x1: 89, x2: 113, y1: 100, y2: 160, z1: 48, z2: 122 },
]

const SUBS = [
    { name: "Core", parent: "S4", x1: 51, x2: 57, y1: 114, y2: 118, z1: 50, z2: 53 },
    { name: "High EE2", parent: "S2", x1: 58, x2: 62, y1: 131, y2: 135, z1: 37, z2: 140 },
    { name: "EE3", parent: "S3", x1: 0, x2: 3, y1: 108, y2: 113, z1: 98, z2: 107 },
    { name: "SS", parent: "S1", x1: 106, x2: 109, y1: 119, y2: 123, z1: 92, z2: 95 },
]

const PAD = 0.25

function zoneBounds(zn) {
    return {
        xlo: Math.min(zn.x1, zn.x2), xhi: Math.max(zn.x1, zn.x2),
        ylo: Math.min(zn.y1, zn.y2), yhi: Math.max(zn.y1, zn.y2),
        zlo: Math.min(zn.z1, zn.z2), zhi: Math.max(zn.z1, zn.z2),
    }
}

const P3 = zoneBounds({ x1: -3, y1: 105, z1: 143, x2: 117, y2: 154, z2: 21 })

function insideZoneRaw(b, x, y, z) {
    return x >= b.xlo && x <= b.xhi && y >= b.ylo && y <= b.yhi && z >= b.zlo && z <= b.zhi
}

function insideBox(b, x, y, z) {
    return x >= b.xlo - PAD && x <= b.xhi + PAD &&
           y >= b.ylo - PAD && y <= b.yhi + PAD &&
           z >= b.zlo - PAD && z <= b.zhi + PAD
}

function insideXZ(b, x, z) {
    return x >= b.xlo - PAD && x <= b.xhi + PAD && z >= b.zlo - PAD && z <= b.zhi + PAD
}

function findSubAt(x, y, z) {
    for (const s of SUBS) {
        if (insideZone(s, x, y, z)) return s
    }
    return null
}

function parentName(s) {
    const pb = zoneBounds(s)
    for (const zn of ZONES) {
        if (zn.name !== s.parent) continue
        const b = zoneBounds(zn)
        if (pb.xlo >= b.xlo - 0.5 && pb.xhi <= b.xhi + 0.5 &&
            pb.zlo >= b.zlo - 0.5 && pb.zhi <= b.zhi + 0.5) return zn.name
    }
    return s.parent
}

function findZoneAt(x, y, z) {
    const s = findSubAt(x, y, z)
    if (s) {
        const pn = parentName(s)
        for (const zn of ZONES) {
            if (zn.name === pn && insideXZ(zoneBounds(zn), x, z)) {
                return { name: pn + " > " + s.name, mainName: pn, subName: s.name }
            }
        }
        return { name: pn + " > " + s.name, mainName: pn, subName: s.name }
    }
    let best = null
    let bestMidDist = Infinity
    for (const zn of ZONES) {
        const b = zoneBounds(zn)
        if (!insideXZ(b, x, z)) continue
        let d
        if (y < b.ylo) d = b.ylo - y
        else if (y > b.yhi) d = y - b.yhi
        else d = 0
        if (d <= 16 && d < bestMidDist) {
            bestMidDist = d
            best = zn
        }
    }
    if (best) return best
    for (const zn of ZONES) {
        if (insideZone(zn, x, y, z)) return zn
    }
    return null
}

function insideZone(zn, x, y, z) {
    return insideBox(zoneBounds(zn), x, y, z)
}

function zoneLabel(zn) {
    const main = Settings.textoverlayMain !== false
    const sub = Settings.textoverlaySub !== false
    if (zn.subName) {
        if (main && sub) return zn.name
        if (sub) return zn.subName
        if (main) return zn.mainName
        return null
    }
    return main ? zn.name : null
}

const loggedErrs = {}

function logOnce(key, e) {
    if (loggedErrs[key]) return
    loggedErrs[key] = true
    console.log("[Overlay] " + key + ": " + e)
}

function loadState() {
    try {
        if (!stateFile.exists()) return
        const s = JSON.parse(String(Files.readString(stateFile.toPath())))
        pos = { x: Number(s.x) || 0, y: Number(s.y) || 0 }
        scale = Number(s.scale) || 1.0
        shadow = s.shadow !== false
        showBg = s.showBg === true
        if (typeof s.enabled === "boolean") enabledOverride = s.enabled
        if (Number(s.otherDist) > 0) otherDistSq = Number(s.otherDist) * Number(s.otherDist)
    } catch (e) {
        logOnce("load", e)
    }
}

function saveState() {
    try {
        Files.writeString(stateFile.toPath(), JSON.stringify({
            x: pos.x, y: pos.y, scale: scale, shadow: shadow,
            showBg: showBg, enabled: enabledOverride,
            otherDist: Math.sqrt(otherDistSq),
        }, null, 2))
    } catch (e) {
        logOnce("save", e)
    }
}

function clampPos() {
    const w = mc.getWindow()
    pos.x = Math.max(0, Math.min(pos.x, w.getGuiScaledWidth() - 20))
    pos.y = Math.max(0, Math.min(pos.y, w.getGuiScaledHeight() - 10))
}

function isPlayerInsideBox(playerX, playerZ, playerY, squareCenterX, squareCenterZ, squareCenterY, squareSize) {
    const halfSize = (squareSize / 2) + 0.25

    return Math.abs(squareCenterX - playerX) <= halfSize &&
           Math.abs(squareCenterY - playerY) <= halfSize &&
           Math.abs(squareCenterZ - playerZ) <= halfSize
}

const EntityPlayerCls = Java.type("net.minecraft.world.entity.player.Player")
function nearbyPlayers() {
    const list = []
    try {
        for (const e of mc.level.getEntities().getAll()) {
            if (e instanceof EntityPlayerCls) list.push(e)
        }
    } catch (err) {
        try {
            const it = mc.level.players().iterator()
            while (it.hasNext()) list.push(it.next())
        } catch (err2) {
            try {
                for (const p of Player.getAllPlayers()) {
                    if (!p) continue
                    let ent = null
                    try {
                        const tj = p.getTabJSON ? p.getTabJSON() : null
                        const json = typeof tj === "string" ? JSON.parse(tj) : tj
                        const obj = json && json.properties && json.properties.object ? json.properties.object : json
                        const uuid = obj && obj.uuid
                        if (uuid) ent = mc.level.getPlayerByUUID(uuid)
                    } catch (err3) { ent = null }
                    if (!ent) {
                        try { if (p instanceof EntityPlayerCls) ent = p } catch (err4) { ent = null }
                    }
                    if (ent) list.push(ent)
                }
            } catch (err5) {
                if (mc.player) list.push(mc.player)
            }
        }
    }
    return list
}

function entityName(e) {
    try {
        const gp = e.getGameProfile()
        if (gp) {
            const n = String(gp.getName())
            if (n && n !== "null") return n
        }
    } catch (err) {}
    try {
        const d = e.getDisplayName()
        if (d) {
            let s = null
            try { s = String(d.getString()) } catch (e2) {}
            if (!s || s === "null" || s.charAt(0) === "{") {
                try { s = String(d.getContents()) } catch (e3) {}
            }
            if (!s || s === "null" || s.charAt(0) === "{") s = String(d)
            if (s && s !== "null") {
                if (s.charAt(0) === "{") {
                    try {
                        const o = JSON.parse(s)
                        if (o && o.text) s = String(o.text)
                    } catch (e4) {}
                }
                s = String(s).replace(/§./g, "")
                try { s = s.replace(/\u00a7./g, "") } catch (e5) {}
                if (s.charAt(0) === "{") return "?"
                return s
            }
        }
    } catch (err) {}
    return "?"
}

function entityPos(e) {
    return { x: e.getX(), y: e.getY(), z: e.getZ() }
}

function inP3() {
    const p = entityPos(mc.player)
    return insideZoneRaw(P3, p.x, p.y, p.z)
}

let edLabel = null
const lines = []
let rectDrawWorks = null

function getEditorLabel(x, y) {
    if (!edLabel) edLabel = new Text("Steve: BoxName", x, y).setShadow(shadow).setScale(scale)
    else edLabel.setX(x).setY(y).setShadow(shadow).setScale(scale)
    return edLabel
}

function drawText(label, ctx, x, y) {
    if (ctx) {
        try {
            label.draw(ctx)
            return
        } catch (e) {
            logOnce("draw(ctx)", e)
        }
    }
    try {
        label.draw()
        return
    } catch (e2) {
        logOnce("draw()", e2)
    }
    try {
        Renderer.drawString(String(label.getString()), x, y)
    } catch (e3) {
        logOnce("drawString", e3)
    }
}

function drawLabel(label, ctx, x, y) {
    if (showBg) {
        fillRect(0x90000000,
            x - 2, y - 1,
            x - 2 + label.getWidth() + 4,
            y - 1 + label.getHeight() + 2)
    }

    drawText(label, ctx, x, y)
}

function drawLine(i, str, ctx, x, y) {
    let t = lines[i]
    if (!t) {
        t = new Text(str, x, y).setShadow(shadow).setScale(scale)
        lines[i] = t
    } else {
        t.setString(str).setX(x).setY(y).setShadow(shadow).setScale(scale)
    }
    drawLabel(t, ctx, x, y)
    return t.getHeight()
}

function drawOthers(ctx) {
    try {
        const me = entityPos(mc.player)
        let i = 0
        let y = pos.y
        for (const e of nearbyPlayers()) {
            if (!e || e === mc.player) continue
            const nm = entityName(e)
            if (!nm || nm === "?") continue
            const ep = entityPos(e)
            const dx = ep.x - me.x, dy = ep.y - me.y, dz = ep.z - me.z
            if (dx * dx + dy * dy + dz * dz > otherDistSq) continue
            const zn = findZoneAt(ep.x, ep.y, ep.z)
            if (!zn) continue
            const zl = zoneLabel(zn)
            if (!zl) continue
            y += drawLine(i, nm + ": " + zl, ctx, pos.x, y) + 2
            i++
        }
    } catch (e) {
        logOnce("others", e)
    }
}

function fillRectFallback(color, x1, y1, x2, y2, tileSize) {
    const t = tileSize || 1
    const gx = Math.floor(x1), gy = Math.floor(y1)
    const gw = Math.max(0, Math.ceil(x2) - gx)
    const gh = Math.max(0, Math.ceil(y2) - gy)
    const cols = Math.ceil(gw / t), rows = Math.ceil(gh / t)
    if (cols * rows > 8192) return
    for (let ix = 0; ix < cols; ix++) {
        for (let iy = 0; iy < rows; iy++) {
            Gui.renderGuiTile(null, color, gx + ix * t, gy + iy * t, t, t)
        }
    }
}

function fillRect(color, x1, y1, x2, y2, tileSize) {
    if (rectDrawWorks !== false) {
        try {
            Renderer.drawRect(color, x1, y1, x2, y2)
            rectDrawWorks = true
            return
        } catch (e) {
            rectDrawWorks = false
        }
    }
    try { fillRectFallback(color, x1, y1, x2, y2, tileSize) } catch (e2) {}
}

loadState()

const overlayTrigger = register("renderOverlay", (ctx) => {
    if (editOpen) return
    if (!mc.level || !mc.player) return
    if (!inP3()) return
    drawOthers(ctx)
})
overlayTrigger.unregister()

let lastEnabled = null
register("tick", () => {
    if (dirty && !dragging) {
        dirty = false
        saveState()
    }
    const on = Settings.textoverlay
    if (on === lastEnabled) return
    lastEnabled = on
    if (on) overlayTrigger.register()
    else overlayTrigger.unregister()
})

const KEY_ESCAPE = 256
const KEY_ENTER = 257
const MOUSE_LEFT = 0
const MOUSE_RIGHT = 1

let edWinW = 0, edWinH = 0
let edHelp1 = null
let edHelp2 = null
let edH2X = -1e9, edH2Y = -1e9, edH2S = -1e9
let edH2Str = null

function refreshEditorSize() {
    const w = mc.getWindow().getGuiScaledWidth()
    const h = mc.getWindow().getGuiScaledHeight()
    if (w !== edWinW || h !== edWinH) {
        edWinW = w; edWinH = h
        edHelp1 = null
    }
}

try {
    editorGui = new Gui(new TextComponent("Edit HUD Overlay"))
        .setDoesPauseGame(false)
        .registerDraw((...args) => {
            const ctx = args[0]
            refreshEditorSize()
            const w = edWinW
            const h = edWinH

            fillRect(0x66000000, 0, 0, w, h, 8)

            drawLabel(getEditorLabel(pos.x, pos.y), ctx, pos.x, pos.y)

            try {
                if (!edHelp1) {
                    edHelp1 = new Text("Steve: BoxName (showcase)",
                                       2, h - 12).setShadow(true)
                }
                if (!edHelp2 || edH2X !== pos.x || edH2Y !== pos.y || edH2S !== scale) {
                    edH2X = pos.x
                    edH2Y = pos.y
                    edH2S = scale
                    const s2 = "pos: " + pos.x + "," + pos.y +
                        "  scale: " + scale.toFixed(2) +
                        "  LMB drag | RMB/ESC close"
                    if (!edHelp2 || edH2Str !== s2) {
                        edH2Str = s2
                        edHelp2 = new Text(s2, 2, h - 22).setShadow(true)
                    } else {
                        edHelp2.setX(2).setY(h - 22)
                    }
                }
                drawText(edHelp1, ctx, 2, h - 12)
                drawText(edHelp2, ctx, 2, h - 22)
            } catch (e) {
                logOnce("editor help", e)
            }
        })
        .registerClicked((mouseX, mouseY, button) => {
            if (button === MOUSE_RIGHT) {
                Client.currentGui.set(null)
                return
            }
            if (button !== MOUSE_LEFT) return
            dragging = true
            grabOff = { x: mouseX - pos.x, y: mouseY - pos.y }
        })
        .registerMouseDragged((mouseX, mouseY, button) => {
            if (!dragging || button !== MOUSE_LEFT) return
            pos.x = Math.round(mouseX - grabOff.x)
            pos.y = Math.round(mouseY - grabOff.y)
            clampPos()
            dirty = true
        })
        .registerMouseReleased((mouseX, mouseY, button) => {
            if (!dragging || button !== MOUSE_LEFT) return
            dragging = false
            dirty = true
        })
        .registerKeyTyped((typedChar, keyCode) => {
            if (keyCode === KEY_ESCAPE || keyCode === KEY_ENTER) {
                Client.currentGui.set(null)
            }
        })
        .registerClosed(() => {
            editOpen = false
            dragging = false
            if (dirty) { saveState(); dirty = false }
            ChatLib.chat("[Overlay] position saved: " + pos.x + "," + pos.y)
        })
} catch (e) {
    console.log("[Overlay] failed to build editor GUI: " + e)
}

function describeZone(zn) {
    const b = zoneBounds(zn)
    return "x [" + b.xlo.toFixed(1) + ".." + b.xhi.toFixed(1) +
        "] y [" + b.ylo.toFixed(1) + ".." + b.yhi.toFixed(1) +
        "] z [" + b.zlo.toFixed(1) + ".." + b.zhi.toFixed(1) + "]"
}

function axisCheck(zn, x, y, z) {
    const b = zoneBounds(zn)
    return "[x" + (x >= b.xlo && x <= b.xhi ? "+" : "-") +
        " y" + (y >= b.ylo && y <= b.yhi ? "+" : "-") +
        " z" + (z >= b.zlo && z <= b.zhi ? "+" : "-") + "]"
}


function resolveByName(nameArg) {
    const target = String(nameArg).toLowerCase()
    for (const e of nearbyPlayers()) {
        if (entityName(e).toLowerCase() === target) return e
    }
    return null
}

register("command", (...args) => {
    const sub = args[0]?.toLowerCase()

    if (sub === "save") {
        saveState()
        ChatLib.chat("[Overlay] saved")
        return
    }
    if (sub === "dist") {
        const d = Number(args[1])
        if (!isFinite(d) || d <= 0) { ChatLib.chat("[Overlay] usage: /edithud dist <blocks>"); return }
        otherDistSq = d * d
        saveState()
        ChatLib.chat("[Overlay] other player label distance set to " + d + " blocks")
        return
    }
    if (sub === "list") {
        for (const zn of ZONES) ChatLib.chat("[Overlay] " + zn.name + ": " + describeZone(zn))
        for (const s of SUBS) ChatLib.chat("[Overlay]   " + s.name + " (" + s.parent + "): " + describeZone(s))
        return
    }
    if (sub === "where") {
        if (args[1] && args[1].toLowerCase() !== "list") {
            const ent = resolveByName(args[1])
            if (!ent) { ChatLib.chat("[Overlay] player not found or not in view distance: " + args[1]); return }
            const ep = entityPos(ent)
            const zn = findZoneAt(ep.x, ep.y, ep.z)
            ChatLib.chat("[Overlay] " + entityName(ent) + " at " +
                ep.x.toFixed(2) + ", " + ep.y.toFixed(2) + ", " + ep.z.toFixed(2) +
                " section: " + (zn ? zn.name : "(none)"))
            return
        }
        const p = mc.player
        if (!p) { ChatLib.chat("[Overlay] not in a world"); return }
        const x = p.getX(), y = p.getY(), z = p.getZ()
        ChatLib.chat("[Overlay] you are at " + x.toFixed(2) + ", " + y.toFixed(2) + ", " + z.toFixed(2))
        const zn = findZoneAt(x, y, z)
        if (zn) ChatLib.chat("[Overlay] section: " + zn.name)
        else ChatLib.chat("[Overlay] section: (none - outside all boxes)")
        if (!zn || args[1]?.toLowerCase() === "list") {
            for (const zz of ZONES) {
                ChatLib.chat("  " + zz.name + ": " + describeZone(zz) + " " + axisCheck(zz, x, y, z))
            }
            for (const ss of SUBS) {
                ChatLib.chat("  " + ss.name + " (" + ss.parent + "): " + describeZone(ss) + " " + axisCheck(ss, x, y, z))
            }
        }
        return
    }

    if (!editorGui) {
        ChatLib.chat("[Overlay] editor GUI failed to build, check console")
        return
    }
    if (editOpen) return
    editOpen = true
    editorGui.open()
}).setName("edithud")