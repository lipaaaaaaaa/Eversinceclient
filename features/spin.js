import Settings from "../config"

const ServerboundMovePlayerPacket = Java.type("net.minecraft.network.protocol.game.ServerboundMovePlayerPacket");
let serverYaw = 0.0;

function setPrivateFloatField(instance, fieldNames, value) {
    if (!instance) return false;
    const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
    let clazz = instance.getClass();

    while (clazz && clazz !== Java.type("java.lang.Object").class) {
        for (let name of names) {
            try {
                let field = clazz.getDeclaredField(name);
                field.setAccessible(true);
                field.setFloat(instance, value);
                return true;
            } catch (e) {}
        }
        clazz = clazz.getSuperclass();
    }
    return false;
}

register("packetSent", (packet, event) => {
    if (!Settings.spinbot) return;
    serverYaw = (serverYaw + 30) % 360.0;
    if (packet instanceof ServerboundMovePlayerPacket) {
        setPrivateFloatField(packet, ["yRot", "yaw", "f_108331_"], serverYaw);
    }
});

register("renderWorld", () => {
    if (!Settings.spinbot) return;
    const playerWrapper = Player.getPlayer();
    const nativePlayer = typeof playerWrapper.getPlayer === "function" ? playerWrapper.getPlayer() : playerWrapper;

    if (typeof nativePlayer.setYHeadRot === "function") {
        nativePlayer.setYHeadRot(serverYaw);
    } else {
        setPrivateFloatField(nativePlayer, ["yHeadRot", "f_20885_"], serverYaw);
    }
    setPrivateFloatField(nativePlayer, ["yBodyRot", "f_20883_"], serverYaw);
});