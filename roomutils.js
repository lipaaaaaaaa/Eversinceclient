// ----- Try to find the correct DungeonUtils class -----
import * as Utils from "./utils";
const p = (...args) => { try { if (Utils.p) return Utils.p(...args); } catch(e) {} console.log("[abdl] " + args.join(" ")); };

const possibleClasses = [
    "com.odtheking.odin.utils.skyblock.dungeon.DungeonUtils",   // most likely
    "com.odtheking.odin.utils.skyblock.dungeon.DungeonManager",
    "com.odtheking.odin.utils.skyblock.dungeon.RoomManager",
    "me.odinmain.utils.skyblock.dungeon.DungeonUtils",          // fallback (Forge)
];

let DungeonUtils = null;
for (let className of possibleClasses) {
    try {
        DungeonUtils = Java.type(className);
        // console.log(`&a[RoomUtils] Successfully loaded class: ${className}`); // commented out
        break;
    } catch (e) {
        // console.log(`&c[RoomUtils] Failed to load ${className}: ${e.message}`); // commented out
    }
}

if (!DungeonUtils) {
    throw new Error("&c[RoomUtils] Could not find any DungeonUtils class. Make sure OdinFabric is installed.");
}

// Now we have DungeonUtils (hopefully with an INSTANCE field)
const OdinDungeonUtils = DungeonUtils; // keep the name for compatibility

// ----- MathHelper for Fabric 1.21 -----
let MathHelper;
try {
    MathHelper = Java.type("net.minecraft.util.math.MathHelper");
} catch (e) {
    try {
        MathHelper = Java.type("net.minecraft.util.MathHelper");
    } catch (e2) {
        // console.log("&c[RoomUtils] CRITICAL: Could not load MathHelper. Yaw conversions disabled."); // commented out
        MathHelper = { wrapDegrees: (yaw) => yaw };
    }
}

// ----- Vec3 for built‑in methods (optional) -----
let Vec3;
try {
    Vec3 = Java.type("net.minecraft.util.math.Vec3d");
} catch (e) {
    try {
        Vec3 = Java.type("net.minecraft.util.Vec3");
    } catch (e2) {
        // console.log("&c[RoomUtils] Vec3 not found, built‑in Odin methods disabled."); // commented out
        Vec3 = null;
    }
}

export class RoomUtils {
    static xFlip = false;
    static zFlip = false;
    static useOdinBuiltins = false; // will be set if we find working methods

    static getCurrentRoom() {
        // --- Try to get current room ---
        let room = null;
        try {
            room = DungeonUtils.INSTANCE.currentRoom || DungeonUtils.INSTANCE.getCurrentRoom?.();
            if (room && !RoomUtils._checkedBuiltins && typeof DungeonUtils.INSTANCE.getRelativeCoords === "function" && Vec3 !== null) {
                RoomUtils.useOdinBuiltins = true;
            }
            RoomUtils._checkedBuiltins = true;
        } catch (e) {}

        if (room) return room;

        // --- Scan all rooms (Fallback/Precision check) ---
        try {
            let rooms = DungeonUtils.INSTANCE.fullRoomList || DungeonUtils.INSTANCE.getFullRoomList?.();
            if (rooms && rooms.size() > 0) {
                let px = Player.getX();
                let pz = Player.getZ();
                let iterator = rooms.iterator();
                while (iterator.hasNext()) {
                    let r = iterator.next();
                    let rx = r.x;
                    let rz = r.z;
                    if (rx === undefined && r.gridX !== undefined) rx = r.gridX * 32;
                    if (rz === undefined && r.gridZ !== undefined) rz = r.gridZ * 32;
                    
                    if (rx != null && rz != null && r.data) {
                        let sx = (r.data.sizeX || 1) * 32;
                        let sz = (r.data.sizeY || r.data.sizeZ || 1) * 32;
                        if (px >= rx && px < rx + sx && pz >= rz && pz < rz + sz) {
                            return r;
                        }
                    }
                }
            }
        } catch (e) {}

        return null;
    }

    static getCurrentRoomName() {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return "Unknown";

        try {
            if (room.data && room.data.name) return room.data.name;
        } catch (e) {}
        try {
            return DungeonUtils.INSTANCE.currentRoomName;
        } catch (e) {}
        return "Unknown";
    }

    static getRotation() {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return "NORTH";
        
        // Lazy load settings to avoid circular dependencies during initialization
        const Settings = require("./config").default;
        
        let rot = room.rotation;
        if (rot === null || rot === undefined) return "NORTH";
        
        let rotStr = String(rot).toUpperCase();
        let result = "NORTH";

        // Odin/Standard Dungeon Mapping: 0=N, 1=E, 2=S, 3=W.
        if (rotStr === "NORTH" || rotStr === "0") result = RoomUtils.zFlip ? "SOUTH" : "NORTH";
        else if (rotStr === "EAST"  || rotStr === "1") result = RoomUtils.xFlip ? "WEST"  : "EAST";
        else if (rotStr === "SOUTH" || rotStr === "2") result = RoomUtils.zFlip ? "NORTH" : "SOUTH";
        else if (rotStr === "WEST"  || rotStr === "3") result = RoomUtils.xFlip ? "EAST"  : "WEST";

        if (Settings.routesDebug && Math.random() < 0.1) p("Room Rotation: " + rotStr + " -> " + result);
        return result;
    }

