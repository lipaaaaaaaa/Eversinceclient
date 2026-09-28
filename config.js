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
	category: "misc"}) debugmsg = false;
	
	@SwitchProperty({name: "Terminal open triggerbot",
	description: "Automatically clicks a terminal when looking at it",
	subcategory: "",
	category: "P3"}) termtb = false;
	
	@SwitchProperty({name: "SpinBot",
	description: "Serverside yaw spinbot silent rotates",
	category: "Misc"}) spinbot = false;	

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