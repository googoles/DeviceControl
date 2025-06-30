const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // 기본 메시징
  sendMessage: (channel, data) => {
    let validChannels = ['toMain'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  onMessage: (channel, func) => {
    let validChannels = ['fromMain'];
    if (validChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },

  // 파일 시스템
  getFilePath: () => ipcRenderer.invoke('get-file-path'),
  
  // 시리얼 포트 API
  getSerialPorts: () => {
    console.log('preload: getSerialPorts called');
    return ipcRenderer.invoke('get-serial-ports');
  },
  
  openSerialPort: (portPath, baudRate, dataBits, parity, stopBits) => {
    console.log(`preload: openSerialPort called - ${portPath}`);
    return ipcRenderer.invoke('open-serial-port', portPath, baudRate, dataBits, parity, stopBits);
  },
  
  closeSerialPort: () => {
    console.log('preload: closeSerialPort called');
    return ipcRenderer.invoke('close-serial-port');
  },
  
  writeToSerialPort: (data, encoding) => {
    console.log(`preload: writeToSerialPort called - "${data}"`);
    return ipcRenderer.invoke('write-to-serial-port', data, encoding);
  },
  
  // 시리얼 포트 이벤트 리스너
  onSerialPortStatus: (func) => {
    console.log('preload: onSerialPortStatus listener setup');
    const subscription = (event, status) => func(status);
    ipcRenderer.on('serial-port-status', subscription);
    return () => ipcRenderer.removeListener('serial-port-status', subscription);
  },
  
  onSerialDataReceived: (func) => {
    console.log('preload: onSerialDataReceived listener setup');
    const subscription = (event, data) => func(data);
    ipcRenderer.on('serial-data-received', subscription);
    return () => ipcRenderer.removeListener('serial-data-received', subscription);
  },

  // 자동 업데이트 API
  checkForUpdates: () => {
    console.log('preload: checkForUpdates called');
    return ipcRenderer.invoke('check-for-updates');
  },

  restartApp: () => {
    console.log('preload: restartApp called');
    return ipcRenderer.invoke('restart-app');
  },

  getAppVersion: () => {
    console.log('preload: getAppVersion called');
    return ipcRenderer.invoke('get-app-version');
  },

  // 자동 업데이트 이벤트 리스너
  onUpdateAvailable: (func) => {
    console.log('preload: onUpdateAvailable listener setup');
    const subscription = (event, info) => func(info);
    ipcRenderer.on('update-available', subscription);
    return () => ipcRenderer.removeListener('update-available', subscription);
  },

  onDownloadProgress: (func) => {
    console.log('preload: onDownloadProgress listener setup');
    const subscription = (event, progress) => func(progress);
    ipcRenderer.on('download-progress', subscription);
    return () => ipcRenderer.removeListener('download-progress', subscription);
  },

  onUpdateDownloaded: (func) => {
    console.log('preload: onUpdateDownloaded listener setup');
    const subscription = (event, info) => func(info);
    ipcRenderer.on('update-downloaded', subscription);
    return () => ipcRenderer.removeListener('update-downloaded', subscription);
  },

  onUpdateError: (func) => {
    console.log('preload: onUpdateError listener setup');
    const subscription = (event, error) => func(error);
    ipcRenderer.on('update-error', subscription);
    return () => ipcRenderer.removeListener('update-error', subscription);
  },

  // 앱 정보
  showAboutDialog: () => {
    console.log('preload: showAboutDialog called');
    return ipcRenderer.invoke('show-about-dialog');
  }
});