import { doItemUse, guiOpen } from "../utils"
import Settings from "../config"

let active = false;
let lastClick = 0;

register("tick", () => {
    if (!active || guiOpen()) return;
    const now = Date.now();
    if (now - lastClick < 250) return;
    if (Player.lookingAt()?.getName()?.removeFormatting() === "Inactive Terminal") {
        doItemUse();
        lastClick = now;
    }
});

register("chat", () => {
    if (Settings.termtb) active = true;
}).setCriteria("[BOSS] Goldor: Who dares trespass into my domain?");

register("chat", () => {
    active = false;
}).setCriteria("The Core entrance is opening!");