import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { VitePWA } from 'vite-plugin-pwa';
import { Http } from '@mui/icons-material';

/* eslint-disable no-template-curly-in-string */
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');

	return {
		server: {
			port: 3000,
			// Evita que Vite "salte" a otro puerto si el 3000 está ocupado
			// (nginx espera exactamente el 3000)
			strictPort: true,
			proxy: {
				// Destinos parametrizables por variables de entorno para Docker
				// (TRACCAR_WS_URL / TRACCAR_API_URL / MODULO_URL).
				// Por defecto se mantiene el comportamiento actual del VPS.
				'/api/socket': {
					target: process.env.TRACCAR_WS_URL || 'ws://localhost:8082',
					ws: true,
				},
				'/api': process.env.TRACCAR_API_URL || 'http://localhost:8082',
				'/modulo': {
					target: process.env.MODULO_URL || 'http://localhost:8080',
					changeOrigin: true,
					headers: {
						'Content-Type': 'application/json',
						'access_token': 'a1b2cd3d4ee2023'
					}
				}
			},
		},
		build: {
			outDir: 'build',
		},
		define: {
			'process.env': JSON.stringify(env),
			'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '6.16'),
		},
		plugins: [
			svgr(),
			react(),
			VitePWA({
				registerType: 'autoUpdate',
				devOptions: {
					enabled: true,
				},
				workbox: {
					navigateFallbackDenylist: [/^\/api/],
				},
				manifest: {
					short_name: 'Geozoone',
					name: 'Geozoone GPS Tracking System',
					theme_color: '#282833',
					icons: [
						{
							src: 'pwa-64x64.png',
							sizes: '64x64',
							type: 'image/png',
						},
						{
							src: 'pwa-192x192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: 'pwa-512x512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any maskable',
						},
					],
				},
			}),
		],
	}
});
