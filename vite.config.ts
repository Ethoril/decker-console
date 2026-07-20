import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { execSync } from 'child_process';

let commitHash = 'dev';
let commitCount = '0';
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim();
  commitCount = execSync('git rev-list --count HEAD').toString().trim();
} catch (e) {
  console.warn('Could not read git version, fallback to defaults', e);
}

const appVersion = `v0.1.${commitCount}-${commitHash}`;

export default defineConfig({
  base: '/decker-console/',
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
});
