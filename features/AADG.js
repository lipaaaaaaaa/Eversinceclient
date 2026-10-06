const MODULE = "Eversinceclient"
const DATA_URL = "https://raw.githubusercontent.com/lipaaaaaaaa/JSONDATA/main/V0w%3D.json"
const CACHE = "dodgelist_cache.json"
const LOCAL = "dodgelist_local.json"
const USAGE = "/dlist <check|add|remove> <ign> or /dlist reload"

const HttpClient = Java.type("java.net.http.HttpClient")
const HttpRequest = Java.type("java.net.http.HttpRequest")
const BodyHandlers = Java.type("java.net.http.HttpResponse$BodyHandlers")
const URI = Java.type("java.net.URI")
const JThread = Java.type("java.lang.Thread")
const http = HttpClient.newHttpClient()

let remote = new Set()
let local = new Set()

function clean(uuid) {
  return uuid.replace(/-/g, "").toLowerCase()
}

function run(fn) {
  new JThread(() => {
    fn()
  }).start()
}

function get(url) {
  const res = http.send(HttpRequest.newBuilder(URI.create(url)).build(), BodyHandlers.ofString())
  return { status: res.statusCode(), body: res.body() }
}

function load(file) {
  try {
    return new Set(JSON.parse(FileLib.read(MODULE, file)).map(clean))
  } catch (e) {
    return new Set()
  }
}

function save(file, set) {
  FileLib.write(MODULE, file, JSON.stringify([...set]))
}

function lookup(ign) {
  const res = get("https://api.mojang.com/users/profiles/minecraft/" + ign)
  return res.status === 200 ? clean(JSON.parse(res.body).id) : null
}

function refresh(verbose) {
  run(() => {
    try {
      const res = get(DATA_URL)
      if (res.status !== 200) throw new Error("HTTP " + res.status)
      remote = new Set(JSON.parse(res.body).map(clean))
      FileLib.write(MODULE, CACHE, res.body)
      if (verbose) ChatLib.chat("Dodgelist reloaded (" + remote.size + " entries)")
    } catch (e) {
      if (verbose) ChatLib.chat("Dodgelist reload failed, using cache: " + e.message)
    }
  })
}

function check(ign, quietIfClean) {
  run(() => {
    const uuid = lookup(ign)
    if (!uuid) return ChatLib.chat("Unknown player: " + ign)
    if (remote.has(uuid) || local.has(uuid)) return ChatLib.chat(ign + " is on the dodgelist")
    if (!quietIfClean) ChatLib.chat(ign + " is clean")
  })
}

function edit(ign, add) {
  run(() => {
    const uuid = lookup(ign)
    if (!uuid) return ChatLib.chat("Unknown player: " + ign)
    if (add) local.add(uuid)
    else local.delete(uuid)
    save(LOCAL, local)
    ChatLib.chat((add ? "Added " : "Removed ") + ign)
  })
}

register("command", (sub, ign) => {
  if (sub === "reload") return refresh(true)
  if (!ign || !/^\w{1,16}$/.test(ign)) return ChatLib.chat(USAGE)
  if (sub === "check") return check(ign, false)
  if (sub === "add") return edit(ign, true)
  if (sub === "remove") return edit(ign, false)
  ChatLib.chat(USAGE)
}).setName("dlist")

register("chat", (who) => {
  check(who.split(" ").pop(), true)
}).setCriteria("${who} joined the party.")

local = load(LOCAL)
remote = load(CACHE)
refresh(false)

register("command", (ign) => {
  if (!ign || !/^\w{1,16}$/.test(ign)) return ChatLib.chat("/uuidfromign <ign>")
  run(() => {
    const uuid = lookup(ign)
    ChatLib.chat(uuid ? ign + ": " + uuid : "Unknown player: " + ign)
  })
}).setName("uuidfromign")