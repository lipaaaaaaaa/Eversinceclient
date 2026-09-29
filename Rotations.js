/// 

import Settings from "./config";
import { p } from "./utils";

let rotTargetYaw = null;
let rotTargetPitch = null;
let rotStartYaw = null;
let rotStartPitch = null;
let currentRotDuration = 250;

// Pre‑computed per rotation
let rotJitterSeed = 0;
let rotStartTime = 0;
let rotStartDelayMs = 0;
let rotDipAmount = 0;
let rotSwayAmount = 0;
let rotWanderFreqY = 13;
let rotWanderFreqP = 14;
let rotVelocityWobbleAmp = 0.015;
let rotPanicActive = false;
let rotPanicProgress = 0.5;
let rotPanicAmplitude = 1.0;
let rotImpulses = [];

// Tremor control
let rotTremorActive = false;
let rotTremorFreq = 21;
let rotTremorAmp = 0.005;

let rotNoJitter = false;
let rotFixedOffsetYaw = 0;
let rotFixedOffsetPitch = 0;

// Bézier control points
let rotBezierC1X = 0.42;
let rotBezierC1Y = 0.0;
let rotBezierC2X = 1.0;
let rotBezierC2Y = 1.0;

// End‑bump parameters (randomised per rotation)
let rotEndPeak = 0.92;
let rotEndWidth = 0.06;

let rotationFinishCallback = null;

export function isRotating() {
    return rotTargetYaw !== null && rotTargetPitch !== null;
}

export function cancelRotation() {
    rotTargetYaw = null;
    rotTargetPitch = null;
    rotationFinishCallback = null;
}

// Bézier easing
function bezierEasing(x, x1, y1, x2, y2) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
        let oneMinusT = 1 - t;
        let a = 3 * oneMinusT * oneMinusT * t * x1;
        let b = 3 * oneMinusT * t * t * x2;
        let c = t * t * t;
        let currentX = a + b + c;
        if (Math.abs(currentX - x) < 0.0001) break;
        let da = 3 * x1 * oneMinusT * (oneMinusT - 2 * t);
        let db = 3 * x2 * t * (2 * oneMinusT - t);
        let dc = 3 * t * t;
        let derivative = da + db + dc;
        if (Math.abs(derivative) < 0.00001) break;
        t -= (currentX - x) / derivative;
        t = Math.max(0, Math.min(1, t));
    }
    let oneMinusT = 1 - t;
    let ay = 3 * oneMinusT * oneMinusT * t * y1;
    let by = 3 * oneMinusT * t * t * y2;
    let cy = t * t * t;
    return ay + by + cy;
}

function randomBezierControlPoints() {
    let x1 = 0.2 + Math.random() * 0.6;
    let y1 = Math.random() * 0.3;
    let x2 = 0.4 + Math.random() * 0.5;
    let y2 = 0.7 + Math.random() * 0.3;
    if (x2 < x1) [x1, x2] = [x2, x1];
    if (y2 < y1) [y1, y2] = [y2, y1];
    return { x1, y1, x2, y2 };
}

