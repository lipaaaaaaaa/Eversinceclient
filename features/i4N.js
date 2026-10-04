import Settings from "../config"
import Vector3 from "../Vector3";
import packetBlockChange from "../events/packetBlockChange";
import packetMultiBlockChange from "../events/packetMultiBlockChange";
import { startSmoothRotation, isRotating, cancelRotation } from "../events/Rotations";
import { rightClick, debugp } from "../utils";

function getPlayerEyeCoords() {
    const player = Player.getPlayer();
    return [Player.getX(), Player.getY() + player.getEyeHeight(player.getPose()), Player.getZ()];
}

// Mojmap: net.minecraft.world.level.block.Blocks
const Blocks = Java.type("net.minecraft.world.level.block.Blocks");
const McBlockPos = Java.type("net.minecraft.core.BlockPos");

// Mojmap: net.minecraft.network.protocol.game.ServerboundMovePlayerPacket
const PlayerMoveC2SPacket = Java.type("net.minecraft.network.protocol.game.ServerboundMovePlayerPacket");
const LookAndOnGround = Java.type("net.minecraft.network.protocol.game.ServerboundMovePlayerPacket$Rot");

const blocks = [
    [68, 130, 50], [66, 130, 50], [64, 130, 50],
    [68, 128, 50], [66, 128, 50], [64, 128, 50],
    [68, 126, 50], [66, 126, 50], [64, 126, 50]
];

const ROT_BASE_MS = Number(Settings.i4minrottime);   // 150
const ROT_CAP_MS  = Number(Settings.i4rottimevar);    // 50

// Hit blocks (blue terracotta), tracked from block packets
const done = [];

// What we are aiming at or shooting at right now, null when idle:
// { index, emerald, aiming, aimed, tries }
let target = null;
let lastShotTime = 0;
let lastEmeraldTime = 0;

// Phase / device state
let p3Active = false;
let deviceDone = false;
let auto4Enabled = false;
let prefireWaiting = false;
let prefireSpamming = false;

let gameTick = 0;
let swapLockEndTick = 0;

register("tick", () => {
    gameTick++;
    if (gameTick < swapLockEndTick) return;
    if (prefireSpamming && Date.now() - lastShotTime >= getShotCooldownMs()) {
        lastShotTime = Date.now();
        rightClick();
    }
});

// ---------- Trajectory simulation ----------
function canHitBlock(blockIndex) {
    if (blockIndex < 0 || blockIndex >= blocks.length) return false;
    const target = blocks[blockIndex];
    const minX = target[0], minY = target[1], minZ = target[2];
    const maxX = minX + 1, maxY = minY + 1, maxZ = minZ + 1;

    const player = Player.getPlayer();
    const yaw = player.getYRot();
    const pitch = player.getXRot();

    const yawRad = yaw * Math.PI / 180;
    const xOffset = -Math.cos(yawRad) * 0.16;
    const zOffset = -Math.sin(yawRad) * 0.16;
    const eyeHeight = player.getEyeHeight(player.getPose());
    let arrowPos = {
        x: Player.getX() + xOffset,
        y: Player.getY() + eyeHeight - 0.1,
        z: Player.getZ() + zOffset
    };

    const look = getLookVector(yaw, pitch);
    const speed = 3.0;
    let vel = { x: look.x * speed, y: look.y * speed, z: look.z * speed };

    for (let i = 0; i < 20; i++) {
        const prevPos = { ...arrowPos };
        arrowPos.x += vel.x;
        arrowPos.y += vel.y;
        arrowPos.z += vel.z;

        if (segmentIntersectsAABB(prevPos, arrowPos, minX, minY, minZ, maxX, maxY, maxZ)) {
            return true;
        }

        vel.x *= 0.99;
        vel.y *= 0.99;
        vel.z *= 0.99;
        vel.y -= 0.05;
    }
    return false;
}

function getLookVector(yaw, pitch) {
    const yawRad = yaw * Math.PI / 180;
    const pitchRad = pitch * Math.PI / 180;
    const f2 = -Math.cos(-pitchRad);
    return {
        x: Math.sin(-yawRad - Math.PI) * f2,
        y: Math.sin(-pitchRad),
        z: Math.cos(-yawRad - Math.PI) * f2
    };
}

function segmentIntersectsAABB(p1, p2, minX, minY, minZ, maxX, maxY, maxZ) {
    if (p1.x >= minX && p1.x <= maxX && p1.y >= minY && p1.y <= maxY && p1.z >= minZ && p1.z <= maxZ) return true;
    if (p2.x >= minX && p2.x <= maxX && p2.y >= minY && p2.y <= maxY && p2.z >= minZ && p2.z <= maxZ) return true;

    const invDir = {
        x: p2.x === p1.x ? 0 : 1 / (p2.x - p1.x),
        y: p2.y === p1.y ? 0 : 1 / (p2.y - p1.y),
        z: p2.z === p1.z ? 0 : 1 / (p2.z - p1.z)
    };
    const t1 = (minX - p1.x) * invDir.x;
    const t2 = (maxX - p1.x) * invDir.x;
    const t3 = (minY - p1.y) * invDir.y;
    const t4 = (maxY - p1.y) * invDir.y;
    const t5 = (minZ - p1.z) * invDir.z;
    const t6 = (maxZ - p1.z) * invDir.z;

    const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
    const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

    if (tmax < 0 || tmin > tmax) return false;
    return tmin <= 1;
}

