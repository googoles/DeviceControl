import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  // Tab state
  const [activeTab, setActiveTab] = useState('serial');

  // Serial Port states
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState('');
  const BAUD_RATES = [
    300, 600, 1200, 2400, 4800, 9600, 14400, 19200, 28800, 38400, 57600, 115200, 230400, 460800, 921600
  ];
  const [baudRate, setBaudRate] = useState(115200);

  const DATA_BITS = [7, 8];
  const [dataBits, setDataBits] = useState(8);

  const PARITY_OPTIONS = ['none', 'even', 'odd', 'mark', 'space'];
  const [parity, setParity] = useState('none');

  const STOP_BITS = [1, 2];
  const [stopBits, setStopBits] = useState(1);

  const ENCODING_OPTIONS = ['ascii', 'utf8', 'utf16le', 'ucs2', 'base64', 'binary', 'hex'];
  const [encoding, setEncoding] = useState('ascii');
  const [receivedDataEncoding, setReceivedDataEncoding] = useState('utf8');

  const [portStatus, setPortStatus] = useState('Closed');
  const [receivedData, setReceivedData] = useState('');
  const [dataToSend, setDataToSend] = useState('');

  // DAC Control states
  const [dacChannels, setDacChannels] = useState(
    Array.from({ length: 24 }, (_, i) => ({
      id: i + 1,
      value: 0,
      enabled: true,
      min: 0,
      max: 4095 // 12-bit DAC default
    }))
  );
  const [dacResolution, setDacResolution] = useState(12); // 12 or 16 bit
  const [allChannelsValue, setAllChannelsValue] = useState(0);

  // Serial Monitor states
  const [serialMonitorLog, setSerialMonitorLog] = useState([]);
  const serialMonitorRef = useRef(null);
  const receivedDataRef = useRef(null);

  const fetchPorts = async () => {
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

  // Add to serial monitor log
  const addToSerialMonitor = (data, type) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      data,
      type, // 'sent' or 'received'
      id: Date.now() + Math.random()
    };
    setSerialMonitorLog(prev => [...prev, logEntry]);
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
        addToSerialMonitor(data, 'received');
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

  useEffect(() => {
    if (serialMonitorRef.current) {
      serialMonitorRef.current.scrollTop = serialMonitorRef.current.scrollHeight;
    }
  }, [serialMonitorLog]);

  // Update DAC max values when resolution changes
  useEffect(() => {
    const maxValue = dacResolution === 12 ? 4095 : 65535;
    setDacChannels(prev => prev.map(channel => ({
      ...channel,
      max: maxValue,
      value: Math.min(channel.value, maxValue)
    })));
    setAllChannelsValue(0);
  }, [dacResolution]);

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
    addToSerialMonitor(dataToSend, 'sent');
    console.log(result.message);
  };

  // DAC Control functions
  const updateDacChannel = (channelId, newValue) => {
    setDacChannels(prev => prev.map(channel => 
      channel.id === channelId ? { ...channel, value: parseInt(newValue) } : channel
    ));
  };

  const toggleDacChannel = (channelId) => {
    setDacChannels(prev => prev.map(channel => 
      channel.id === channelId ? { ...channel, enabled: !channel.enabled } : channel
    ));
  };

  const setAllChannels = () => {
    setDacChannels(prev => prev.map(channel => ({
      ...channel,
      value: parseInt(allChannelsValue)
    })));
  };

  const sendDacCommand = async (channelId, value) => {
    if (!window.electron) {
      alert('Electron API is not available');
      return;
    }

    // DAC command format: "DAC,<channel>,<value>\n"
    const command = `DAC,${channelId},${value}\n`;
    const result = await window.electron.writeToSerialPort(command, 'ascii');
    addToSerialMonitor(command.trim(), 'sent');
    console.log(result.message);
  };

  const sendAllDacChannels = async () => {
    for (const channel of dacChannels) {
      if (channel.enabled) {
        await sendDacCommand(channel.id, channel.value);
        // Small delay between commands
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  };

  const convertReceivedData = (data) => {
    if (!data) return '';
    
    try {
      switch (receivedDataEncoding) {
        case 'hex':
          return data.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        case 'binary':
          return data.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        case 'base64':
          return btoa(data);
        default:
          return data;
      }
    } catch (error) {
      console.error('Error converting received data:', error);
      return data;
    }
  };

  const clearSerialMonitor = () => {
    setSerialMonitorLog([]);
  };

  return (
    <div className="app-container">
      <h1>FPGA Device Control App</h1>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={activeTab === 'serial' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('serial')}
        >
          Serial Communication
        </button>
        <button 
          className={activeTab === 'dac' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('dac')}
        >
          24-Channel DAC Control
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'serial' && (
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
                  <label htmlFor="send-encoding-select">Send Encoding:</label>
                  <select
                    id="send-encoding-select"
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
                <div className="input-group">
                  <label htmlFor="received-encoding-select">Display Encoding:</label>
                  <select
                    id="received-encoding-select"
                    value={receivedDataEncoding}
                    onChange={(e) => setReceivedDataEncoding(e.target.value)}
                  >
                    {ENCODING_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  ref={receivedDataRef}
                  readOnly
                  value={convertReceivedData(receivedData)}
                  placeholder="Data received from FTDI chip..."
                  rows="10"
                ></textarea>
                <button onClick={() => setReceivedData('')}>Clear Received Data</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dac' && (
          <div className="dac-control-container">
            {/* DAC Configuration */}
            <div className="card">
              <h2>DAC Configuration</h2>
              <div className="card-content">
                <div className="input-group">
                  <label htmlFor="dac-resolution">DAC Resolution:</label>
                  <select
                    id="dac-resolution"
                    value={dacResolution}
                    onChange={(e) => setDacResolution(parseInt(e.target.value))}
                  >
                    <option value={12}>12-bit (0-4095)</option>
                    <option value={16}>16-bit (0-65535)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="all-channels-value">Set All Channels:</label>
                  <div className="all-channels-control">
                    <input
                      type="number"
                      id="all-channels-value"
                      value={allChannelsValue}
                      onChange={(e) => setAllChannelsValue(e.target.value)}
                      min="0"
                      max={dacResolution === 12 ? 4095 : 65535}
                    />
                    <button onClick={setAllChannels}>Apply to All</button>
                  </div>
                </div>
                <div className="button-group">
                  <button onClick={sendAllDacChannels}>Send All Channels</button>
                </div>
              </div>
            </div>

            {/* DAC Channels Grid */}
            <div className="dac-channels-grid">
              {dacChannels.map((channel) => (
                <div key={channel.id} className="dac-channel-card">
                  <div className="channel-header">
                    <h3>Channel {channel.id}</h3>
                    <label className="channel-enable">
                      <input
                        type="checkbox"
                        checked={channel.enabled}
                        onChange={() => toggleDacChannel(channel.id)}
                      />
                      Enable
                    </label>
                  </div>
                  <div className="channel-controls">
                    <input
                      type="range"
                      min={channel.min}
                      max={channel.max}
                      value={channel.value}
                      onChange={(e) => updateDacChannel(channel.id, e.target.value)}
                      disabled={!channel.enabled}
                      className="dac-slider"
                    />
                    <div className="channel-value-controls">
                      <input
                        type="number"
                        value={channel.value}
                        onChange={(e) => updateDacChannel(channel.id, e.target.value)}
                        min={channel.min}
                        max={channel.max}
                        disabled={!channel.enabled}
                        className="channel-value-input"
                      />
                      <button
                        onClick={() => sendDacCommand(channel.id, channel.value)}
                        disabled={!channel.enabled}
                        className="send-channel-button"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Serial Monitor at bottom */}
      <div className="serial-monitor">
        <div className="serial-monitor-header">
          <h3>Serial Monitor</h3>
          <button onClick={clearSerialMonitor}>Clear</button>
        </div>
        <div className="serial-monitor-content" ref={serialMonitorRef}>
          {serialMonitorLog.map((entry) => (
            <div key={entry.id} className={`monitor-entry ${entry.type}`}>
              <span className="timestamp">[{entry.timestamp}]</span>
              <span className="direction">{entry.type === 'sent' ? 'TX:' : 'RX:'}</span>
              <span className="data">{entry.data}</span>
            </div>
          ))}
          {serialMonitorLog.length === 0 && (
            <div className="monitor-placeholder">No data transmitted yet...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;