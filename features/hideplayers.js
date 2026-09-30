import Settings from "../config"

const mc = Client.getMinecraft()
const DROP = 1000

const hidden = new Set()

const shift = (p, dy) => p.setPos(p.getX(), p.getY() + dy, p.getZ())

const restore = () => {
    const ps = mc.level.players()
    for (let i = 0; i < ps.size(); i++) {
        const p = ps.get(i)
        if (hidden.delete(p.getUUID().toString())) shift(p, DROP)
    }
    hidden.clear()
}

const tick = register("tick", () => {
    const me = mc.player
    const ps = mc.level.players()

    for (let i = 0; i < ps.size(); i++) {
        const p = ps.get(i)
        const id = p.getUUID()
        if (id.equals(me.getUUID())) continue

        const key = id.toString()
        const off = hidden.has(key)
        const dx = p.getX() - me.getX()
        const dy = p.getY() + (off ? DROP : 0) - me.getY()
        const dz = p.getZ() - me.getZ()
        const near = dx * dx + dy * dy + dz * dz <= Settings.hprval ** 2

        if (near && !off) {
            shift(p, -DROP)
            hidden.add(key)
        } else if (!near && off) {
            shift(p, DROP)
            hidden.delete(key)
        }
    }
})

function stop() {
    tick.unregister()
    restore()
}

register("chat", () => {
if(Settings.hideplayers) 
    tick.register()
}).setCriteria("Starting in 4 seconds.").setContains()
register("chat", () => {stop()}).setCriteria("> EXTRA STATS <").setContains()
register("worldUnload", () => {stop()})