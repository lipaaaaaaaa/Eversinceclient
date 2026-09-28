import { @Vigilant, @TextProperty, @NumberProperty, @SwitchProperty, @SelectorProperty, @DecimalSliderProperty, @SliderProperty } from "../Vigilance";

@Vigilant("Eversinceclient", "Eversince", {
	getCategoryComparator: () => (a, b) => {
		const categories = ["Main", "AutoRoutes", "P3", "Dungeons", "P5", "Sim", "Misc"];
		return categories.indexOf(a.name) - categories.indexOf(b.name);
	}
})

class Settings {
    constructor() {
        this.initialize(this);
    }
	
	@SwitchProperty({name: "Debug Messages",
	description: "Toggle this whether or not you want to see the debug messages",
	category: "Misc"}) debugmsg = false;
	
	@SwitchProperty({name: "Terminal open triggerbot",
	description: "Automatically clicks a terminal when looking at it",
	subcategory: "",
	category: "P3"}) termtb = false;
	
	@SwitchProperty({name: "SpinBot",
	description: "Serverside yaw spinbot silent rotates",
	category: "General"}) spinbot = false;	

	@SwitchProperty({name: "Chat bypass(font chat)",
	description: "Cancels every message you send and re-sends it with the latin alphabet replaced by small caps (a-z -> ᴀ-ᴢ). Commands are not affected. ᴛʜᴇ ǫᴜɪᴄᴋ ʙʀᴏᴡɴ ғᴏx ᴊᴜᴍᴘs ᴏᴠᴇʀ ᴛʜᴇ ʟᴀᴢʏ ʙʀᴏᴡɴ ᴅᴏɢ",
	category: "General"}) smallcapschat = false;

/*
    @SliderProperty({
        name: "Spin Speed",
        description: "Rotation speed in degrees",
        category: "Misc",
        min: 1,
        max: 360
    })
    spinSpeed = 10;
*/
}

export default new Settings;