export function startSmoothRotation(yaw, pitch, durationMs, onFinish, noJitter) {
    const player = Player.getPlayer();
    if (!player) return;

    // Mojmap: getYaw() -> getYRot(), getPitch() -> getXRot()
    const startYaw = player.getYRot();
    const startPitch = player.getXRot();

    let dy = (yaw - startYaw) % 360;
    if (dy > 180) dy -= 360;
    if (dy < -180) dy += 360;
    const targetYawBase = startYaw + dy;
    const targetPitchBase = pitch;
    const dp = targetPitchBase - startPitch;
    const totalDist = Math.sqrt(dy * dy + dp * dp);

    if (totalDist < 0.01) {
        // Mojmap: setYaw() -> setYRot(), setPitch() -> setXRot()
        player.setYRot(targetYawBase);
        player.setXRot(targetPitchBase);
        if (onFinish) onFinish();
        return;
    }

    const isSmall = totalDist < 2.0;

    // --- Panic-based snap (1% overall chance) ---
    let snapPanic = false;
    if (!noJitter && totalDist > 0.5 && Math.random() < 0.15) {
        // Panic active – 7% chance it's a snap variant
        snapPanic = Math.random() < 0.07;
    }

    rotNoJitter = snapPanic || noJitter;
    currentRotDuration = snapPanic ? (50 + Math.random() * 50) : (durationMs || 150);

    // Fixed aiming offset – only for larger moves, never when snapping
    if (!isSmall && !rotNoJitter) {
        const offsetRange = 0.1 + Math.random() * 0.4;
        rotFixedOffsetYaw = Math.min(0.5, Math.max(-0.5, (Math.random() - 0.5) * 2 * offsetRange));
        rotFixedOffsetPitch = Math.min(0.5, Math.max(-0.5, (Math.random() - 0.5) * 2 * offsetRange));
    } else {
        rotFixedOffsetYaw = 0;
        rotFixedOffsetPitch = 0;
    }

    const axisSensYaw = 0.95 + Math.random() * 0.1;
    const axisSensPitch = 0.9 + Math.random() * 0.1;
    const finalTargetYaw = targetYawBase + rotFixedOffsetYaw + (axisSensYaw - 1) * dy;
    const finalTargetPitch = targetPitchBase + rotFixedOffsetPitch + (axisSensPitch - 1) * dp;

    rotTargetYaw = finalTargetYaw;
    rotTargetPitch = finalTargetPitch;
    rotStartYaw = startYaw;
    rotStartPitch = startPitch;
    rotationFinishCallback = onFinish;

    rotJitterSeed = (Date.now() % 10000) + Math.random() * 1000;
    rotStartTime = Date.now();

    if (!rotNoJitter) {
        rotStartDelayMs = Math.random() < 0.15 ? 0 : 40 + Math.random() * 140;
        rotStartDelayMs = Math.min(rotStartDelayMs, currentRotDuration * 0.35);
        if (rotStartDelayMs >= currentRotDuration) rotStartDelayMs = currentRotDuration * 0.3;

        const bez = randomBezierControlPoints();
        rotBezierC1X = bez.x1;
        rotBezierC1Y = bez.y1;
        rotBezierC2X = bez.x2;
        rotBezierC2Y = bez.y2;

        rotWanderFreqY = 11 + Math.random() * 8;
        rotWanderFreqP = 12 + Math.random() * 8;

        rotDipAmount = 0.01 + Math.random() * 0.02;
        rotSwayAmount = 0.01 + Math.random() * 0.02;

        rotVelocityWobbleAmp = 0.01 + Math.random() * 0.02;

        // Standard panic behaviour (tremor spike)
        rotPanicActive = Math.random() < 0.15;   // 15% chance
        if (rotPanicActive) {
            rotPanicProgress = 0.2 + Math.random() * 0.6;
            rotPanicAmplitude = 3 + Math.random() * 3;
        }

        rotImpulses = [];
        if (Math.random() < 0.3) {
            let progress = 0.5 + Math.random() * 0.4;
            const angle = Math.random() * 2 * Math.PI;
            const mag = 0.05 + Math.random() * 0.15;
            rotImpulses.push({
                progress: progress,
                yaw: Math.cos(angle) * mag,
                pitch: Math.sin(angle) * mag,
                width: 0.05 + Math.random() * 0.03
            });
        }

        rotTremorActive = Math.random() < 0.1;
        if (rotTremorActive) {
            rotTremorFreq = 15 + Math.random() * 10;
            rotTremorAmp = 0.003 + Math.random() * 0.004;
        }

        rotEndPeak = 0.88 + Math.random() * 0.08;
        rotEndWidth = 0.04 + Math.random() * 0.04;
    } else {
        // Snap or noJitter – all humanisation off
        rotStartDelayMs = 0;
        rotBezierC1X = 0;
        rotBezierC1Y = 0;
        rotBezierC2X = 1;
        rotBezierC2Y = 1;
        rotPanicActive = false;
        rotImpulses = [];
        rotTremorActive = false;
        rotEndPeak = 0.92;
        rotEndWidth = 0.06;
    }
}