// ---------- Helpers ----------
function getShotCooldownMs() {
    const lore = Player.getHeldItem()?.getLore();
    if (lore) {
        for (let line of lore) {
            const match = ChatLib.removeFormatting(String(line)).match(/Shot Cooldown: (\d+(?:\.\d+)?)s/);
            if (match) return parseFloat(match[1]) * 1000;
        }
    }
    return Number(Settings.i4shotcooldown) || 500;
}

function isOnPlate() {
    const x = Player.getX();
    const y = Player.getY();
    const z = Player.getZ();
    return x > 61 && x < 65 && z > 34 && z < 37 && y >= 127 && y <= 128;
}

/**
 * Sends a look-only packet using the reliable network handler so the server
 * sees the exact head rotation before every shot.
 */
function syncLookPacket() {
    try {
        const player = Player.getPlayer();
        const packet = new LookAndOnGround(player.getYRot(), player.getXRot(), player.onGround(), player.horizontalCollision);
        Client.getMinecraft().getConnection().send(packet);
    } catch (e) {
        ChatLib.chat("§c[Auto4] Look sync failed: " + e);
    }
}

// Reads the world directly so emeralds are caught even if a packet is missed
function isEmeraldAt(index) {
    const [x, y, z] = blocks[index];
    return Client.getMinecraft().level.getBlockState(new McBlockPos(x, y, z)).is(Blocks.EMERALD_BLOCK);
}

function anyEmerald() {
    return blocks.some((_, i) => isEmeraldAt(i));
}

// Last shot fired at each block: { time, count }. Keeps one emerald from being shot twice while the arrow lands
const shotAt = {};

function recentShot(index, ms) {
    const shot = shotAt[index];
    return shot && Date.now() - shot.time < ms ? shot : null;
}

function retryWaitMs() {
    return Math.max(getShotCooldownMs(), Number(Settings.i4retrydelay) || 800);
}

// Emerald that is ready to be shot, -1 if none. One we already shot is left alone while the arrow lands
function findEmerald() {
    const wait = retryWaitMs();
    for (let i = 0; i < blocks.length; i++) {
        if (isEmeraldAt(i) && !recentShot(i, wait)) return i;
    }
    return -1;
}

// ---------- Packet trigger ----------
const trigger = register("packetSent", (packet, event) => {
    if (packet.hasPosition()) {
        const x = packet.getX(Player.getX());
        const y = packet.getY(Player.getY());
        const z = packet.getZ(Player.getZ());
        if (!(x > 61 && x < 65 && z > 34 && z < 37 && y >= 127 && y <= 128)) {
            while (done.length) done.pop();
            target = null;
        }
    }
}).setFilteredClass(PlayerMoveC2SPacket).unregister();

// ---------- Hit tracking ----------
function onBlock(position, block) {
    if (!Settings.icant4) return;
    if (!isOnPlate()) return;

    const index = blocks.findIndex(xyz => position.every((coord, i) => coord === xyz[i]));
    if (index === -1) return;

    if (block === Blocks.BLUE_TERRACOTTA && !done.includes(index)) {
        done.push(index);
    }
}

function onBlocks(blocksData) {
    for (let data of blocksData) {
        onBlock(...data);
    }
}

// ---------- Targeting ----------
// Aim heights tried in turn when a block keeps getting missed, never above the block
const AIM_Y_OFFSETS = [1, 0.7, 0.4];

function setTarget(index, emerald) {
    cancelRotation();
    target = { index, emerald, aiming: false, aimed: false, tries: 0 };
    debugp(`target ${index} (${emerald ? "emerald" : "prediction"})`);
}

function aim(t) {
    const position = blocks[t.index];
    const shot = recentShot(t.index, 3000);
    const height = AIM_Y_OFFSETS[(shot ? shot.count : 0) % AIM_Y_OFFSETS.length];
    const [yaw, pitch] = getYawPitch(position[0] + 0.5, position[1] + height, position[2]);

    t.aiming = true;
    t.aimed = false;
    startSmoothRotation(yaw, pitch, ROT_BASE_MS + Math.random() * ROT_CAP_MS, () => {
        t.aimed = true;
    }, false);
}

function canPredict() {
    if (!Settings.i4predict) return false;
    if (prefireSpamming) return false;
    if (done.length >= blocks.length) return false;
    // No emerald change for 2s, stop predicting until one shows up
    return Date.now() - lastEmeraldTime <= 2000;
}

function randomUnmarked() {
    const wait = retryWaitMs();
    const open = blocks.map((_, i) => i).filter(i => !done.includes(i) && !recentShot(i, wait));
    return open.length ? open[Math.floor(Math.random() * open.length)] : -1;
}

