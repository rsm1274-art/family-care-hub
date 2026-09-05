import { app, BrowserWindow, ipcMain } from 'electron';
import { ChildProcess, fork } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';

interface ConfigSchema {
  initialized?: boolean;
  jwtSecret?: string;
  pgPassword?: string;
}

const store = new Store<ConfigSchema>({ name: 'family-care-hub' });

const API_PORT = 4000;
const DB_PORT = 5433;
const LOCAL_SERVER_URL = `http://localhost:${API_PORT}`;

export interface HostStatus {
  state: 'idle' | 'starting-db' | 'starting-api' | 'ready' | 'error';
  message: string;
}

let hostStatus: HostStatus = { state: 'idle', message: '' };
let apiProcess: ChildProcess | null = null;

// embedded-postgres is ESM-only; this main process is CJS. A plain
// `await import()` would be transpiled to require() by tsc, so route the
// dynamic import through Function to keep it a real ESM import.
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string
) => Promise<{ default: new (options: Record<string, unknown>) => EmbeddedPg }>;

interface EmbeddedPg {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  createDatabase(name: string): Promise<void>;
}

let pg: EmbeddedPg | null = null;
let mainWindow: BrowserWindow | null = null;

function setHostStatus(state: HostStatus['state'], message = ''): void {
  hostStatus = { state, message };
  mainWindow?.webContents.send('fch:host-status', hostStatus);
}

function getOrCreateSecret(key: 'jwtSecret' | 'pgPassword'): string {
  let value = store.get(key);
  if (!value) {
    value = crypto.randomBytes(32).toString('hex');
    store.set(key, value);
  }
  return value;
}

/** Where the API server's compiled entrypoint lives. */
function serverEntry(): string {
  if (process.env.FCH_SERVER_ENTRY) return process.env.FCH_SERVER_ENTRY;
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'dist', 'index.js')
    : path.resolve(__dirname, '../../server/dist/index.js');
}

function migrationsDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'prisma', 'migrations')
    : path.resolve(__dirname, '../../server/prisma/migrations');
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API server did not become healthy in time');
}

async function startHostStack(): Promise<void> {
  try {
    setHostStatus('starting-db', 'Starting the family database…');

    const pgPassword = getOrCreateSecret('pgPassword');
    const dataDir = path.join(app.getPath('userData'), 'pgdata');

    const { default: EmbeddedPostgres } = await importEsm('embedded-postgres');
    const db = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: 'familycare',
      password: pgPassword,
      port: DB_PORT,
      persistent: true,
    });
    pg = db;

    const freshInstall = !fs.existsSync(path.join(dataDir, 'PG_VERSION'));
    if (freshInstall) {
      await db.initialise();
    }
    await db.start();
    if (freshInstall) {
      await db.createDatabase('familycarehub');
    }

    setHostStatus('starting-api', 'Starting the family server…');

    const databaseUrl = `postgresql://familycare:${pgPassword}@localhost:${DB_PORT}/familycarehub`;
    apiProcess = fork(serverEntry(), [], {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        JWT_SECRET: getOrCreateSecret('jwtSecret'),
        PORT: String(API_PORT),
        // Local-only: the app never serves other machines, so bind loopback.
        HOST: '127.0.0.1',
        IMAGES_DIR: path.join(app.getPath('userData'), 'images'),
        RUN_MIGRATIONS: '1',
        MIGRATIONS_DIR: migrationsDir(),
        // The packaged server is an esbuild bundle; the query engine dll is
        // shipped at resources/server (one of Prisma's search paths), and
        // this env var covers Prisma versions that honor it.
        ...(app.isPackaged
          ? {
              PRISMA_QUERY_ENGINE_LIBRARY: path.join(
                process.resourcesPath,
                'server',
                'query_engine-windows.dll.node'
              ),
            }
          : {}),
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    apiProcess.stdout?.on('data', (d) => console.log(`[api] ${d}`));
    apiProcess.stderr?.on('data', (d) => console.error(`[api] ${d}`));
    apiProcess.on('exit', (code) => {
      if (hostStatus.state !== 'idle' && code !== 0 && code !== null) {
        setHostStatus('error', `The family server stopped unexpectedly (code ${code}).`);
      }
      apiProcess = null;
    });

    await waitForHealth(LOCAL_SERVER_URL, 30000);
    setHostStatus('ready', 'Family server is running.');
  } catch (err) {
    console.error('Host stack failed to start:', err);
    setHostStatus('error', err instanceof Error ? err.message : String(err));
  }
}

async function stopHostStack(): Promise<void> {
  hostStatus = { state: 'idle', message: '' };
  if (apiProcess) {
    apiProcess.kill('SIGTERM');
    apiProcess = null;
  }
  if (pg) {
    try {
      await pg.stop();
    } catch (err) {
      console.error('Failed to stop Postgres cleanly:', err);
    }
    pg = null;
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Family Care Hub',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    const rendererIndex = app.isPackaged
      ? path.join(process.resourcesPath, 'renderer', 'index.html')
      : path.resolve(__dirname, '../../renderer/dist/index.html');
    mainWindow.loadFile(rendererIndex);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- IPC surface (kept minimal on purpose) ---

ipcMain.handle('fch:get-config', () => ({
  initialized: store.get('initialized') ?? false,
  serverUrl: LOCAL_SERVER_URL,
}));

ipcMain.handle('fch:start-local', async () => {
  store.set('initialized', true);
  if (hostStatus.state === 'idle') {
    void startHostStack();
  }
  return { serverUrl: LOCAL_SERVER_URL };
});

ipcMain.handle('fch:get-host-status', () => hostStatus);

app.whenReady().then(async () => {
  createWindow();

  if (store.get('initialized')) {
    void startHostStack();
  }

  // Dev smoke test: capture what the window rendered, then quit.
  if (process.env.FCH_SMOKE_TEST) {
    setTimeout(async () => {
      try {
        const image = await mainWindow!.webContents.capturePage();
        fs.writeFileSync(process.env.FCH_SMOKE_TEST!, image.toPNG());
      } catch (err) {
        console.error('Smoke capture failed:', err);
      }
      app.quit();
    }, Number(process.env.FCH_SMOKE_WAIT_MS || 15000));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

let quitting = false;
app.on('before-quit', (event) => {
  if (quitting) return;
  if (apiProcess || pg) {
    event.preventDefault();
    quitting = true;
    void stopHostStack().finally(() => app.quit());
  }
});
