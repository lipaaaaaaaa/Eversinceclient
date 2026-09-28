// spiritsceptre.js — Auto Spirit Sceptre for the Trevor the Trapper quest
//
// Once a trapper quest has been started (detected via chat), this feature
// continuously tracks the position of the pelt mob (the animal Trevor told
// you to hunt). When you get within range it will:
//   1. swap to your Spirit Sceptre in the hotbar
//   2. rotate to the mob (smoothly, using Rotations.js)
//   3. right-click it (via Player.rightClick / interact packet fallback)
//
// The hit is confirmed by the "Your Spirit Sceptre hit <mob>" chat message
// (already cancelled in index.js); on a successful hit we re-arm so the next
// charge can be fired automatically as well.

import Settings from "../config";
import { p, debugp, swapToItem, getDistance3D } from "../utils";
import { startSmoothRotation, cancelRotation, isRotating } from "../Rotations";

const LivingEntityCls = Java.type("net.minecraft.class_1297"); // living entity base (yarn)

// ─── Quest state ──────────────────────────────────────────────────────────────

let questActive = false;   // set when a trevor quest is started
let targetName = null;     // display name of the current pelt mob (e.g. "Spooky Spider")
let lastHitTime = 0;       // ms timestamp of our last sceptre attempt
let rotatingForTarget = false;

// Chat lines that mean "a new hunt has begun"
const QUEST_START_PATTERNS = [
    "Trevor: The animal I want you to track",      // "The animal I want you to track is a ..."
    "Trevor: I could really go for some",          // flavor variant
    "Trevor: Follow the trail of",                 // tracking-quest variant
];

// Chat lines that mean "hunt over"
const QUEST_END_PATTERNS = [
    "Return to the Trapper soon to get a new animal to hunt!",
    "You caught the animal!",
    "I couldn't locate any animals",
];

// Extract the mob name out of the "is a <Mob Name>!" style line
function extractMobName(msg) {
    const m = msg.toLowerCase();
    for (const trigger of ["track", "go for some", "follow the trail of"]) {
        const idx = m.indexOf(trigger);
        if (idx === -1) continue;
        // take everything after the trigger, strip punctuation & colors
        let rest = msg.slice(idx + trigger.length)
            .replace(/§./g, "")
            .replace(/[!.]/g, " ");
        // common filler words to drop
        rest = rest.replace(/\b(is|an?|the|a|of|for|and|some|that|i|want|you|to|keep|it)\b/gi, " ")
                   .replace(/\s+/g, " ")
                   .trim();
        if (rest.length > 2) return rest;
    }
    return null;
}

function cleanName(name) {
    if (!name) return "";
    return name.removeFormatting ? name.removeFormatting() : String(name);
}

function armQuest(source) {
    questActive = true;
    targetName = null;
    debugp(`auto spirit sceptre armed (${source})`);
    p(`Tracking enabled - find ${targetName ?? "the pelt mob"} and I'll shoot it`);
}

function disarmQuest(reason) {
    questActive = false;
    targetName = null;
    if (rotatingForTarget) {
        cancelRotation();
        rotatingForTarget = false;
    }
    debugp(`auto spirit sceptre disarmed (${reason})`);
}

// ─── Chat triggers ────────────────────────────────────────────────────────────

register("chat", (event) => {
    const msg = cleanName(event);
    if (!QUEST_START_PATTERNS.some((pat) => msg.includes(pat))) return;
    const name = extractMobName(msg);
    if (name) {
        targetName = name;
        questActive = true;
        p(`Tracking ${name} for Trevor`);
        debugp(`quest target parsed: "${name}"`);
    } else {
        armQuest("chat start");
    }
}).setContains();

register("chat", (event) => {
    const msg = cleanName(event);
    if (QUEST_END_PATTERNS.some((pat) => msg.includes(pat))) {
        disarmQuest("quest ended/completed");
    }
    // Re-arm instantly after a successful hit so we keep firing each charge
    if (msg.includes("Your Spirit Sceptre hit")) {
        lastHitTime = Date.now();
        rotatingForTarget = false;
        debugp("sceptre hit confirmed, re-armed");
    }
}).setContains();

// ─── Mob finding ──────────────────────────────────────────────────────────────

// Pelt mobs are named hostile/passive mobs matching what Trevor announced.
// If we failed to parse a name, fall back to any non-player entity whose name
// matches a known pelt-mob species.
const PELT_MOB_HINTS = [
    "zombie", "spider", "skeleton", "cave spider", "silverfish",
    "bat", "wolf", "pig", "cow", "sheep", "chicken", "enderman",
    "slug", "ghoul", "spectre", "lion", "yeti", "polar bear",
];

function looksLikePeltMob(displayName) {
    const lower = displayName.toLowerCase();
    return PELT_MOB_HINTS.some((hint) => lower.includes(hint));
}

