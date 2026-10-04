/// <reference types="../../CTAutocomplete" />

// Mojmap: net.minecraft.network.protocol.game.ClientboundSectionBlocksUpdatePacket
const ClientboundSectionBlocksUpdatePacket = Java.type("net.minecraft.network.protocol.game.ClientboundSectionBlocksUpdatePacket");
const BiConsumer = Java.type("java.util.function.BiConsumer");

global.soshimee ??= {};
global.soshimee.events ??= {};
global.soshimee.events.packetMultiBlockChange ??= {};

const listeners = global.soshimee.events.packetMultiBlockChange.listeners ??= [];

const trigger = global.soshimee.events.packetMultiBlockChange.trigger ??= register("packetReceived", (packet, event) => {
    const blocks = [];
    
    // In 1.21, this packet does not return a simple array.
    // We must use the runUpdates method with a BiConsumer (pos, state).
    packet.runUpdates(new BiConsumer({
        accept: (pos, state) => {
            const positionXYZ = [pos.getX(), pos.getY(), pos.getZ()];
            const block = state.getBlock();
            blocks.push([positionXYZ, block, state]);
        }
    }));

    if (blocks.length > 0) {
        for (let listener of listeners) {
            listener(blocks, packet, event);
        }
    }
}).setFilteredClass(ClientboundSectionBlocksUpdatePacket).unregister();

export function addListener(listener) {
    if (listeners.length === 0) trigger.register();
    listeners.push(listener);
}

export function removeListener(listener) {
    const index = listeners.indexOf(listener);
    if (index === -1) return false;
    listeners.splice(index, 1);
    if (listeners.length === 0) trigger.unregister();
    return true;
}

export default { addListener, removeListener };