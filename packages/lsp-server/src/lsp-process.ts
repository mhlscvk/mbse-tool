import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function spawnLanguageServer(): ChildProcess {
  // Path to the syside-languageserver binary
  // After forking sysml-2ls, this will point to the built server
  const serverPath = process.env.LSP_SERVER_PATH
    ?? path.join(__dirname, '../../../node_modules/.bin/syside-languageserver');

  const serverProcess = spawn('node', [serverPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? 'production' },
  });

  serverProcess.on('error', (err) => {
    console.error('[LSP] Failed to start language server process:', err.message);
    console.error('[LSP] Ensure syside-languageserver is built and path is correct in .env');
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[LSP stderr]', data.toString());
  });

  serverProcess.on('exit', (code) => {
    console.log(`[LSP] Language server exited with code ${code}`);
  });

  console.log('[LSP] Language server process spawned');
  return serverProcess;
}
