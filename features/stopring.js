// stopRing.js — ChatTriggers 3.0 (Synnerz/ctjs, Fabric 1.21)
//
// Exports:
//   stopRing.enable()   — hold counter-strafe keys every tick until disabled
//   stopRing.disable()  — stop and release keys
//   stopRing.isActive() — bool
//   snapStop()          — apply counter-strafe for exactly 1 tick, then release

const SPEED_SQ_THRESHOLD = 1e-4;
const FRICTION           = 0.91;

function squaredAfterTick(fwdDot, rightDot, accelFwd, accelRight) {
    const nx = (fwdDot   + accelFwd)   * FRICTION;
    const nz = (rightDot + accelRight) * FRICTION;
    return nx * nx + nz * nz;
}

// ─── Core: compute and apply counter-strafe keys for the current tick ─────────

function applyCounterStrafe() {
    const mc     = Client.getMinecraft();
    const player = mc.player;
    const opts   = mc.options;
    if (!player || !opts) return;

    const vel     = player.getVelocity();
    const vx      = vel.getX();
    const vz      = vel.getZ();
    const speedSq = vx * vx + vz * vz;

    if (speedSq < SPEED_SQ_THRESHOLD) {
        releaseKeys(opts);
        return;
    }

    const yawRad = player.getYaw() * (Math.PI / 180.0);
    const sinYaw = Math.sin(yawRad);
    const cosYaw = Math.cos(yawRad);

    const fwdDot   = vx * (-sinYaw) + vz * cosYaw;
    const rightDot = vx *   cosYaw  + vz * sinYaw;
    const accel    = player.getMovementSpeed() * 0.98;

    const baseNextSq = squaredAfterTick(fwdDot, rightDot, 0.0, 0.0);

    opts.forwardKey.setPressed(fwdDot   < -0.01 && squaredAfterTick(fwdDot, rightDot,  accel,  0.0) < baseNextSq);
    opts.backKey   .setPressed(fwdDot   >  0.01 && squaredAfterTick(fwdDot, rightDot, -accel,  0.0) < baseNextSq);
    opts.leftKey   .setPressed(rightDot >  0.01 && squaredAfterTick(fwdDot, rightDot,  0.0,  -accel) < baseNextSq);
    opts.rightKey  .setPressed(rightDot < -0.01 && squaredAfterTick(fwdDot, rightDot,  0.0,   accel) < baseNextSq);
}

function releaseKeys(opts) {
    if (!opts) {
        const mc = Client.getMinecraft();
        opts = mc && mc.options;
    }
    if (!opts) return;
    opts.forwardKey.setPressed(false);
    opts.backKey   .setPressed(false);
    opts.leftKey   .setPressed(false);
    opts.rightKey  .setPressed(false);
}
/*
export function nwlk(opts) {
    if (!opts) {
        const mc = Client.getMinecraft();
        opts = mc && mc.options;
    }
    if (!opts) return;
    opts.forwardKey.setPressed(false);
    opts.backKey   .setPressed(true);
    setTimeout(() => {
    opts.forwardKey.setPressed(false);
    }, 50);

}*/

// ─── Continuous mode ──────────────────────────────────────────────────────────

const stopRing = (() => {
    let trigger = null;

    return {
        enable() {
            if (trigger) return;
            trigger = register('tick', applyCounterStrafe);
        },

        disable() {
            if (!trigger) return;
            trigger.unregister();
            trigger = null;
            releaseKeys();
        },

        isActive() {
            return trigger !== null;
        }
    };
})();

// ─── Snap-stop: press counter-strafe for exactly 1 tick, release next tick ───
//
// The two-trigger pattern is the CT3 equivalent of "do X on tick N, undo on
// tick N+1".  We cannot use setTimeout/promises because CT3's Rhino runtime
// does not support them — everything is synchronous per-tick callbacks.
//
//  Tick N   : snapStopTick fires → applyCounterStrafe() → unregisters itself
//             → registers releaseTick
//  Tick N+1 : releaseTick fires  → releaseKeys()        → unregisters itself

export function snapStop() {
    // Don't double-register if already pending.
    if (snapStop._snapTrigger || snapStop._releaseTrigger) return;

    snapStop._snapTrigger = register('tick', function snapStopTick() {
        snapStop._snapTrigger.unregister();
        snapStop._snapTrigger = null;

        applyCounterStrafe();

        snapStop._releaseTrigger = register('tick', function releaseTick() {
            snapStop._releaseTrigger.unregister();
            snapStop._releaseTrigger = null;
            releaseKeys();
        });
    });
}
snapStop._snapTrigger    = null;
snapStop._releaseTrigger = null;

export default stopRing;