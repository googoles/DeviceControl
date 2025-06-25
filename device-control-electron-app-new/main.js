const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { SerialPort } = require('serialport');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 1200,
    minWidth: 1200,
    minHeight: 1200,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(
    isDev
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, './device-control-app/dist/index.html')}`
  );

  if (isDev) {
    // win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  // 시리얼 포트 목록 조회
  ipcMain.handle('get-serial-ports', async () => {
    try {
      console.log('Getting serial ports...');
      const ports = await SerialPort.list();
      console.log('Found ports:', ports);
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        pnpId: port.pnpId,
        serialNumber: port.serialNumber,
      }));
    } catch (error) {
      console.error("Failed to list serial ports:", error);
      return [];
    }
  });

  let port;

  // 시리얼 포트 열기
  ipcMain.handle('open-serial-port', async (event, portPath, baudRate, dataBits, parity, stopBits) => {
    console.log(`Opening port: ${portPath}, ${baudRate}-${dataBits}-${parity}-${stopBits}`);
    
    if (port && port.isOpen) {
      console.warn(`Port ${port.path} is already open.`);
      return { success: false, message: `Port ${port.path} is already open.` };
    }
    
    try {
      port = new SerialPort({
        path: portPath,
        baudRate: baudRate,
        dataBits: dataBits,
        parity: parity,
        stopBits: stopBits
      });

      port.on('open', () => {
        console.log(`Serial port ${portPath} opened successfully`);
        event.sender.send('serial-port-status', { 
          isOpen: true, 
          path: portPath, 
          message: `Port ${portPath} opened.` 
        });
      });

      port.on('data', (data) => {
        const receivedData = data.toString('utf8');
        console.log('Data from serial:', receivedData);
        event.sender.send('serial-data-received', receivedData);
      });

      port.on('close', () => {
        console.log(`Serial port ${portPath} closed.`);
        event.sender.send('serial-port-status', { 
          isOpen: false, 
          path: portPath, 
          message: `Port ${portPath} closed.` 
        });
      });

      port.on('error', (err) => {
        console.error(`Serial port ${portPath} error:`, err.message);
        event.sender.send('serial-port-status', { 
          isOpen: false, 
          path: portPath, 
          error: err.message, 
          message: `Port ${portPath} error: ${err.message}` 
        });
      });

      return { success: true, message: `Attempting to open port ${portPath}...` };

    } catch (error) {
      console.error(`Failed to open serial port ${portPath}:`, error);
      return { success: false, message: `Failed to open port: ${error.message}` };
    }
  });

  // 시리얼 포트 닫기
  ipcMain.handle('close-serial-port', async (event) => {
    console.log('Closing serial port...');
    
    if (port && port.isOpen) {
      return new Promise((resolve) => {
        port.close((err) => {
          if (err) {
            console.error("Error closing port:", err);
            resolve({ success: false, message: `Error closing port: ${err.message}` });
          } else {
            console.log("Port successfully closed.");
            resolve({ success: true, message: "Port closed." });
          }
        });
      });
    } else {
      console.log("No port is currently open.");
      return { success: false, message: "No port is currently open." };
    }
  });

  // 시리얼 포트에 데이터 쓰기
  ipcMain.handle('write-to-serial-port', async (event, data, encoding) => {
    console.log(`Writing to serial port: "${data}" with encoding: ${encoding}`);
    
    if (port && port.isOpen) {
      return new Promise((resolve) => {
        port.write(data, encoding, (err) => {
          if (err) {
            console.error("Error writing to port:", err);
            resolve({ success: false, message: `Error writing: ${err.message}` });
          } else {
            console.log(`Data "${data}" written successfully.`);
            resolve({ success: true, message: `Data "${data}" written.` });
          }
        });
      });
    } else {
      console.log("No port open to write to.");
      return { success: false, message: "No port open to write to." };
    }
  });

  // 기타 IPC 핸들러
  ipcMain.on('toMain', (event, arg) => {
    console.log('Message from renderer:', arg);
    event.sender.send('fromMain', `Hello from Main Process! You sent: ${arg}`);
  });

  ipcMain.handle('get-file-path', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile']
    });
    if (canceled) {
      return undefined;
    } else {
      return filePaths[0];
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  console.log('App closing...');
  
  // port 변수가 정의되어 있고 열려있는지 확인
  if (typeof port !== 'undefined' && port && port.isOpen) {
    try {
      port.close((err) => {
        if (err) console.error("Error closing port on app quit:", err);
        else console.log("Serial port closed on app quit.");
      });
    } catch (error) {
      console.error("Error during port cleanup:", error);
    }
  } else {
    console.log("No port to close or port already closed.");
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});