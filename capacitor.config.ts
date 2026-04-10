import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
	appId: "com.kitty.timer",
	appName: "Mugen",
	webDir: "dist",
	backgroundColor: "#1a0e2e",
	ios: {
		contentInset: "always",
		preferredContentMode: "mobile",
		scheme: "Kitty Timer",
		backgroundColor: "#1a0e2e",
	},
};

export default config;