register("renderWorld", function (partialTicks) {
    if (rotTargetYaw === null || rotTargetPitch === null) return;

    try {
        const now = Date.now();
        const elapsed = now - rotStartTime;

        if (elapsed < rotStartDelayMs) return;

        const effectiveDuration = Math.max(1, currentRotDuration - rotStartDelayMs);
        const activeElapsed = elapsed - rotStartDelayMs;
        let rawProgress = Math.min(1, activeElapsed / effectiveDuration);
        if (isNaN(rawProgress)) rawProgress = 1;

        let wobbleProgress = rawProgress;
        if (!rotNoJitter && rawProgress > 0.01 && rawProgress < 0.99) {
            const wobble = rotVelocityWobbleAmp *
                           Math.sin(rawProgress * (6 + (rotJitterSeed % 3)) + rotJitterSeed * 0.1) *
                           Math.sin(rawProgress * Math.PI);
            wobbleProgress = Math.max(0, Math.min(1, rawProgress + wobble));
        }

        const easedProgress = bezierEasing(wobbleProgress, rotBezierC1X, rotBezierC1Y, rotBezierC2X, rotBezierC2Y);

        const baseYaw = rotStartYaw + (rotTargetYaw - rotStartYaw) * easedProgress;
        const basePitch = rotStartPitch + (rotTargetPitch - rotStartPitch) * easedProgress;

        let jitterYaw = 0, jitterPitch = 0;

        if (!rotNoJitter && easedProgress <= 0.98) {
            const distY = rotTargetYaw - rotStartYaw;
            const distP = rotTargetPitch - rotStartPitch;
            const totalDist = Math.sqrt(distY * distY + distP * distP);

            const endMask = Math.exp(-Math.pow((easedProgress - rotEndPeak) / rotEndWidth, 2));
            const strengthMultiplier = 0.3;

            const smallScale = totalDist < 2 ? 0.3 : 1.0;
            const baseJitter = 0.01 + (rotJitterSeed % 1) * 0.03;
            const ampY = baseJitter * smallScale * 0.4 * strengthMultiplier;
            const ampP = baseJitter * smallScale * 0.4 * strengthMultiplier;

            const yawComponent = (Math.sin(easedProgress * rotWanderFreqY + rotJitterSeed) * 0.6 +
                                  Math.sin(easedProgress * rotWanderFreqY * 2.3) * 0.3) * ampY * endMask;
            const pitchComponent = (Math.cos(easedProgress * rotWanderFreqP + rotJitterSeed * 1.3) * 0.6 +
                                    Math.cos(easedProgress * rotWanderFreqP * 2.7) * 0.3) * ampP * endMask * 2.0;

            let tremor = 0;
            if (rotTremorActive) {
                tremor = Math.sin(easedProgress * rotTremorFreq + rotJitterSeed * 2) * rotTremorAmp * endMask * strengthMultiplier;
            }

            const horizontal = Math.abs(distY) > Math.abs(distP);
            let dipEffect = 0, swayEffect = 0;
            if (horizontal) {
                dipEffect = -rotDipAmount * Math.sin(easedProgress * Math.PI) * endMask * strengthMultiplier;
            } else {
                swayEffect = rotSwayAmount * Math.sin(easedProgress * Math.PI * 0.9 + rotJitterSeed) * endMask * strengthMultiplier;
            }

            jitterYaw = yawComponent + tremor + swayEffect;
            jitterPitch = pitchComponent + tremor + dipEffect;

            // Standard panic spike
            if (rotPanicActive && Math.abs(easedProgress - rotPanicProgress) < 0.07) {
                const panicMask = Math.exp(-Math.pow((easedProgress - rotPanicProgress) / 0.03, 2));
                jitterYaw *= (1 + rotPanicAmplitude * panicMask);
                jitterPitch *= (1 + rotPanicAmplitude * panicMask);
            }

            // Impulse corrections
            for (const imp of rotImpulses) {
                const dist = Math.abs(easedProgress - imp.progress);
                if (dist < imp.width * 2) {
                    const impMask = Math.exp(-Math.pow(dist / imp.width, 2));
                    jitterYaw += imp.yaw * impMask;
                    jitterPitch += imp.pitch * impMask;
                }
            }
        }

        const player = Player.getPlayer();
        if (!player) return;

        // Mojmap: setYaw() -> setYRot(), setPitch() -> setXRot()
        player.setYRot(baseYaw + jitterYaw);
        player.setXRot(basePitch + jitterPitch);

        if (rawProgress >= 1) {
            player.setYRot(rotTargetYaw);
            player.setXRot(rotTargetPitch);
            rotTargetYaw = null;
            rotTargetPitch = null;

            if (rotationFinishCallback) {
                const cb = rotationFinishCallback;
                rotationFinishCallback = null;
                cb();
            }
        }
    } catch (e) {
        p("Error in rotation loop: " + e);
        rotTargetYaw = null;
        rotTargetPitch = null;
        if (rotationFinishCallback) {
            const cb = rotationFinishCallback;
            rotationFinishCallback = null;
            cb();
        }
    }
});