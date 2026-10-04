import Settings from "./config";
export function p(text) {ChatLib.chat("[Eversince] " + text)}

const InteractionHand = Java.type("net.minecraft.world.InteractionHand");
const ServerboundUseItemPacket = Java.type("net.minecraft.network.protocol.game.ServerboundUseItemPacket")
const Minecraft = Java.type("net.minecraft.client.Minecraft");
const AbstractContainerScreen = Java.type("net.minecraft.client.gui.screens.inventory.AbstractContainerScreen");

export const swapToItem = (targetItemName) => {
    const itemSlot = Player?.getInventory()?.getItems()?.findIndex(item => { return item?.getName()?.toLowerCase()?.includes(targetItemName.toLowerCase()) })
    if (itemSlot === -1 || itemSlot > 7) {
        p(`Unable to find "${targetItemName}" in your hotbar`)
        return
    } else {
       debugp(`set players item to ${targetItemName}`)
        heldItem = Player.getHeldItemIndex() // Does this do anything????????????????????
        Player.setHeldItemIndex(itemSlot)
    }
}

export function swinghand() {
Player.getPlayer().swing(InteractionHand.MAIN_HAND)
}

export function debugp(m) {
if (!Settings.debugmsg) return
ChatLib.chat("[DEBUG] " + m)}

export function rightClick() {
const mc = Client.getMinecraft();
mc.gameMode.useItem(mc.player, InteractionHand.MAIN_HAND);
debugp("attempting to invoke mouse")}

export function rotate(y, p) {
Player.getPlayer().setYRot(y)
Player.getPlayer().setXRot(p)
}


export function isPlayerInBox(x1, y1, z1, x2, y2, z2) {
    const x = Player.getX();
    const y = Player.getY();
    const z = Player.getZ();

    return (x >= Math.min(x1, x2) && x <= Math.max(x1, x2) &&
            y >= Math.min(y1, y2) && y <= Math.max(y1, y2) &&
            z >= Math.min(z1, z2) && z <= Math.max(z1, z2));
}

export const getDistance3D = (x1, y1, z1, x2, y2, z2) => Math.sqrt((x2-x1)**2 + (y2-y1)**2 + (z2-z1)**2)
 
export function senduseitem() {
sequence = 0
const c08tosend = new ServerboundUseItemPacket(InteractionHand.MAIN_HAND, sequence, Player.getPlayer().getYRot(), Player.getPlayer().getXRot())
Client.sendPacket(c08tosend)}

export function senduseat(yaw, pitch) {
sequence = 0
const c08tosend = new ServerboundUseItemPacket(InteractionHand.MAIN_HAND, sequence, yaw, pitch)
Client.sendPacket(c08tosend)
}


// ----- Walk forward functions -----

function getForwardKey() {
    return Client.getMinecraft().options.keyUp;
}

export function walk() {
    getForwardKey().setDown(true);
}

export function nowalk() {
    getForwardKey().setDown(false);
}

export function unhandlekeys() {
    const o = Client.getMinecraft().options;
    [o.keyUp, o.keyDown, o.keyLeft, o.keyRight, o.keyJump, o.keyShift, o.keySprint].forEach(key => key.setDown(false));
}

export function walkfor(ticks) {
    walk();
    Client.scheduleTask(ticks, stopWalkingForward);
}

const mc = Client.getMinecraft()

export const edgeJump = register("renderOverlay", () => {
    let ID = World.getBlockAt(Player.getX(), Player.getY() - 0.05, Player.getZ()).type.getID()
    if (ID == 0 && Player.getPlayer().onGround()) {
        Jump()
        edgeJump.unregister()
    }
}).unregister()

export function edge() {
    edgeJump.register()
}
register("command", () => {
edge()
}).setName("edge")

function holdingaotv() {
const heldItem = Player.getHeldItem();
if (!heldItem) return false;
const itemName = heldItem.getName();
return itemName.toLowerCase()?.includes("aspect of the void");
}

export function etherto(yaw, pitch) {
{if(!holdingaotv) return swapToItem("aspect of the void")}
rotate(yaw, pitch)
sneak()
Client.scheduleTask(0, () => {senduseitem()})}

export function clickswing() {
senduseitem()
if(!Player.isSneaking())
swinghand()}

export function guiOpen() {
    return Minecraft.getInstance().screen instanceof AbstractContainerScreen;
}

export function doItemUse() {
    const method = Minecraft.class.getDeclaredMethod("startUseItem");
    method.setAccessible(true);
    method.invoke(Minecraft.getInstance());
}