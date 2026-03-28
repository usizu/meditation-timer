import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const pkgPath = new URL("./package.json", import.meta.url);

function readVersion(): string {
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	return pkg.version;
}

function bumpPatch(): string {
	const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
	const parts = (pkg.version as string).split(".").map(Number);
	parts[2] = (parts[2] ?? 0) + 1;
	pkg.version = parts.join(".");
	writeFileSync(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
	return pkg.version;
}

export default defineConfig(({ command }) => {
	/* only bump on production build, not dev server */
	const version = command === "build" ? bumpPatch() : readVersion();

	return {
		base: "/meditation-timer/",
		define: {
			__BUILD_ID__: JSON.stringify(`v${version}`),
		},
		plugins: [
			VitePWA({
				registerType: "autoUpdate",
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
				workbox: {
					globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
				},
			}),
		],
	};
});
