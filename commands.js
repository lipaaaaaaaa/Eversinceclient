import {p} from "./utils"

register('command', (...args) => {
const result = new Function('return ' + args.join(' '))();
p(`${result}`);
}).setName('calc');

const messages = {
    p1: { a: "Checkpoint Left crystal", b: "Right crystal, then split pd(2nd dev)", h: "Checkpoint Right crystal", m: "Left Crystal", t: "Agro from the front of conveyor" },
    p2: { a: "Pre pad yellowpad, clear p2, pad yellow", b: "Split pd(2nd dev)", h: "Split pd(3rd dev)", m: "clear p2, py(mage)", t: "Prepad purple, py(tank)" },
    p3: { a: "i3/21 OR 43 / 4bottomlever / 4 both levers / 2", b: "I4 5(3) / 3(levers) / 3(levers)", h: "SS / EE3 OR 1(3) / 2dev / 4(levers)", m: "EE2 / 2(3) core", t: "21 OR 43(if i3) / 1(3) OR ee3 / 1(both levers), 1" }
}

register("command", (phase, mode) => {
    const message = messages[phase]?.[mode]

    if (!message) {
        ChatLib.chat("Usage: /srfd <p1|p2|p3> <a|b|h|m|t>")
        return
    }

    ChatLib.chat("[" + phase + "] " + mode + " > " + message)
}).setName("srfd")