const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');

let mainWindow;
let adbProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 920,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Window controls
ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

// Enhanced function to check device status
ipcMain.handle('check-device-status', async () => {
  return new Promise((resolve) => {
    exec('adb devices', (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        const devices = stdout.split('\n')
          .filter(line => line.includes('\t'))
          .map(line => {
            const parts = line.split('\t');
            return {
              id: parts[0],
              status: parts[1]
            };
          });
        resolve({ success: true, devices });
      }
    });
  });
});

// Enhanced connect function with better error handling
ipcMain.handle('connect-device-enhanced', async (event, ip) => {
  return new Promise(async (resolve) => {
    try {
      // First, disconnect any existing connections to this device
      await new Promise((disconnectResolve) => {
        exec(`adb disconnect ${ip}:5555`, () => {
          disconnectResolve();
        });
      });

      // Wait a moment then connect
      setTimeout(() => {
        exec(`adb connect ${ip}:5555`, (error, stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: error.message, stderr });
          } else {
            // Wait a moment then check if device is authorized
            setTimeout(() => {
              exec('adb devices', (checkError, checkStdout) => {
                if (checkError) {
                  resolve({ success: false, error: checkError.message });
                } else {
                  const isAuthorized = checkStdout.includes(`${ip}:5555\tdevice`);
                  if (isAuthorized) {
                    resolve({ 
                      success: true, 
                      output: stdout,
                      status: 'authorized'
                    });
                  } else if (checkStdout.includes(`${ip}:5555\tunauthorized`)) {
                    resolve({ 
                      success: false, 
                      error: 'Device not authorized. Please check your Fire TV for authorization prompt.',
                      status: 'unauthorized'
                    });
                  } else {
                    resolve({ 
                      success: false, 
                      error: 'Device connected but not responding properly.',
                      status: 'unknown'
                    });
                  }
                }
              });
            }, 2000);
          }
        });
      }, 1000);
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// Enhanced remote command with device check
ipcMain.handle('remote-command-enhanced', async (event, keycode) => {
  return new Promise(async (resolve) => {
    try {
      // First check if any device is available
      const deviceCheck = await new Promise((checkResolve) => {
        exec('adb devices', (error, stdout) => {
          if (error) {
            checkResolve({ hasDevice: false, error: error.message });
          } else {
            const hasOnlineDevice = stdout.includes('\tdevice');
            checkResolve({ hasDevice: hasOnlineDevice, output: stdout });
          }
        });
      });

      if (!deviceCheck.hasDevice) {
        resolve({ 
          success: false, 
          error: 'No authorized device connected. Please reconnect your Fire TV.',
          needsReconnect: true 
        });
        return;
      }

      // Execute the command
      exec(`adb shell input keyevent ${keycode}`, (error, stdout, stderr) => {
        if (error) {
          // Check if it's an offline error
          if (error.message.includes('device offline') || error.message.includes('no devices')) {
            resolve({ 
              success: false, 
              error: 'Device went offline. Try reconnecting.',
              needsReconnect: true 
            });
          } else {
            resolve({ success: false, error: error.message, stderr });
          }
        } else {
          resolve({ success: true, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// Function to wake up device before sending commands
ipcMain.handle('wake-device', async () => {
  return new Promise((resolve) => {
    exec('adb shell input keyevent KEYCODE_WAKEUP', (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// Auto-reconnect function
ipcMain.handle('auto-reconnect', async (event, ip) => {
  return new Promise(async (resolve) => {
    try {
      // Try to wake device first
      exec('adb shell input keyevent KEYCODE_WAKEUP', () => {
        // Wait then reconnect
        setTimeout(() => {
          exec(`adb disconnect ${ip}:5555`, () => {
            setTimeout(() => {
              exec(`adb connect ${ip}:5555`, (error, stdout) => {
                if (error) {
                  resolve({ success: false, error: error.message });
                } else {
                  resolve({ success: true, output: stdout });
                }
              });
            }, 1000);
          });
        }, 2000);
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// Original ADB Commands (kept for backward compatibility)
ipcMain.handle('adb-command', async (event, command) => {
  return new Promise((resolve, reject) => {
    exec(`adb ${command}`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message, stderr });
      } else {
        resolve({ success: true, stdout, stderr });
      }
    });
  });
});

// Original Fire TV Remote Commands (kept for backward compatibility)
ipcMain.handle('remote-command', async (event, keycode) => {
  return new Promise((resolve, reject) => {
    exec(`adb shell input keyevent ${keycode}`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// Original Connect to Fire TV (kept for backward compatibility)
ipcMain.handle('connect-device', async (event, ip) => {
  return new Promise((resolve, reject) => {
    exec(`adb connect ${ip}:5555`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
});

// Get installed apps
ipcMain.handle('get-apps', async () => {
  return new Promise((resolve, reject) => {
    exec('adb shell pm list packages', (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        const packages = stdout.split('\n')
          .filter(line => line.startsWith('package:'))
          .map(line => line.replace('package:', '').trim())
          .filter(pkg => pkg.length > 0);
        resolve({ success: true, packages });
      }
    });
  });
});

// Launch app
ipcMain.handle('launch-app', async (event, packageName) => {
  return new Promise((resolve, reject) => {
    exec(`adb shell monkey -p ${packageName} 1`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});

// Install APK
ipcMain.handle('install-apk', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'APK Files', extensions: ['apk'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const apkPath = result.filePaths[0];
    return new Promise((resolve, reject) => {
      exec(`adb install "${apkPath}"`, (error, stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: error.message, stderr });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  }
  return { success: false, error: 'No file selected' };
});

// Enhanced send text with connection check
ipcMain.handle('send-text-enhanced', async (event, text) => {
  return new Promise(async (resolve) => {
    try {
      // First check if any device is available
      const deviceCheck = await new Promise((checkResolve) => {
        exec('adb devices', (error, stdout) => {
          if (error) {
            checkResolve({ hasDevice: false, error: error.message });
          } else {
            const hasOnlineDevice = stdout.includes('\tdevice');
            checkResolve({ hasDevice: hasOnlineDevice, output: stdout });
          }
        });
      });

      if (!deviceCheck.hasDevice) {
        resolve({ 
          success: false, 
          error: 'No authorized device connected. Please reconnect your Fire TV.',
          needsReconnect: true 
        });
        return;
      }

      // Execute the command
      exec(`adb shell input text "${text}"`, (error, stdout, stderr) => {
        if (error) {
          if (error.message.includes('device offline') || error.message.includes('no devices')) {
            resolve({ 
              success: false, 
              error: 'Device went offline. Try reconnecting.',
              needsReconnect: true 
            });
          } else {
            resolve({ success: false, error: error.message, stderr });
          }
        } else {
          resolve({ success: true, stdout, stderr });
        }
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// Original send text (kept for backward compatibility)
ipcMain.handle('send-text', async (event, text) => {
  return new Promise((resolve, reject) => {
    exec(`adb shell input text "${text}"`, (error, stdout, stderr) => {
      if (error) {
        resolve({ success: false, error: error.message });
      } else {
        resolve({ success: true });
      }
    });
  });
});