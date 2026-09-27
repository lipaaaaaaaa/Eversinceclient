import Settings from "./config";
const KeyBinding = Java.type("net.minecraft.client.settings.KeyBinding");
const PlayerInteractItemC2SPacket = Java.type("net.minecraft.class_2886")

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
export function p(text) {
    ChatLib.command("ct simulate [Eversince] " + text)}

export function swinghand() {
const player = Player.getPlayer()
const Hand = Java.type("net.minecraft.class_1268")
player.method_6104(Hand.field_5808);
}

export function debugp(m) {
if (!Settings.debugmsg) return
ChatLib.chat("&7[&cDEBUG&7]&f " + m)}

export function rightClick() {
const mc = Client.getMinecraft();
const Hand1 = Java.type("net.minecraft.class_1268");
mc.field_1761.method_2919(mc.field_1724, Hand1.field_5808);
debugp("attempting to invoke mouse")}

export function rotate(y, p) {
Player.getPlayer().setYaw(y)
Player.getPlayer().setPitch(p)
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
const hand_yuritil = Java.type("net.minecraft.class_1268")
const mainhand = hand_yuritil.MAIN_HAND
const c08tosend = new PlayerInteractItemC2SPacket(mainhand, sequence, Player.getPlayer().getYaw(), Player.getPlayer().getPitch())
Client.sendPacket(c08tosend)}

export function senduseat(yaw, pitch) {
sequence = 0
const hand_yuritil = Java.type("net.minecraft.class_1268")
const mainhand = hand_yuritil.MAIN_HAND
const c08tosend = new PlayerInteractItemC2SPacket(mainhand, sequence, yaw, pitch)
Client.sendPacket(c08tosend)
}


// ----- Walk forward functions -----

let forwardKey = null; // Store the keybind object for reuse

function getForwardKey() {
    if (forwardKey) return forwardKey;

    const mc = Client.getMinecraft();
    if (!mc || !mc.options) {
        console.error("❌ Cannot access Minecraft options");
        return null;
    }

    // Try common Yarn field names for the forward key
    forwardKey = mc.options.forwardKey || mc.options.keyForward || mc.options.forward;

    if (!forwardKey) {
        console.warn("⚠️ Forward key not found. Available options fields:", Object.keys(mc.options));
        return null;
    }

    return forwardKey;
}

export function walk() {
    const key = getForwardKey();
    if (!key) return;

    // Press the key
    if (typeof key.setPressed === "function") {
        key.setPressed(true);
    } else if (typeof key.setState === "function") {
        key.setState(true);
    } else {
    }
}

export function nowalk() {
    const key = getForwardKey();
    if (!key) return;

    if (typeof key.setPressed === "function") {
        key.setPressed(false);
    } else if (typeof key.setState === "function") {
        key.setState(false);
    }
}

export function unhandlekeys() {
    const mc = Client.getMinecraft();
    if (!mc || !mc.options) return;

    const movementKeys = [
        mc.options.forwardKey, mc.options.keyForward, mc.options.forward,
        mc.options.backKey, mc.options.keyBack, mc.options.back,
        mc.options.leftKey, mc.options.keyLeft, mc.options.left,
        mc.options.rightKey, mc.options.keyRight, mc.options.right,
        mc.options.jumpKey, mc.options.keyJump, mc.options.jump,
        mc.options.sneakKey, mc.options.keySneak, mc.options.sneak,
        mc.options.sprintKey, mc.options.keySprint, mc.options.sprint
    ];

    movementKeys.forEach(key => {
        if (key) {
            if (typeof key.setPressed === "function") key.setPressed(false);
            else if (typeof key.setState === "function") key.setState(false);
        }
    });
}

export function walkfor(ticks) {
    walk();
    Client.scheduleTask(ticks, stopWalkingForward);
}

const mc = Client.getMinecraft()

export const edgeJump = register("renderOverlay", () => {
    let ID = World.getBlockAt(Player.getX(), Player.getY() - 0.05, Player.getZ()).type.getID()
    if (ID == 0 && Player.getPlayer().isOnGround) {
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

const MinecraftClient = Java.type("net.minecraft.client.MinecraftClient");
const HandledScreen = Java.type("net.minecraft.client.gui.screen.ingame.HandledScreen");

export function guiOpen() {
    const screen = MinecraftClient.getInstance().currentScreen;
    return screen !== null && screen instanceof HandledScreen;
}

export function doItemUse() {
    const clientClass = Java.type("net.minecraft.class_310");  // adjust mapping if needed
    const mc = clientClass.getInstance();
    const method = clientClass.class.getDeclaredMethod("method_1583");
    method.setAccessible(true);
    method.invoke(mc);
}
