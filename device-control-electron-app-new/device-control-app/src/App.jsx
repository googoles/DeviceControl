import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const BAUD_RATES = [
    300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 460800, 921600
  ];
  const [baudRate, setBaudRate] = useState(9600);

  const DATA_BITS = [7, 8];
  const [dataBits, setDataBits] = useState(8);

  const PARITY_OPTIONS = ['none', 'even', 'odd', 'mark', 'space'];
  const [parity, setParity] = useState('none');

  const STOP_BITS = [1, 2];
  const [stopBits, setStopBits] = useState(1);

  const ENCODING_OPTIONS = ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'];
  const [encoding, setEncoding] = useState('ascii');

  const [portStatus, setPortStatus] = useState('Closed');
  const [receivedData, setReceivedData] = useState('');
  const [dataToSend, setDataToSend] = useState('');

  const receivedDataRef = useRef(null);

  const fetchPorts = async () => {
    // window.electron → window.electron 확인
    if (window.electron) {
      console.log('Using window.electron API');
      const availablePorts = await window.electron.getSerialPorts();
      setPorts(availablePorts);
      if (availablePorts.length > 0 && !selectedPort) {
        setSelectedPort(availablePorts[0].path);
      }
    } else {
      console.error('window.electron is not available');
      console.log('Available APIs:', Object.keys(window));
    }
  };

  useEffect(() => {
    fetchPorts();

    if (window.electron) {
      const cleanupStatus = window.electron.onSerialPortStatus((status) => {
        setPortStatus(status.message);
        console.log("Port Status Update:", status);
      });
      const cleanupData = window.electron.onSerialDataReceived((data) => {
        setReceivedData(prev => prev + data + '\n');
        console.log("Data Received:", data);
      });
      return () => {
        cleanupStatus();
        cleanupData();
      };
    }
  }, []);

  useEffect(() => {
    if (receivedDataRef.current) {
      receivedDataRef.current.scrollTop = receivedDataRef.current.scrollHeight;
    }
  }, [receivedData]);

  const handleOpenPort = async () => {
    if (!selectedPort || !baudRate) {
      alert('Please select a port and baud rate.');
      return;
    }
    
    if (!window.electron) {
      alert('Electron API is not available');
      return;
    }
    
    const result = await window.electron.openSerialPort(
      selectedPort,
      parseInt(baudRate),
      parseInt(dataBits),
      parity,
      parseInt(stopBits)
    );
    console.log(result.message);
    setPortStatus(result.message);
  };

  const handleClosePort = async () => {
    if (!window.electron) {
      alert('Electron API is not available');
      return;
    }
    
    const result = await window.electron.closeSerialPort();
    console.log(result.message);
    setPortStatus(result.message);
  };

  const handleWriteData = async () => {
    if (!dataToSend) {
      alert('Please enter data to send.');
      return;
    }
    
    if (!window.electron) {
      alert('Electron API is not available');
      return;
    }
    
    const result = await window.electron.writeToSerialPort(dataToSend, encoding);
    console.log(result.message);
  };

  return (
    <div className="app-container">
      <h1>FPGA Device Control App</h1>

      <div className="card-grid">
        {/* Serial Port Configuration Card */}
        <div className="card">
          <h2>Serial Port Configuration</h2>
          <div className="card-content">
            <button onClick={fetchPorts}>Refresh Ports</button>
            <div className="input-group">
              <label htmlFor="port-select">Port:</label>
              <select
                id="port-select"
                value={selectedPort}
                onChange={(e) => setSelectedPort(e.target.value)}
              >
                {ports.map(port => (
                  <option key={port.path} value={port.path}>
                    {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label htmlFor="baud-rate-select">Baud Rate:</label>
              <select
                id="baud-rate-select"
                value={baudRate}
                onChange={(e) => setBaudRate(parseInt(e.target.value))}
              >
                {BAUD_RATES.map((rate) => (
                  <option key={rate} value={rate}>
                    {rate}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="data-bits-select">Data Bits:</label>
              <select
                id="data-bits-select"
                value={dataBits}
                onChange={(e) => setDataBits(parseInt(e.target.value))}
              >
                {DATA_BITS.map((bits) => (
                  <option key={bits} value={bits}>
                    {bits}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="parity-select">Parity:</label>
              <select
                id="parity-select"
                value={parity}
                onChange={(e) => setParity(e.target.value)}
              >
                {PARITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="stop-bits-select">Stop Bits:</label>
              <select
                id="stop-bits-select"
                value={stopBits}
                onChange={(e) => setStopBits(parseInt(e.target.value))}
              >
                {STOP_BITS.map((bits) => (
                  <option key={bits} value={bits}>
                    {bits}
                  </option>
                ))}
              </select>
            </div>

            <div className="button-group">
              <button onClick={handleOpenPort}>Open Port</button>
              <button onClick={handleClosePort}>Close Port</button>
            </div>
            <p className="status-text">Status: {portStatus}</p>
          </div>
        </div>

        {/* Send Data Card */}
        <div className="card">
          <h2>Send Data</h2>
          <div className="card-content">
            <div className="input-group">
              <label htmlFor="encoding-select">Encoding:</label>
              <select
                id="encoding-select"
                value={encoding}
                onChange={(e) => setEncoding(e.target.value)}
              >
                {ENCODING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={dataToSend}
              onChange={(e) => setDataToSend(e.target.value)}
              placeholder="Enter data to send to FTDI chip..."
              rows="5"
            ></textarea>
            <button onClick={handleWriteData}>Send Data</button>
          </div>
        </div>

        {/* Received Data Card */}
        <div className="card">
          <h2>Received Data</h2>
          <div className="card-content">
            <textarea
              ref={receivedDataRef}
              readOnly
              value={receivedData}
              placeholder="Data received from FTDI chip..."
              rows="10"
            ></textarea>
            <button onClick={() => setReceivedData('')}>Clear Received Data</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;