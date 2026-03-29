import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		VitePWA({
			registerType: "autoUpdate",
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",
			manifest: {
				name: "Cosmic Timer",
				short_name: "Cosmic Timer",
				description: "A cosmic meditation timer",
				theme_color: "#0a0a1a",
				background_color: "#0a0a1a",
				display: "standalone",
				orientation: "portrait",
				icons: [
					{
						src: "/icon-192.svg",
						sizes: "any",
						type: "image/svg+xml",
					},
				],
			},
			injectManifest: {
				globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
			},
		}),
	],
});
