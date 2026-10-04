/// <reference types="../../CTAutocomplete" />

// Mojmap: net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket
const ClientboundBlockUpdatePacket = Java.type("net.minecraft.network.protocol.game.ClientboundBlockUpdatePacket");

global.soshimee ??= {};
global.soshimee.events ??= {};
global.soshimee.events.packetBlockChange ??= {};

const listeners = global.soshimee.events.packetBlockChange.listeners ??= [];

const trigger = global.soshimee.events.packetBlockChange.trigger ??= register("packetReceived", (packet, event) => {
    // getPos() returns BlockPos
    const position = packet.getPos(); 
    // BlockPos accessors: getX(), getY(), getZ()
    const positionXYZ = [position.getX(), position.getY(), position.getZ()];
    
    // getBlockState() returns BlockState
    const blockState = packet.getBlockState();
    // getBlock() returns Block
    const block = blockState.getBlock();
    
    for (let listener of listeners) {
        listener(positionXYZ, block, blockState, packet, event);
    }
}).setFilteredClass(ClientboundBlockUpdatePacket).unregister();

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