#!/usr/bin/env node
/**
 * Libère un port TCP avant le démarrage de Vite.
 * Évite l'erreur "Port already in use" lorsqu'un précédent processus
 * dev (Vite, Electron) ne s'est pas terminé correctement.
 *
 * Usage : node scripts/free-port.js 5173
 */
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execP = promisify(exec);
const port = parseInt(process.argv[2] || '5173', 10);
const isWin = process.platform === 'win32';

async function freePort() {
  try {
    if (isWin) {
      const { stdout } = await execP(`netstat -ano | findstr :${port}`).catch(() => ({ stdout: '' }));
      const pids = new Set();
      for (const line of stdout.split(/\r?\n/)) {
        const m = line.trim().match(/LISTENING\s+(\d+)$/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        try {
          await execP(`taskkill /F /PID ${pid}`);
          console.log(`[free-port] Port ${port} libéré (PID ${pid} arrêté)`);
        } catch { /* ignore */ }
      }
    } else {
      const { stdout } = await execP(`lsof -ti:${port}`).catch(() => ({ stdout: '' }));
      for (const pid of stdout.split(/\s+/).filter(Boolean)) {
        try {
          await execP(`kill -9 ${pid}`);
          console.log(`[free-port] Port ${port} libéré (PID ${pid} arrêté)`);
        } catch { /* ignore */ }
      }
    }
  } catch {
    /* silencieux : si rien à libérer, on continue */
  }
}

freePort();
