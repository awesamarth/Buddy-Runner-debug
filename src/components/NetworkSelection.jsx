import React, { useState, useEffect } from 'react';
import { useLogin, usePrivy } from '@privy-io/react-auth';
import './NetworkSelection.css';

const NetworkSelection = ({ onNetworkSelect, onStartGame }) => {
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [terminalText, setTerminalText] = useState('');
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  const { user, authenticated } = usePrivy();
  const { login } = useLogin();

  const networks = [
    { 
      id: 'web2', 
      name: 'CLASSIC BROWSER', 
      emoji: ',',
      description: 'Pure web2 experience',
      tech: 'No wallet required',
      color: '#2ecc71',
      status: 'ONLINE',
      icon: ',',
      isWeb2: true
    },
    { 
      id: 6342, 
      name: 'MEGAETH TESTNET', 
      emoji: ',',
      description: 'Ultra-fast execution layer',
      tech: 'Lightning-fast transactions',
      color: '#ff6b6b',
      status: 'ONLINE',
      icon: ''
    },
    { 
      id: 84532, 
      name: 'BASE SEPOLIA', 
      emoji: ',',
      description: 'Ethereum L2 testnet',
      tech: 'Reliable scaling solution',
      color: '#4ecdc4',
      status: 'ONLINE',
      icon: ''
    },
    { 
      id: 10143, 
      name: 'MONAD TESTNET', 
      emoji: ',',
      description: 'Next-gen blockchain',
      tech: 'Advanced consensus',
      color: '#9b59b6',
      status: 'BETA',
      icon: ''
    }
  ];

  useEffect(() => {
    const initMessages = [
      'INITIALIZING NETWORK SCANNER...',
      'DETECTING AVAILABLE CHAINS...',
      'ESTABLISHING SECURE CONNECTIONS...',
      'SYSTEM READY FOR NETWORK SELECTION'
    ];

    let messageIndex = 0;
    const interval = setInterval(() => {
      setTerminalText(initMessages[messageIndex]);
      messageIndex++;
      if (messageIndex >= initMessages.length) {
        clearInterval(interval);
        setTimeout(() => setIsInitializing(false), 500);
      }
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Hook для отслеживания размеров окна
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // Динамические стили на основе размеров окна
  const getDynamicStyles = () => {
    const { width, height } = windowDimensions;
    
    // Определяем тип устройства на основе размеров
    const isMobile = width <= 768;
    const isTablet = width > 768 && width <= 1024;
    const isDesktop = width > 1024;
    const isLargeDesktop = width > 1600;
    
    // Адаптивная ширина контейнера
    let containerWidth;
    if (isMobile) {
      containerWidth = Math.min(width * 0.98, width - 20);
    } else if (isTablet) {
      containerWidth = Math.min(width * 0.92, width - 60);
    } else if (isLargeDesktop) {
      containerWidth = Math.min(width * 0.85, 1400);
    } else {
      containerWidth = Math.min(width * 0.88, 1200);
    }
    
    // Адаптивная высота контейнера
    const containerMaxHeight = height * (isMobile ? 0.95 : 0.9);
    const containerMinHeight = Math.min(height * (isMobile ? 0.7 : 0.6), isMobile ? 500 : 600);
    
    // Адаптивный padding
    const padding = isMobile ? 
      Math.max(15, width * 0.03) : 
      Math.max(20, width * 0.025);
    
    return {
      containerStyle: {
        width: `${containerWidth}px`,
        maxHeight: `${containerMaxHeight}px`,
        minHeight: `${containerMinHeight}px`,
        transition: 'all 0.3s ease'
      },
      contentStyle: {
        padding: `${padding}px`,
        transition: 'all 0.3s ease'
      },
      networkGridStyle: {
        gridTemplateColumns: isMobile ? 
          '1fr' : 
          isTablet ? 
            'repeat(auto-fit, minmax(280px, 1fr))' : 
            'repeat(auto-fit, minmax(300px, 1fr))',
        gap: `${isMobile ? 15 : isDesktop ? 25 : 20}px`
      }
    };
  };

  const { containerStyle, contentStyle, networkGridStyle } = getDynamicStyles();

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
    onNetworkSelect(network);
  };

  const handleStartGame = () => {
    console.log('handleStartGame called with network:', selectedNetwork);
    if (selectedNetwork) {
      // If web2 option is selected, skip wallet connection entirely
      if (selectedNetwork.isWeb2) {
        console.log('Starting Web2 game mode');
        onStartGame(selectedNetwork);
        return;
      }
      
      // For blockchain networks, always call onStartGame
      // The App component will handle the wallet connection flow
      console.log('Starting blockchain game mode');
      onStartGame(selectedNetwork);
    }
  };

  // Removed useEffect to prevent double navigation
  // The flow is now handled directly through button clicks

  if (isInitializing) {
    return (
      <div className="network-scanner-overlay">
        <div className="scanner-container" style={containerStyle}>
          <div className="scanner-content" style={contentStyle}>
            <div className="terminal-header">
              <div className="terminal-title">NETWORK SCANNER PROTOCOL</div>
              <div className="terminal-buttons">
                <div className="terminal-button red"></div>
                <div className="terminal-button yellow"></div>
                <div className="terminal-button green"></div>
              </div>
            </div>
            
            <div className="logo-section">
              <div className="pixel-logo">
                <div className="logo-text">
                  <span className="logo-main">BUDDY</span>
                  <span className="logo-accent">RUNNER</span>
                </div>
              </div>
            </div>

            <div className="scanner-display">
              <div className="radar-container">
                <div className="radar-sweep"></div>
                <div className="radar-grid"></div>
              </div>
            </div>

            <div className="scanner-text">
              <span className="terminal-prompt"></span> {terminalText}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="network-selection-overlay">
      <div className="network-selection-container" style={containerStyle}>
        <div className="network-selection-content" style={contentStyle}>
          <div className="terminal-header">
            <div className="terminal-title">BLOCKCHAIN NETWORK SELECTOR</div>
            <div className="terminal-buttons">
              <div className="terminal-button red"></div>
              <div className="terminal-button yellow"></div>
              <div className="terminal-button green"></div>
            </div>
          </div>

          <div className="logo-section">
            <div className="pixel-logo">
              <div className="logo-text">
                <span className="logo-main">BUDDY</span>
                <span className="logo-accent">RUNNER</span>
              </div>
              <div className="logo-powered">POWERED BY <strong>MEGA BUDDIES</strong></div>
            </div>
          </div>
          
          <div className="mission-briefing">
            <div className="briefing-title">MISSION BRIEFING</div>
            <div className="briefing-content">
              <div className="terminal-text">
                <span className="terminal-prompt"></span> OBJECTIVE: SURVIVE 60 SECONDS ON EACH NETWORK
              </div>
              <div className="terminal-text">
                <span className="terminal-prompt"></span> ANALYZE BLOCK TIME IMPACT ON USER EXPERIENCE
              </div>
              <div className="terminal-text">
                <span className="terminal-prompt"></span> DISCOVER THE POWER OF REAL-TIME BLOCKCHAIN
              </div>
            </div>
          </div>

          <div className="network-selection">
            <div className="selection-title">SELECT TARGET BLOCKCHAIN NETWORK:</div>
            
            <div className="network-grid" style={networkGridStyle}>
              {networks.map((network) => (
                <div
                  key={network.id}
                  className={`network-card ${selectedNetwork?.id === network.id ? 'selected' : ''}`}
                  onClick={() => handleNetworkSelect(network)}
                >
                  <div className="network-header">
                    <div className="network-icon">{network.icon}</div>
                    <div className="network-status" data-status={network.status}>
                      {network.status}
                    </div>
                  </div>
                  
                  <div className="network-info">
                    <div className="network-name">{network.name}</div>
                    <div className="network-description">{network.description}</div>
                    <div className="network-tech">{network.tech}</div>
                  </div>

                  <div className="network-specs">
                    <div className="spec-item">
                      <span className="spec-label">{network.isWeb2 ? 'TYPE:' : 'CHAIN ID:'}</span>
                      <span className="spec-value">{network.isWeb2 ? 'WEB2' : network.id}</span>
                    </div>
                    <div className="spec-item">
                      <span className="spec-label">NETWORK:</span>
                      <span className="spec-value">{network.isWeb2 ? 'BROWSER' : 'TESTNET'}</span>
                    </div>
                  </div>

                  <div className="selection-indicator">
                    {selectedNetwork?.id === network.id && (
                      <div className="selected-glow">SELECTED</div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedNetwork && (
              <div className="launch-section">
                <div className="launch-info">
                  <div className="terminal-text">
                    <span className="terminal-prompt"></span> TARGET NETWORK: {selectedNetwork.name}
                  </div>
                  <div className="terminal-text">
                    <span className="terminal-prompt"></span> MISSION STATUS: READY FOR DEPLOYMENT
                  </div>
                </div>
                <button className="launch-button" onClick={handleStartGame}>
                  <span className="button-icon"></span>
                  LAUNCH MISSION ON {selectedNetwork.name}
                  <div className="button-glow"></div>
                </button>
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
  );
};

export default NetworkSelection;