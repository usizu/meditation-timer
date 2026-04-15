import { readFileSync, writeFileSync } from "node:fs";
import type { PluginOption } from "vite";
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
	/* only bump on local builds, not dev server or CI/deploy */
	const version =
		command === "build" && !process.env.CI ? bumpPatch() : readVersion();

	/* Capacitor builds serve from local files — use relative base */
	const isCap = !!process.env.CAP;
	const isDev = command === "serve";

	/* PWA plugin not needed for native Capacitor builds */
	const plugins: PluginOption[] = [];
	if (!isCap) {
		plugins.push(
			VitePWA({
				registerType: "autoUpdate",
				strategies: "injectManifest",
				srcDir: "src",
				filename: "sw.ts",
				manifest: {
					name: isDev ? "Mu [Dev]" : "Mugen",
					short_name: isDev ? "Mu [Dev]" : "Mugen",
					description: "Boundless",
					theme_color: "#1a0e2e",
					background_color: "#1a0e2e",
					display: "standalone",
					orientation: "portrait",
					icons: [
						{
							src: "/icon-192.png",
							sizes: "192x192",
							type: "image/png",
						},
						{
							src: "/icon-512.png",
							sizes: "512x512",
							type: "image/png",
						},
						{
							src: "/icon-512.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "maskable",
						},
					],
				},
				devOptions: {
					enabled: true,
					type: "module",
				},
				injectManifest: {
					globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
				},
			}),
		);
	}

	return {
		base: isCap ? "./" : "/meditation-timer/",

		build: {
			rollupOptions: {
				/* When building for Capacitor the PWA plugin is disabled,
				   so the virtual module won't resolve. Mark it external —
				   the dynamic import is already guarded by a native-platform check. */
				external: isCap ? ["virtual:pwa-register"] : [],
			},
		},

		css: {
			devSourcemap: true,
		},
		define: {
			__BUILD_ID__: JSON.stringify(`v${version}`),
			__API_BASE__: JSON.stringify(isCap ? "https://mugen.usizu.xyz" : ""),
		},
		plugins,
		server: {
			host: "0.0.0.0",
			allowedHosts: true,
			...(isDev && {
				https: {
					key: readFileSync(new URL(".certs/localhost+2-key.pem", import.meta.url)),
					cert: readFileSync(new URL(".certs/localhost+2.pem", import.meta.url)),
				},
			}),
			proxy: {
				"/api": "http://localhost:3333",
				"/auth": "http://localhost:3333",
			},
		},
	};
});
