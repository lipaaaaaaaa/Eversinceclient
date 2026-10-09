import { @Vigilant, @TextProperty, @NumberProperty, @SwitchProperty, @SelectorProperty, @DecimalSliderProperty, @SliderProperty } from "../Vigilance";

@Vigilant("Eversinceclient", "Eversince", {
	getCategoryComparator: () => (a, b) => {
		const categories = ["Main", "P3", "Dungeons", "Misc"];
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
	description: "Cancels every message you send and re-sends it with the latin alphabet replaced by small caps (a-z -> ａ-ｚ). Commands are not affected.ｔｈｅ ｑｕｉｃｋ ｂｒｏｗｎ ｆｏｘ ｊｕｍｐｓ ｏｖｅｒ ｔｈｅ ｌａｚｙ ｄｏｇ",
	category: "General"}) smallcapschat = false;

	@SwitchProperty({name: "Chat cleaner",
	description: "Chat cleaner",
	category: "General"}) chatclean = false;

	@SwitchProperty({name: "Milestone 3 helper",
	description: "renders that you are milestone 3 and theres a chat message",
	category: "Dungeons"}) ms3an = false;

	@SwitchProperty({name: "Y offset Playerhider in dungeons",
	description: "Click through hide players",
	category: "Dungeons"}) hideplayers = false;

	@SwitchProperty({name: "P3 lever triggerbot",
	description: "f7 boss lever triggerbot",
	category: "P3"}) levtb = false;

	@SwitchProperty({name: "Dungeonbreaker triggerbot",
	description: "f7 boss db triggerbot",
	category: "P3"}) dbtb = false;

    @SwitchProperty({name: "Text Overlay",
    description: "Renders a movable text overlay (see /edithud). Shows your name plus the first matching zone box you are standing in, from data/overlay.json",
    category: "P3"}) textoverlay = false;

    @SwitchProperty({name: "Main section overlay",
    description: "Render Main section text Eg S2 > blablbalb",
    category: "P3"}) textoverlayMain = false;

 	@SwitchProperty({name: "Sub section Overlay",
    description: "Render Main section text Eg blablabla > High EE2",
    category: "P3"}) textoverlaySub = false;

    @SliderProperty({
        name: "Hide players range value",
        description: "Hide players range",
        category: "Dungeons",
        min: 1,
        max: 10
    })
    hprval = 3

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