    static getRelativeCoords(x, y, z) {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return [x, y, z];

        if (RoomUtils.useOdinBuiltins) {
            try {
                const vec = new Vec3(x, y, z);
                const rel = DungeonUtils.INSTANCE.getRelativeCoords(room, vec);
                return [rel.x, rel.y, rel.z];
            } catch (e) {
                // console.log(`&c[RoomUtils] Built‑in getRelativeCoords failed: ${e}`); // commented out
                // fall through to manual calculation
            }
        }

        const center = RoomUtils.getCenter();
        if (!center) return [x, y, z];
        let dx = x - center[0], dz = z - center[1];
        const rot = RoomUtils.getRotation();
        switch (rot) {
            case "NORTH": return [ dx, y,  dz];
            case "WEST":  return [-dz, y,  dx];
            case "SOUTH": return [-dx, y, -dz];
            case "EAST":  return [ dz, y, -dx];
            default:      return [ dx, y,  dz];
        }
    }

    static getRealCoords(x, y, z) {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return [x, y, z];

        if (RoomUtils.useOdinBuiltins) {
            try {
                const vec = new Vec3(x, y, z);
                const real = DungeonUtils.INSTANCE.getRealCoords(room, vec);
                return [real.x, real.y, real.z];
            } catch (e) {
                // console.log(`&c[RoomUtils] Built‑in getRealCoords failed: ${e}`); // commented out
                // fall through
            }
        }

        const center = RoomUtils.getCenter();
        if (!center) return [x, y, z];
        let dx = x, dz = z;
        const rot = RoomUtils.getRotation();
        switch (rot) {
            case "NORTH": break;
            case "WEST":  [dx, dz] = [ dz, -dx]; break;
            case "SOUTH": [dx, dz] = [-dx, -dz]; break;
            case "EAST":  [dx, dz] = [-dz,  dx]; break;
        }
        return [dx + center[0], y, dz + center[1]];
    }

    static getCenter() {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return [0, 0];

        // 1. Try to use Odin's built-in room bounds for perfect stability.
        // In OdinFabric, room.x/z are absolute block coordinates of the room corner.
        // sizeX/sizeY are units of 32 blocks.
        try {
            // Check for x/z directly on room or room.data
            let rx = room.x;
            let rz = room.z;

            // In some versions, it might be gridX/gridZ
            if (rx === undefined && room.gridX !== undefined) rx = room.gridX * 32;
            if (rz === undefined && room.gridZ !== undefined) rz = room.gridZ * 32;

            if (rx != null && rz != null && room.data) {
                let sX = room.data.sizeX || 1;
                let sZ = room.data.sizeY || room.data.sizeZ || 1;
                return [
                    rx + (sX * 16) - 0.5,
                    rz + (sZ * 16) - 0.5
                ];
            }
        } catch (e) {}

        // 2. Fallback to block iteration if room properties are missing or incomplete.
        // --- Find roomComponents ---
        let components = null;
        const possibleProps = ["roomComponents", "components", "allBlocks", "blocks"];
        for (let prop of possibleProps) {
            try {
                let value = room[prop];
                if (value != null) {
                    components = value;
                    break;
                }
            } catch (e) {}
        }

        if (!components) {
            // console.log("&c[RoomUtils] No components property found."); // commented out
            return [0, 0];
        }

        // --- Determine collection type and size ---
        let size = -1;
        try {
            if (components instanceof Java.type("java.util.Collection")) {
                size = components.size();
            } else if (components.length !== undefined) {
                size = components.length;
            }
        } catch (e) {}

        if (size === 0) {
            // console.log("&c[RoomUtils] components collection is empty."); // commented out
            return [0, 0];
        }

        // --- Iteration helpers ---
        const getX = (comp) => {
            if (comp.x != null) return comp.x + 0.5;
            if (comp.getX instanceof Function) return comp.getX() + 0.5;
            return 0;
        };
        const getZ = (comp) => {
            if (comp.z != null) return comp.z + 0.5;
            if (comp.getZ instanceof Function) return comp.getZ() + 0.5;
            return 0;
        };

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        let count = 0;

        try {
            if (components instanceof Java.type("java.lang.Iterable")) {
                let iterator = components.iterator();
                while (iterator.hasNext()) {
                    let comp = iterator.next();
                    let x = getX(comp);
                    let z = getZ(comp);
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                    count++;
                }
            } else if (components.length !== undefined) {
                for (let i = 0; i < components.length; i++) {
                    let comp = components[i];
                    let x = getX(comp);
                    let z = getZ(comp);
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                    count++;
                }
            } else {
                return [0, 0];
            }
        } catch (e) {
            return [0, 0];
        }

        if (count === 0) return [0, 0];

        return [(minX + maxX) * 0.5, (minZ + maxZ) * 0.5];
    }

    static getRealYaw(yaw) {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return yaw;
        const rot = RoomUtils.getRotation();
        yaw = Number(yaw);
        switch (rot) {
            case "NORTH": break;
            case "EAST":  yaw += 90;  break;
            case "SOUTH": yaw += 180; break;
            case "WEST":  yaw += 270; break;
        }
        return MathHelper.wrapDegrees(yaw);
    }

    static getRelativeYaw(yaw) {
        const room = RoomUtils.getCurrentRoom();
        if (!room) return yaw;
        const rot = RoomUtils.getRotation();
        yaw = Number(yaw);
        switch (rot) {
            case "NORTH": break;
            case "EAST":  yaw -= 90;  break;
            case "SOUTH": yaw -= 180; break;
            case "WEST":  yaw -= 270; break;
        }
        return MathHelper.wrapDegrees(yaw);
    }
}