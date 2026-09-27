
register("chat", () => {
ChatLib.chat("triggered")
setTimeout(() => {
ChatLib.command("call trevor")
ChatLib.chat("trig")
}, 17500);
}).setCriteria("Accept the trapper's").setContains()

register("chat", () => {
ChatLib.command("call trevor")
}).setCriteria("[NPC] Trevor: I couldn't locate any animals. Come back in a little bit!")

register("chat", () =>{
ChatLib.command("hub")
setTimeout(() => {
ChatLib.command("warp trap")
}, 5000);
}).setCriteria("Return to the Trapper soon to get a new animal to hunt!")