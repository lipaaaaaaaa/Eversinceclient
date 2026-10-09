import Settings from "./config"

import { p } from "./utils"

import "./utils"
import "./commands"


import "./features/termtb"
import "./features/test"
import "./features/spin"
import "./features/trapper"
import "./features/smallcaps"
import "./features/hideplayers"
import "./features/cc"
import "./features/ms3"
import "./features/DbTb"
import "./features/levp3tb"

p("loaded")

register("command", () => {
Settings.openGUI()
}).setName("eversincegtbsg").setAliases("eversince", "evs")

register("chat", (e) => {
cancel(e)
}).setCriteria("-----------------------------------------------------")

register("chat", (e) => {
cancel(e)
}).setCriteria("Your mute will expire in ").setContains()

register("chat", (e) => {
cancel(e)
}).setCriteria("Find out more here: www.hypixel.net/mutes")

register("chat", (e) => {
cancel(e)
}).setCriteria("Mute ID: #").setContains()

