import Settings from "../config"
import Vector3 from "../Vector3";
import packetBlockChange from "../events/packetBlockChange";
import packetMultiBlockChange from "../events/packetMultiBlockChange";
import { startSmoothRotation, isRotating, cancelRotation } from "../events/Rotations";
import { rightClick } from "../utils";

function getPlayerEyeCoords() {
    const player = Player.getPlayer();
    return [Player.getX(), Player.getY() + player.getEyeHeight(player.getPose()), Player.getZ()];
}

// Mojmap: net.minecraft.world.level.block.Blocks
const Blocks = Java.type("net.minecraft.world.level.block.Blocks");

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

const done = [];
let currentTarget = null;
let predicting = false;
let lastTargetIndex = -1;

// Phase / device state
let p3Active = false;
let deviceDone = false;
let auto4Enabled = false;
let prefireWaiting = false;

// ---------- Shot scheduling ----------
let emeraldQueued = false;
let shotCountdown = 0;
let gameTick = 0;
let swapLockEndTick = 0;

register("tick", () => {
    gameTick++;
    if (gameTick < swapLockEndTick) return;
    if (shotCountdown <= 0) return;

    shotCountdown--;
    if (shotCountdown === 0) {
        // If target became done while countdown was active, abort
        if (lastTargetIndex >= 0 && done.includes(lastTargetIndex)) {
            lastTargetIndex = -1;
            if (emeraldQueued) emeraldQueued = false;
            if (!emeraldQueued && done.length < blocks.length) predictNext(currentTarget);
            return;
        }
        // Fire immediately, trajectory was already checked before countdown
        rightClick();
        lastTargetIndex = -1;
        if (emeraldQueued) {
            emeraldQueued = false;
        }
        if (!emeraldQueued && done.length < blocks.length) {
            predictNext(currentTarget);
        }
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

function findEmeraldIndex() {
    for (let i = 0; i < blocks.length; i++) {
        if (done.includes(i)) continue;
        const [x, y, z] = blocks[i];
        const blockAt = World.getBlockAt(x, y, z);
        if (blockAt === Blocks.EMERALD_BLOCK) {
            return i;
        }
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
            currentTarget = null;
            predicting = false;
            lastTargetIndex = -1;
        }
    }
}).setFilteredClass(PlayerMoveC2SPacket).unregister();

// ---------- Core solver ----------
function onBlock(position, block) {
    if (!Settings.icant4) return;
    if (!isOnPlate()) return;

    const index = blocks.findIndex(xyz => position.every((coord, i) => coord === xyz[i]));
    if (index === -1) return;

    if (block === Blocks.BLUE_TERRACOTTA) {
        if (!done.includes(index)) {
            done.push(index);
        }
        if (lastTargetIndex === index && !emeraldQueued) {
            cancelRotation();
            shotCountdown = 0;
            lastTargetIndex = -1;
            if (done.length < blocks.length && !predicting) predictNext(currentTarget);
        }
        if (currentTarget === index) {
            currentTarget = null;
            lastTargetIndex = -1;
        }
        if (currentTarget === null && done.length < blocks.length && !predicting) {
            predictNext();
        }
        return;
    }

    if (block === Blocks.EMERALD_BLOCK) {
        cancelRotation();
        shotCountdown = 0;
        predicting = false;
        emeraldQueued = true;
        currentTarget = index;
        shootTargetEmerald(index, 0);
        return;
    }
}

function shootTargetEmerald(index, retryCount) {
    if (!auto4Enabled) return;
    if (done.includes(index)) {
        emeraldQueued = false;
        return;
    }

    if (index === lastTargetIndex && !isRotating()) {
        if (!canHitBlock(index) && retryCount < 2) {
            lastTargetIndex = -1;
            shootTargetEmerald(index, retryCount + 1);
            return;
        }
        shotCountdown = 1;
        return;
    }

    const position = blocks[index];
    const [yaw, pitch] = getYawPitch(position[0] + 0.5, position[1] + 1, position[2]);

    const rotDuration = ROT_BASE_MS + Math.random() * ROT_CAP_MS;
    lastTargetIndex = index;
    startSmoothRotation(yaw, pitch, rotDuration, () => {
        if (!auto4Enabled) return;
        if (done.includes(index)) {
            emeraldQueued = false;
            return;
        }
        if (!canHitBlock(index) && retryCount < 2) {
            shootTargetEmerald(index, retryCount + 1);
            return;
        }
        syncLookPacket();
        shotCountdown = 1;
    }, false);
}

function shootTarget(index, retryCount) {
    if (!auto4Enabled) return;
    if (emeraldQueued) return;
    if (done.includes(index)) {
        if (done.length < blocks.length) predictNext(currentTarget);
        return;
    }

    if (index === lastTargetIndex && !isRotating()) {
        if (!canHitBlock(index) && retryCount < 2) {
            lastTargetIndex = -1;
            shootTarget(index, retryCount + 1);
            return;
        }
        syncLookPacket();
        shotCountdown = 2;
        return;
    }

    const position = blocks[index];
    const [yaw, pitch] = getYawPitch(position[0] + 0.5, position[1] + 1, position[2]);

    const rotDuration = ROT_BASE_MS + Math.random() * ROT_CAP_MS;
    lastTargetIndex = index;

    startSmoothRotation(yaw, pitch, rotDuration, () => {
        if (!auto4Enabled) return;
        if (emeraldQueued) return;
        if (done.includes(index)) {
            if (done.length < blocks.length) predictNext(currentTarget);
            return;
        }
        if (!canHitBlock(index) && retryCount < 2) {
            shootTarget(index, retryCount + 1);
            return;
        }
        syncLookPacket();
        shotCountdown = 2;
    }, false);
}

function predictNext(excludeIndex) {
    if (!auto4Enabled) return;
    if (emeraldQueued) return;

    const unmarked = blocks.map((_, i) => i).filter(i => !done.includes(i) && i !== excludeIndex);
    if (unmarked.length === 0) return;

    const randomIndex = unmarked[Math.floor(Math.random() * unmarked.length)];
    predicting = true;
    shootTarget(randomIndex, 0);
}

function onBlocks(blocksData) {
    for (let data of blocksData) {
        onBlock(...data);
    }
}

function enable() {
    currentTarget = null;
    predicting = false;
    lastTargetIndex = -1;
    done.length = 0;
    emeraldQueued = false;
    shotCountdown = 0;

    packetBlockChange.addListener(onBlock);
    packetMultiBlockChange.addListener(onBlocks);
    trigger.register();
}

function disable() {
    shotCountdown = 0;
    emeraldQueued = false;
    packetBlockChange.removeListener(onBlock);
    packetMultiBlockChange.removeListener(onBlocks);
    trigger.unregister();
}

// ---------- Phase & device management ----------
register("chat", () => {
    if (Settings.i4ignorephase) return;
    p3Active = true;
    deviceDone = false;
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
    if (auto4Enabled) {
        disable();
        auto4Enabled = false;
    }
}).setCriteria("The Core entrance is opening!");

// Goldor spawns on phase 3 start, shoot the prefire once then let auto4 run
register("chat", () => {
    if (!prefireWaiting) return;
    prefireWaiting = false;
    syncLookPacket();
    rightClick();
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

// ---------- Combined tick checker (plate + emerald safeguard) ----------
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

    if (auto4Enabled && onPlate) {
        const emeraldIdx = findEmeraldIndex();
        if (emeraldIdx !== -1) {
            // Only cancel if we are NOT already rotating towards this exact emerald
            if (!emeraldQueued || currentTarget !== emeraldIdx) {
                // If a rotation is already aiming at this emerald, let it finish
                if (isRotating() && lastTargetIndex === emeraldIdx) return;

                cancelRotation();
                shotCountdown = 0;
                predicting = false;
                emeraldQueued = true;
                currentTarget = emeraldIdx;
                shootTargetEmerald(emeraldIdx, 0);
            }
        }
    }
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