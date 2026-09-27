
import {p} from "./utils"

register('command', (...args) => {
const result = new Function('return ' + args.join(' '))();
p(`${result}`);
}).setName('calc');
