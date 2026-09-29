import Settings from "./config"

import { p } from "./utils"

import "./utils"
import "./commands"


import "./features/termtb"
import "./features/test"
import "./features/stopring"
import "./features/spin"
import "./features/trapper"
import "./features/smallcaps"
import "./features/cc"
/*import "./IceFill"
import "./features/sim"*/

p("loaded")

register("command", () => {
Settings.openGUI()
}).setName("eversincegtbsg").setAliases("eversince", "evs")
 
register("chat", (e) => {
    cancel(e)
}).setCriteria("There are blocks in the way!")

register("chat", (e) => {
    cancel(e)
}).setCriteria("You do not have the key for this door!")

register("chat", (e) => {
    cancel(e)
}).setCriteria("Your Spirit Sceptre hit ").setContains()
