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
import "./features/hideplayers"
import "./features/cc"
import "./features/ms3"
import "./features/DbTb"
import "./features/i4N"
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

register("chat", () =>{
ChatLib.say("Bat killed!")
}).setCriteria("A Bat has been slain. +1 Bonus Score")