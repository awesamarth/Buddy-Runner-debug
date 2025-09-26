import React, { useState } from 'react';
import Providers from './context/Providers';
import GameComponent from './components/GameComponent';
import WalletComponent from './components/WalletComponent';
import NetworkSelection from './components/NetworkSelection';
import WalletConnection from './components/WalletConnection';
import PrivyDebugger from './components/PrivyDebugger';
import './App.css';

const App = () => {

  const [gameState, setGameState] = useState('network-selection'); // 'network-selection' | 'wallet-connection' | 'game'
  const [selectedNetwork, setSelectedNetwork] = useState(null);

  const handleNetworkSelect = (network) => {
    setSelectedNetwork(network);
  };

  const handleStartGame = (network) => {
    console.log('App handleStartGame called with network:', network);
    setSelectedNetwork(network);
    // For blockchain networks, require authentication first
    if (!network.isWeb2) {
      console.log('Setting game state to wallet-connection');
      setGameState('wallet-connection');
    } else {
      console.log('Setting game state to game (game started)');
      setGameState('game');
    }
  };

  const handleWalletConnected = () => {
    setGameState('game');
  };

  const handleBackToNetworkSelection = () => {
    setGameState('network-selection');
    setSelectedNetwork(null);
  };

  const handleBackToWalletConnection = () => {
    setGameState('wallet-connection');
  };

  const handleDisconnect = () => {
    // Reset state and return to network selection
    setGameState('network-selection');
    setSelectedNetwork(null);
  };

  return (
    <Providers>
      <div className="app">
        {gameState === 'network-selection' ? (
          <NetworkSelection 
            onNetworkSelect={handleNetworkSelect}
            onStartGame={handleStartGame}
          />
        ) : gameState === 'wallet-connection' ? (
          <div>
            <div className="back-to-wallet">
              <button 
                className="back-button-small"
                onClick={handleBackToNetworkSelection}
              >
                ← Back to Network Selection
              </button>
            </div>
            <WalletConnection onWalletConnected={handleWalletConnected} />
          </div>
        ) : (
          <>
            <div className="back-to-network-button">
              <button 
                className="back-button"
                onClick={handleBackToNetworkSelection}
              >
                ← Back to Network Selection
              </button>
            </div>
            {/* Only show WalletComponent for blockchain networks, not for web2 */}
            {selectedNetwork && !selectedNetwork.isWeb2 && (
              <WalletComponent 
                selectedNetwork={selectedNetwork} 
                onDisconnect={handleDisconnect}
                disableNetworkControls={true}
              />
            )}
            <div className="game-layout">
              <div className="game-header">
                <div className="header-center">
                  <div className="title">
                    Buddy Runner
                    {selectedNetwork && selectedNetwork.isWeb2 && (
                      <span className="web2-mode"> - Classic Mode</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <GameComponent selectedNetwork={selectedNetwork} />
            <div className="instructions">
              <p className="main-instruction">Press SPACE or tap to make Buddy jump!</p>
              <p className="help-text">Help our brave bunny Buddy hop over the giant carrots and achieve the highest score!</p>
              <p className="warning-text">Watch out for those sneaky garden carrots!</p>
            </div>
          </>
        )}
      </div>
      {/* Временный компонент для отладки Privy */}
      {/* Temporary component for Privy debugging */}
      <PrivyDebugger />
    </Providers>
  );
};

export default App;