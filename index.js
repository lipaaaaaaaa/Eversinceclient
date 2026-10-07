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
import "./features/AADG"
import "./features/DbTb"

p("loaded")

register("command", () => {
Settings.openGUI()
}).setName("eversincegtbsg").setAliases("eversince", "evs")
 
