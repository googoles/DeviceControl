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
});