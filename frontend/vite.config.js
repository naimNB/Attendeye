import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function printPortalUrlsPlugin() {
  return {
    name: 'print-portal-urls',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const address = server.httpServer.address();
        const protocol = server.config.server.https ? 'https' : 'http';
        const port = address && typeof address === 'object' ? address.port : (server.config.server.port || 5173);
        const host = (address && typeof address === 'object' && address.address && address.address !== '::' && address.address !== '0.0.0.0')
          ? address.address
          : 'localhost';
        const base = `${protocol}://${host}:${port}`;
        setTimeout(() => {
          console.log('\n  \x1b[1m\x1b[32mPUB AttendEye - Role Portals Ready:\x1b[0m');
          console.log(`  \x1b[32m➜\x1b[0m  \x1b[1mStudent:\x1b[0m \x1b[36m${base}/student\x1b[0m`);
          console.log(`  \x1b[34m➜\x1b[0m  \x1b[1mTeacher:\x1b[0m \x1b[36m${base}/teacher\x1b[0m`);
          console.log(`  \x1b[35m➜\x1b[0m  \x1b[1mAdmin:\x1b[0m   \x1b[36m${base}/admin\x1b[0m\n`);
        }, 150);
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const https = env.TLS_CERT_FILE && env.TLS_KEY_FILE ? { cert: fs.readFileSync(env.TLS_CERT_FILE), key: fs.readFileSync(env.TLS_KEY_FILE) } : undefined;
  return {
    plugins: [react(), printPortalUrlsPlugin()],
    server: {
      host: env.DEV_HOST || '127.0.0.1',
      port: 5173,
      https,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          rewrite: p => p.replace(/^\/api/, '')
        }
      }
    }
  };
});
