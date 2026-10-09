
The project is a CT(chattriggers) 26.1 minecraft module that aims to add QOL(quality of life) features to hypixel skyblock, the project uses mojmap mappings as due to the deobfuscation of mojang mappings
the fork used for this project is made by docilelm https://github.com/synnerz/ctjs
26.1 tree: https://github.com/synnerz/ctjs/tree/26.1

## Text Overlay (features/textoverlay.js)
Movable, config-toggleable HUD text overlay for 26.1 mojmap CT (synnerz fork).

- Toggle: Vigilance config -> Misc -> "Text Overlay" (`Settings.textoverlay`)
- `/edithud`        opens a full-screen GUI where you drag the display with the mouse (showcase values `Steve: BoxName`, RMB/ESC to close, position auto-saves)
- `/edithud reset`  snap back to 0,0 (top-left, visible on every screen)
- `/edithud save`   force-save state + data
- `/edithud reload` re-read the box data json without restarting CT