// Runs every tick while auto4 is enabled and we are on the plate
function runAuto4() {
    if (anyEmerald()) {
        lastEmeraldTime = Date.now();
        prefireSpamming = false;
    }

    if (!Settings.icant4) return;
    if (gameTick < swapLockEndTick) return;

    // Drop a target that no longer needs shooting. The world is the truth for emeralds
    if (target && (target.emerald ? !isEmeraldAt(target.index) : done.includes(target.index))) {
        target = null;
    }

    // Emeralds always win. An unfired prediction is given up, an emerald target stays until it is shot
    const emerald = findEmerald();
    if (emerald !== -1 && !(target && target.emerald)) {
        if (target && target.index === emerald) target.emerald = true;
        else setTarget(emerald, true);
    }

    // No emerald to shoot (none up, or the arrow is still landing), predict where the next one spawns
    if (!target && canPredict()) {
        const index = randomUnmarked();
        if (index !== -1) setTarget(index, false);
    }
    if (!target) return;

    if (!target.aiming) aim(target);
    if (!target.aimed) {
        // Rotation got cancelled elsewhere, aim again next tick
        if (!isRotating()) target.aiming = false;
        return;
    }

    // Aim is off, re-aim a couple of times before shooting anyway
    if (!canHitBlock(target.index) && target.tries < 2) {
        target.tries++;
        target.aiming = false;
        return;
    }

    if (Date.now() - lastShotTime < getShotCooldownMs()) return;

    syncLookPacket();
    rightClick();

    const now = Date.now();
    const previous = recentShot(target.index, 3000);
    lastShotTime = now;
    shotAt[target.index] = { time: now, count: previous ? previous.count + 1 : 1 };
    debugp(`fired at ${target.index} (${target.emerald ? "emerald" : "prediction"}, shot ${shotAt[target.index].count})`);
    target = null;
}

function enable() {
    target = null;
    done.length = 0;
    for (let key in shotAt) delete shotAt[key];
    lastEmeraldTime = Date.now();

    packetBlockChange.addListener(onBlock);
    packetMultiBlockChange.addListener(onBlocks);
    trigger.register();
}

function disable() {
    target = null;
    prefireSpamming = false;
    packetBlockChange.removeListener(onBlock);
    packetMultiBlockChange.removeListener(onBlocks);
    trigger.unregister();
}

// ---------- Phase & device management ----------
register("chat", () => {
    if (Settings.i4ignorephase) return;
    p3Active = true;
    deviceDone = false;
    prefireSpamming = false;
    prefireWaiting = Settings.prefirestun && isOnPlate();
    if (prefireWaiting) {
        const [yaw, pitch] = getBlockYawPitch(80, 119, 40);
        startSmoothRotation(yaw, pitch, ROT_BASE_MS + Math.random() * ROT_CAP_MS, null, false);
    }
    if (auto4Enabled) {
        disable();
        auto4Enabled = false;
    }
}).setCriteria(/^\[BOSS\] Storm: (?:I should have known that I stood no chance\.|At least my son died by your hands\.)$/);

register("chat", () => {
    if (Settings.i4ignorephase) return;
    p3Active = false;
    prefireWaiting = false;
    prefireSpamming = false;
    if (auto4Enabled) {
        disable();
        auto4Enabled = false;
    }
}).setCriteria("The Core entrance is opening!");

// Goldor spawns on phase 3 start, spam the prefire every shot cooldown until the first emerald
register("chat", () => {
    if (!prefireWaiting) return;
    prefireWaiting = false;
    prefireSpamming = true;
}).setCriteria(/^\[BOSS\] Goldor: .*$/);

register("chat", (player, message) => {
    if (player === Player.getName()) {
        if (Settings.i4ignorephase) return;
        deviceDone = true;
        if (auto4Enabled) {
            disable();
            auto4Enabled = false;
        }
    } else {
        if (isOnPlate() && Settings.autoi4leap) {
            ChatLib.command("na leap Tank");
        }
    }
}).setCriteria(/(\w+) completed a device! \((.*?)\)/);

// ---------- Combined tick checker (plate + auto4) ----------
register("tick", () => {
    if (!p3Active && !Settings.i4ignorephase) return;
    if (prefireWaiting) return;

    const onPlate = isOnPlate();

    if (onPlate && !deviceDone && !auto4Enabled) {
        enable();
        auto4Enabled = true;
    } else if (auto4Enabled && (!onPlate || deviceDone)) {
        disable();
        auto4Enabled = false;
        return;
    }

    if (auto4Enabled && onPlate) runAuto4();
});

// ---------- Immunity swaps ----------
register("chat", () => {
    if (isOnPlate() && Settings.AutoImmunitySwap) {
        swapLockEndTick = gameTick + 5;
        ChatLib.command("na rodswap");
    }
}).setCriteria("Second Wind Activated! Your Spirit Mask saved your life!");

// ---------- Misc utils ----------
function getBlockYawPitch(x, y, z) {
    return getYawPitch(x + 0.5, y + 0.5, z + 0.5);
}

function getYawPitch(x, y, z) {
    const difference = new Vector3(x, y, z).subtract(new Vector3(...getPlayerEyeCoords()));
    return [difference.getYaw(), difference.getPitch()];
}