import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const https = env.TLS_CERT_FILE && env.TLS_KEY_FILE ? { cert: fs.readFileSync(env.TLS_CERT_FILE), key: fs.readFileSync(env.TLS_KEY_FILE) } : undefined;
  return { plugins: [react()], server: { host: env.DEV_HOST || '127.0.0.1', port: 5173, https,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true, rewrite: p => p.replace(/^\/api/, '') } } } };
});
