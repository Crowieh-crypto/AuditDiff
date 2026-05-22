const { app, BrowserWindow, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')

let mainWindow
let apiProcess
let intelProcess

const API_PORT = 3001
const FRONTEND_PORT = 5173
const isDev = process.env.NODE_ENV === 'development'

function waitForPort(port, retries = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get(`http://localhost:${port}/health`, (res) => {
        if (res.statusCode === 200) resolve()
        else retry()
      }).on('error', retry)
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) reject(new Error(`Port ${port} not ready`))
      else setTimeout(check, 1000)
    }
    check()
  })
}

function startBackend() {
  const apiDir = path.join(__dirname, 'packages/api')
  const intelDir = path.join(__dirname, 'packages/intel')

  // In development, execute with standard 'node'. 
  // In a packaged production app, use Electron's internal runtime binary (process.execPath)
  const runtimeExecutor = isDev ? 'node' : process.execPath

  // Points directly to the entry scripts
  const apiScript = path.join(apiDir, 'index.js')
  const intelScript = path.join(intelDir, 'index.js')

  // Build execution arguments depending on the current environment mode
  const apiArgs = isDev ? ['index.js'] : [apiScript]
  const intelArgs = isDev ? ['index.js'] : [intelScript]

  apiProcess = spawn(runtimeExecutor, apiArgs, {
    cwd: apiDir,
    env: { ...process.env, PORT: API_PORT },
    stdio: 'pipe'
  })

  intelProcess = spawn(runtimeExecutor, intelArgs, {
    cwd: intelDir,
    env: { ...process.env, PORT: 3002 },
    stdio: 'pipe'
  })

  // Log background operational streams to help debug any scanning failures
  apiProcess.stdout.on('data', d => console.log('[api]', d.toString()))
  apiProcess.stderr.on('data', d => console.error('[api-err]', d.toString()))
  
  intelProcess.stdout.on('data', d => console.log('[intel]', d.toString()))
  intelProcess.stderr.on('data', d => console.error('[intel-err]', d.toString()))
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    title: 'AuditDiff'
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, 'packages/frontend/dist/index.html'))
  }
}

app.whenReady().then(async () => {
  startBackend()
  try {
    await waitForPort(API_PORT)
  } catch (e) {
    console.error('API did not start in time', e)
  }
  await createWindow()
})

app.on('window-all-closed', () => {
  if (apiProcess) apiProcess.kill()
  if (intelProcess) intelProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
