import Settings from "../config"

register("chat", () => {
if(Settings.ms3an)
trigger.register()
ChatLib.chat("MS3")
}).setCriteria("Milestone ❸:").setContains()

const trigger = register("renderOverlay", (drawContext) => {
new Text("&bMilestone 3", 590, 530).setShadow(true).draw(drawContext)
}).unregister()


register("worldUnload", () => {
trigger.unregister()
})
