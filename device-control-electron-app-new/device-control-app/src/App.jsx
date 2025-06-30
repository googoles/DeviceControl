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

  const [portStatus, setPortStatus] = useState('Closed');
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

  // Serial Monitor enhanced features
  const [showTX, setShowTX] = useState(true);
  const [showRX, setShowRX] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [displayFormat, setDisplayFormat] = useState('ascii'); // ascii, hex, binary
  const [timestampFormat, setTimestampFormat] = useState('absolute'); // absolute, relative, milliseconds
  const [autoScroll, setAutoScroll] = useState(true);
  const [maxLogLines, setMaxLogLines] = useState(1000);
  const [selectedEntries, setSelectedEntries] = useState(new Set());
  const [startTime] = useState(Date.now());

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
    const now = Date.now();
    const logEntry = {
      timestamp: now,
      data,
      type, // 'sent' or 'received'
      id: now + Math.random()
    };
    
    setSerialMonitorLog(prev => {
      const newLog = [...prev, logEntry];
      // Limit log lines
      if (newLog.length > maxLogLines) {
        return newLog.slice(-maxLogLines);
      }
      return newLog;
    });
  };

  // Format timestamp based on selected format
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    switch (timestampFormat) {
      case 'relative':
        const diff = timestamp - startTime;
        return `+${(diff / 1000).toFixed(3)}s`;
      case 'milliseconds':
        return `${timestamp}`;
      default: // absolute
        return date.toLocaleTimeString();
    }
  };

  // Format data based on display format
  const formatData = (data) => {
    switch (displayFormat) {
      case 'hex':
        return data.split('').map(char => char.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
      case 'binary':
        return data.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
      default: // ascii
        return data.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
    }
  };

  // Filter and search log entries
  const getFilteredEntries = () => {
    let filtered = serialMonitorLog;

    // Filter by TX/RX
    if (!showTX || !showRX) {
      filtered = filtered.filter(entry => 
        (showTX && entry.type === 'sent') || (showRX && entry.type === 'received')
      );
    }

    // Search filter
    if (searchTerm) {
      if (useRegex) {
        try {
          const regex = new RegExp(searchTerm, 'gi');
          filtered = filtered.filter(entry => regex.test(entry.data));
        } catch (e) {
          // Invalid regex, fall back to simple search
          filtered = filtered.filter(entry => 
            entry.data.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }
      } else {
        filtered = filtered.filter(entry => 
          entry.data.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
    }

    return filtered;
  };

  // Highlight search terms
  const highlightText = (text, term) => {
    if (!term) return text;
    
    if (useRegex) {
      try {
        const regex = new RegExp(`(${term})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
      } catch (e) {
        // Invalid regex, fall back to simple highlighting
        const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
      }
    } else {
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escapedTerm})`, 'gi');
      return text.replace(regex, '<mark>$1</mark>');
    }
  };

  // Toggle entry selection
  const toggleEntrySelection = (entryId) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  // Copy selected entries to clipboard
  const copySelectedEntries = () => {
    const filteredEntries = getFilteredEntries();
    const selectedData = filteredEntries
      .filter(entry => selectedEntries.has(entry.id))
      .map(entry => `[${formatTimestamp(entry.timestamp)}] ${entry.type === 'sent' ? 'TX:' : 'RX:'} ${entry.data}`)
      .join('\n');
    
    if (selectedData) {
      navigator.clipboard.writeText(selectedData);
      alert(`${selectedEntries.size} entries copied to clipboard!`);
    }
  };

  // Save log to file
  const saveLogToFile = (format = 'txt') => {
    const filteredEntries = getFilteredEntries();
    let content = '';
    
    if (format === 'csv') {
      content = 'Timestamp,Direction,Data\n';
      content += filteredEntries.map(entry => 
        `"${formatTimestamp(entry.timestamp)}","${entry.type === 'sent' ? 'TX' : 'RX'}","${entry.data.replace(/"/g, '""')}"`
      ).join('\n');
    } else {
      content = filteredEntries.map(entry => 
        `[${formatTimestamp(entry.timestamp)}] ${entry.type === 'sent' ? 'TX:' : 'RX:'} ${entry.data}`
      ).join('\n');
    }

    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `serial_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearSerialMonitor = () => {
    setSerialMonitorLog([]);
    setSelectedEntries(new Set());
  };

  useEffect(() => {
    fetchPorts();

    if (window.electron) {
      const cleanupStatus = window.electron.onSerialPortStatus((status) => {
        setPortStatus(status.message);
        console.log("Port Status Update:", status);
      });
      const cleanupData = window.electron.onSerialDataReceived((data) => {
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
    if (autoScroll && serialMonitorRef.current) {
      serialMonitorRef.current.scrollTop = serialMonitorRef.current.scrollHeight;
    }
  }, [serialMonitorLog, autoScroll]);

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

  const enableAllChannels = () => {
    setDacChannels(prev => prev.map(channel => ({
      ...channel,
      enabled: true
    })));
  };

  const disableAllChannels = () => {
    setDacChannels(prev => prev.map(channel => ({
      ...channel,
      enabled: false
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

  return (
    <div className="app-container">
      

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
          <div className="serial-cards-container">
            <div className="serial-cards-row">
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

                  <div className="serial-settings-row">
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
                    rows="8"
                  ></textarea>
                  <button onClick={handleWriteData}>Send Data</button>
                </div>
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
                <div className="button-group">
                  <button onClick={enableAllChannels}>Enable All</button>
                  <button onClick={disableAllChannels}>Disable All</button>
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

      {/* Enhanced Serial Monitor at bottom */}
      <div className="serial-monitor">
        <div className="serial-monitor-header">
          <h3>Serial Monitor</h3>
          <div className="monitor-controls">
            {/* Filter Controls */}
            <div className="monitor-control-group">
              <label className="monitor-checkbox">
                <input
                  type="checkbox"
                  checked={showTX}
                  onChange={(e) => setShowTX(e.target.checked)}
                />
                TX
              </label>
              <label className="monitor-checkbox">
                <input
                  type="checkbox"
                  checked={showRX}
                  onChange={(e) => setShowRX(e.target.checked)}
                />
                RX
              </label>
            </div>

            {/* Search Controls */}
            <div className="monitor-control-group">
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="monitor-search"
              />
              <label className="monitor-checkbox">
                <input
                  type="checkbox"
                  checked={useRegex}
                  onChange={(e) => setUseRegex(e.target.checked)}
                />
                Regex
              </label>
            </div>

            {/* Display Options */}
            <div className="monitor-control-group">
              <select
                value={displayFormat}
                onChange={(e) => setDisplayFormat(e.target.value)}
                className="monitor-select"
              >
                <option value="ascii">ASCII</option>
                <option value="hex">HEX</option>
                <option value="binary">Binary</option>
              </select>
              <select
                value={timestampFormat}
                onChange={(e) => setTimestampFormat(e.target.value)}
                className="monitor-select"
              >
                <option value="absolute">Time</option>
                <option value="relative">Relative</option>
                <option value="milliseconds">MS</option>
              </select>
            </div>

            {/* Action Controls */}
            <div className="monitor-control-group">
              <label className="monitor-checkbox">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto Scroll
              </label>
              <input
                type="number"
                value={maxLogLines}
                onChange={(e) => setMaxLogLines(parseInt(e.target.value))}
                min="100"
                max="10000"
                step="100"
                className="monitor-number-input"
                title="Max log lines"
              />
            </div>

            {/* File Operations */}
            <div className="monitor-control-group">
              <button onClick={() => saveLogToFile('txt')} className="monitor-btn">Save TXT</button>
              <button onClick={() => saveLogToFile('csv')} className="monitor-btn">Save CSV</button>
              <button 
                onClick={copySelectedEntries} 
                className="monitor-btn"
                disabled={selectedEntries.size === 0}
              >
                Copy ({selectedEntries.size})
              </button>
              <button onClick={clearSerialMonitor} className="monitor-btn">Clear</button>
            </div>
          </div>
        </div>
        
        <div className="serial-monitor-content" ref={serialMonitorRef}>
          {getFilteredEntries().map((entry) => (
            <div 
              key={entry.id} 
              className={`monitor-entry ${entry.type} ${selectedEntries.has(entry.id) ? 'selected' : ''}`}
              onClick={() => toggleEntrySelection(entry.id)}
            >
              <span className="timestamp">[{formatTimestamp(entry.timestamp)}]</span>
              <span className="direction">{entry.type === 'sent' ? 'TX:' : 'RX:'}</span>
              <span 
                className="data"
                dangerouslySetInnerHTML={{
                  __html: highlightText(formatData(entry.data), searchTerm)
                }}
              />
            </div>
          ))}
          {getFilteredEntries().length === 0 && serialMonitorLog.length > 0 && (
            <div className="monitor-placeholder">No entries match current filters...</div>
          )}
          {serialMonitorLog.length === 0 && (
            <div className="monitor-placeholder">No data transmitted yet...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;