function findTargetMob() {
    const world = Client.getMinecraft()?.world;
    if (!world) return null;
    const player = Player.getPlayer();
    if (!player) return null;

    let best = null;
    let bestDist = Infinity;

    const entities = world.getEntities();
    for (let i = 0; i < entities.size(); i++) {
        const ent = entities.get(i);
        if (!(ent instanceof LivingEntityCls)) continue;
        if (ent === player) continue;
        try {
            if (ent.isRemoved()) continue; // skip despawned/dead mobs
            if (!ent.isAlive()) continue;
        } catch (e) { /* mapping mismatch — ignore liveness check */ }

        const rawName = ent.getCustomName();
        if (!rawName) continue; // pelt mobs are always name-tagged by the quest
        const displayName = cleanName(rawName.getString ? rawName.getString() : String(rawName));
        if (!displayName) continue;

        const matches = targetName
            ? displayName.toLowerCase().includes(targetName.toLowerCase()) ||
              targetName.toLowerCase().includes(displayName.toLowerCase())
            : looksLikePeltMob(displayName);
        if (!matches) continue;

        const d = getDistance3D(
            player.getX(), player.getY(), player.getZ(),
            ent.getX(), ent.getY() + ent.getHeight() / 2, ent.getZ()
        );
        if (d < bestDist) {
            bestDist = d;
            best = { entity: ent, dist: bestDist };
        }
    }
    return best;
}

// ─── Rotation math ────────────────────────────────────────────────────────────

function rotationTo(entity) {
    const player = Player.getPlayer();
    const px = player.getX();
    const py = player.getY() + player.getDimensions(player.getPose()).height * 0.85; // eye-ish height
    const pz = player.getZ();

    const tx = entity.getX();
    const ty = entity.getY() + entity.getHeight() * 0.6; // aim at body center
    const tz = entity.getZ();

    const dx = tx - px;
    const dy = ty - py;
    const dz = tz - pz;

    const yaw = Math.toDegrees(Math.atan2(dz, dx)) - 90;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    const pitch = -Math.toDegrees(Math.atan2(dy, horizontal));

    return { yaw, pitch };
}

// ─── Firing ───────────────────────────────────────────────────────────────────

function holdingSpiritSceptre() {
    const held = Player.getHeldItem();
    if (!held) return false;
    return cleanName(held.getName()).toLowerCase().includes("spirit sceptre");
}

function sendInteractAtEntityPacket(entityId) {
    try {
        const Hand = Java.type("net.minecraft.class_1268");
        const PacketClass = Java.type("net.minecraft.class_2801"); // ServerboundInteractPacket
        const packet = PacketClass.method_12421 ? PacketClass.method_12421(entityId, true)
                                                : PacketClass.createAttack(entityId);
        if (packet) Client.sendPacket(packet);
        return true;
    } catch (e) {
        debugp("interact packet path failed: " + e);
        return false;
    }
}

function fireAtMob(mob) {
    const now = Date.now();
    if (now - lastHitTime < 500) return; // small cooldown between shots

    if (!holdingSpiritSceptre()) {
        swapToItem("spirit sceptre");
        if (!holdingSpiritSceptre()) return; // not in hotbar, give up this tick
    }

    const { yaw, pitch } = rotationTo(mob.entity);

    // Rotate then right-click. noJitter=true because we need to actually hit.
    rotatingForTarget = true;
    startSmoothRotation(yaw, pitch, 150, () => {
        rotatingForTarget = false;
        if (!questActive || !Settings.autospirit) return;

        // verify still pointing roughly at the mob (it may have moved)
        const fresh = findTargetMob();
        if (!fresh) return;
        const aim = rotationTo(fresh.entity);
        let dyaw = Math.abs(((aim.yaw - Player.getYaw() + 180) % 360) - 180);
        let dpitch = Math.abs(aim.pitch - Player.getPitch());
        if (dyaw > 5 || dpitch > 5) {
            debugp(`aim drifted off target (yaw ${dyaw.toFixed(1)}, pitch ${dpitch.toFixed(1)}), retrying`);
            rotatingForTarget = true;
            startSmoothRotation(aim.yaw, aim.pitch, 60, () => {
                rotatingForTarget = false;
                doRightClick(fresh.entity);
            }, true);
            return;
        }
        doRightClick(fresh.entity);
    }, true);
}

function doRightClick(entity) {
    lastHitTime = Date.now();
    debugp("right-clicking pelt mob");
    try {
        // Preferred: real client interaction (renders swing, sends packet)
        Player.rightClick(entity);
    } catch (e) {
        debugp("Player.rightClick failed: " + e);
        // Fallback: vanilla mouse-use simulation
        try {
            Client.getMinecraft().interactionManager.interactAt(
                entity, entity.getY() + entity.getHeight() / 2, false);
        } catch (e2) {
            debugp("interactAt failed: " + e2);
            // Last resort: hand-crafted attack/interact packet
            sendInteractAtEntityPacket(entity.getId());
        }
    }
}

// ─── Main loop ────────────────────────────────────────────────────────────────

register("tick", () => {
    if (!Settings.autospirit || !questActive) return;
    if (isRotating()) return; // mid-rotation, wait for it to finish

    const mob = findTargetMob();
    if (!mob) return;

    const range = Number(Settings.sceptredist) || 20;
    if (mob.dist <= range) {
        fireAtMob(mob);
    }
});

// Safety: stop tracking on logout / world change so stale state doesn't linger.
// Note: valid ChatTriggers trigger types are things like "worldLoad", "tick",
// "chat", etc. There is NO "gameExit" trigger (nor "serverLeave") — registering
// one throws NoSuchMethodException and breaks module loading. "worldLoad" fires
// whenever a new world/server session begins, which covers leaving a server
// (the old quest state must not carry over into the new world).
register("worldLoad", () => {
    disarmQuest("world change / left server");
});
