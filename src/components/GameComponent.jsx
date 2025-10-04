import React, { useRef, useEffect, useState, useCallback } from 'react';
import { usePrivy, useWallets, useLogin } from '@privy-io/react-auth';
import { useBlockchainUtilsSimple } from '../hooks/useBlockchainUtilsSimple.js';
import { callFaucet } from '../utils/faucet.js';
import TransactionNotifications from './TransactionNotifications.jsx';
import Player from '../game/Player.js';
import Ground from '../game/Ground.js';
import CarrotController from '../game/CarrotController.js';
import Score from '../game/Score.js';
import '../styles/PrivyWalletStatus.css';
import '../styles/TransactionNotifications.css';
import { formatEther } from 'viem';

const GameComponent = ({ selectedNetwork }) => {
  const canvasRef = useRef(null);
  const gameRef = useRef({});
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { login } = useLogin();


  
  // Conditionally use simplified or complex blockchain utils
  const blockchainUtils = useBlockchainUtilsSimple()

  // Extract the functions we need (simplified Blaze Arcade style)
  const {
    initData,
    sendUpdate,
    checkBalance,
    isReady
  } = blockchainUtils;

  // Add missing variables for UI components
  const [transactionPendingCount, setTransactionPendingCount] = useState(0);
  const transactionPending = transactionPendingCount > 0;
  const [balance, setBalance] = useState('0');
  const [isInitializing, setIsInitializing] = useState(false);

  const [blockchainStatus, setBlockchainStatus] = useState({
    initialized: false,
    networkName: selectedNetwork?.name || 'Unknown',
    totalMovements: 0
  });

  const [showToast, setShowToast] = useState(false);
  const [manualFaucetLoading, setManualFaucetLoading] = useState(false);

  // Store blockchain functions in refs to avoid dependency issues
  const blockchainFunctionsRef = useRef({});
  const blockchainStatusRef = useRef(blockchainStatus);

  // Update refs when blockchain functions change
  useEffect(() => {
    blockchainFunctionsRef.current = {
      sendUpdate,
      selectedNetwork,
      blockchainInitialized: blockchainStatus.initialized
    };
    blockchainStatusRef.current = blockchainStatus;
  }, [selectedNetwork, blockchainStatus]);

  // Game constants with pixel art scaling
  const GAME_SPEED_START = 1;
  const GAME_SPEED_INCREMENT = 0.00001;
  const GAME_WIDTH = 800;
  const GAME_HEIGHT = 200;
  const PLAYER_WIDTH = 88 / 1.5;
  const PLAYER_HEIGHT = 94 / 1.5;
  const MAX_JUMP_HEIGHT = GAME_HEIGHT;
  const MIN_JUMP_HEIGHT = 150;
  const GROUND_WIDTH = 2400;
  const GROUND_HEIGHT = 24;
  const GROUND_AND_CARROT_SPEED = 0.5;

  const CARROT_CONFIG = [
    { width: 48 / 1.5, height: 100 / 1.5, imageSrc: "assets/carrot_1.png" },
    { width: 98 / 1.5, height: 100 / 1.5, imageSrc: "assets/carrot_2.png" },
    { width: 68 / 1.5, height: 70 / 1.5, imageSrc: "assets/carrot_3.png" },
  ];

  // Simple blockchain initialization (Blaze Arcade style)
  const initializeBlockchain = async () => {
    if (!isReady || !selectedNetwork || selectedNetwork.isWeb2) {
      setBlockchainStatus(prev => ({
        ...prev,
        initialized: false,
        networkName: selectedNetwork?.name || 'Web2 Mode'
      }));
      return;
    }

    setIsInitializing(true);
    try {
      await initData(selectedNetwork.id);


      console.log("data initialized")

      // Check balance and auto-call faucet if needed (Blaze Arcade pattern)
      const balanceWei = await checkBalance(selectedNetwork.id);
      const balanceEth = formatEther(balanceWei);
      setBalance(balanceEth);

      if (balanceWei === 0n && wallets[0]?.address) {
        console.log(`Balance is 0 on ${selectedNetwork.name}, calling faucet...`);
        await callFaucet(wallets[0].address, selectedNetwork.id);
        // Refresh balance after faucet
        setTimeout(async () => {
          const newBalanceWei = await checkBalance(selectedNetwork.id);
          const newBalanceEth = (Number(newBalanceWei) / 1e18).toFixed(6);
          setBalance(newBalanceEth);
        }, 2000);
      }


      setBlockchainStatus({
        initialized: true,
        networkName: selectedNetwork.name,
        totalMovements: 0
      });

    } catch (error) {
      console.error('Failed to initialize blockchain:', error);
      setBlockchainStatus(prev => ({
        ...prev,
        initialized: false
      }));
    } finally {
      setIsInitializing(false);
    }
  };

  // Simple movement handler (Blaze Arcade style)
  const handleOnChainMovement = useCallback(async () => {
    const { sendUpdate, selectedNetwork, blockchainInitialized } = blockchainFunctionsRef.current;

    // Check if blockchain is ready
    if (!selectedNetwork || selectedNetwork.isWeb2 || !blockchainInitialized) {
      return;
    }

    try {
      // Increment pending count
      setTransactionPendingCount(prev => prev + 1);
      setShowToast(true);

      // Send transaction to makeMovement function
      const result = await sendUpdate(selectedNetwork.id);

      // Update movement count and transaction metrics
      setBlockchainStatus(prev => {
        const newTotalMovements = prev.totalMovements + 1;
        const newAverage = prev.averageTransactionTime
          ? (prev.averageTransactionTime * (newTotalMovements - 1) + result.blockchainTime) / newTotalMovements
          : result.blockchainTime;

        return {
          ...prev,
          totalMovements: newTotalMovements,
          lastTransactionTime: result.blockchainTime,
          averageTransactionTime: newAverage
        };
      });

    } catch (error) {
      console.error('Error sending movement:', error);

      // Store error in blockchain status
      setBlockchainStatus(prev => ({
        ...prev,
        lastError: {
          type: error.name || 'Error',
          message: error.message,
          timestamp: Date.now()
        }
      }));
    } finally {
      // Decrement pending count
      setTransactionPendingCount(prev => Math.max(0, prev - 1));
      setShowToast(false);
    }
  }, []); // Empty dependency array - function is stable now

  // Manual faucet call function (Blaze Arcade style)
  const handleManualFaucet = async () => {
    if (!selectedNetwork || selectedNetwork.isWeb2 || !isReady || !wallets[0]?.address) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      setManualFaucetLoading(true);

      const result = await callFaucet(wallets[0].address, selectedNetwork.id);


      // Transaction is already confirmed by the API (tx.wait())
      if (result.txHash || result.transactionHash) {
        // Refresh balance immediately
        const newBalanceWei = await checkBalance(selectedNetwork.id);
        const newBalanceEth = formatEther(newBalanceWei);
        setBalance(newBalanceEth);

        alert('Faucet request successful! Balance updated.');
      } else {
        alert('Faucet request completed.');
      }

    } catch (error) {
      console.error('Manual faucet error:', error);
      alert(`Faucet request failed: ${error.message}`);
    } finally {
      setManualFaucetLoading(false);
    }
  };

  // Get wallet information for display
  const getWalletInfo = () => {
    // For web2 mode, return special identifier
    if (selectedNetwork && selectedNetwork.isWeb2) {
      return {
        identifier: "CLASSIC PLAYER",
        address: null,
        isWeb2: true
      };
    }
    
    if (!authenticated || !user) return null;
    
    const address = getWalletAddress();
    if (address) {
      return {
        identifier: `${address.slice(0, 6)}...${address.slice(-4)}`,
        address: address
      };
    }
    
    if (user.email) {
      return {
        identifier: user.email.split('@')[0],
        address: null
      };
    }
    
    return null;
  };

  // Get wallet address
  const getWalletAddress = () => {
    if (!authenticated || !wallets || wallets.length === 0) return null;
    return wallets[0]?.address || null;
  };

  // Initialize blockchain when component mounts or network changes
  useEffect(() => {
    // Skip blockchain initialization for web2 mode
    if (selectedNetwork && selectedNetwork.isWeb2) {
      setBlockchainStatus({
        initialized: false,
        networkName: selectedNetwork.name,
        contractAvailable: false,
        pendingTransactions: 0,
        totalMovements: 0,
        onChainScore: 0
      });
      return;
    }

    // Only initialize if we have proper authentication and embedded wallet
    if (selectedNetwork && isReady && authenticated && wallets.length > 0) {
      console.log("yes ready")

      initializeBlockchain();
    } else {
      console.log("not  ready yet")

    }
  }, [selectedNetwork, isReady, authenticated, wallets]);

  // Update blockchain status from hook
  useEffect(() => {
    if (selectedNetwork && !selectedNetwork.isWeb2) {
      setBlockchainStatus(prev => ({
        ...prev,
        pendingTransactions: 0
      }));
    }
  }, [selectedNetwork]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let animationId;
    
    // Disable image smoothing for pixel art effect
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;

    const game = gameRef.current;
    Object.assign(game, {
      scaleRatio: null,
      previousTime: null,
      gameSpeed: GAME_SPEED_START,
      gameOver: false,
      hasAddedEventListenersForRestart: false,
      waitingToStart: true
    });

    function createSprites() {
      const playerWidthInGame = PLAYER_WIDTH * game.scaleRatio;
      const playerHeightInGame = PLAYER_HEIGHT * game.scaleRatio;
      const minJumpHeightInGame = MIN_JUMP_HEIGHT * game.scaleRatio;
      const maxJumpHeightInGame = MAX_JUMP_HEIGHT * game.scaleRatio;

      const groundWidthInGame = GROUND_WIDTH * game.scaleRatio;
      const groundHeightInGame = GROUND_HEIGHT * game.scaleRatio;

      game.player = new Player(
        ctx,
        playerWidthInGame,
        playerHeightInGame,
        minJumpHeightInGame,
        maxJumpHeightInGame,
        game.scaleRatio,
        selectedNetwork && !selectedNetwork.isWeb2 ? handleOnChainMovement : null
      );

      game.ground = new Ground(
        ctx,
        groundWidthInGame,
        groundHeightInGame,
        GROUND_AND_CARROT_SPEED,
        game.scaleRatio
      );

      const carrotImages = CARROT_CONFIG.map(carrot => {
        const image = new Image();
        image.src = carrot.imageSrc;
        image.onerror = () => {};
        return {
          image: image,
          width: carrot.width * game.scaleRatio,
          height: carrot.height * game.scaleRatio
        };
      });

      game.carrotController = new CarrotController(
        ctx,
        carrotImages,
        game.scaleRatio,
        GROUND_AND_CARROT_SPEED
      );

      game.score = new Score(ctx, game.scaleRatio, blockchainStatus, selectedNetwork?.id);
    }

    function setScreen() {
      game.scaleRatio = getScaleRatio();
      canvas.width = GAME_WIDTH * game.scaleRatio;
      canvas.height = GAME_HEIGHT * game.scaleRatio;
      createSprites();
    }

    function getScaleRatio() {
      const screenHeight = Math.min(window.innerHeight, document.documentElement.clientHeight);
      const screenWidth = Math.min(window.innerWidth, document.documentElement.clientWidth);

      if (screenWidth / screenHeight < GAME_WIDTH / GAME_HEIGHT) {
        return screenWidth / GAME_WIDTH;
      } else {
        return screenHeight / GAME_HEIGHT;
      }
    }

    function showGameOverWithWallet() {
      // Create pixelated cyberpunk-style game over screen
      const fontSize = Math.floor(game.scaleRatio * 32);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = "#ef5435";
      ctx.textAlign = "center";
      
      // Add glow effect
      ctx.shadowColor = "#ef5435";
      ctx.shadowBlur = 10;
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - fontSize);
      ctx.shadowBlur = 0;

      const restartFontSize = Math.floor(game.scaleRatio * 16);
      ctx.font = `${restartFontSize}px monospace`;
      ctx.fillStyle = "#929397";
      ctx.fillText(
        "> PRESS ANY KEY TO RESTART",
        canvas.width / 2,
        canvas.height / 2 + restartFontSize
      );

      // Show blockchain status
      const walletInfo = getWalletInfo();
      if (walletInfo) {
        const walletFontSize = Math.floor(game.scaleRatio * 12);
        ctx.font = `${walletFontSize}px monospace`;
        ctx.fillStyle = "#1391ff";
        ctx.fillText(
          `> PILOT: ${walletInfo.identifier}`,
          canvas.width / 2,
          canvas.height / 2 + restartFontSize + walletFontSize + 20
        );
        
        // Show blockchain stats
        ctx.fillStyle = "#929397";
        ctx.fillText(
          `> NETWORK: ${blockchainStatus.networkName}`,
          canvas.width / 2,
          canvas.height / 2 + restartFontSize + walletFontSize * 2 + 25
        );
        
        if (blockchainStatus.totalMovements > 0) {
          ctx.fillText(
            `> ON-CHAIN MOVES: ${blockchainStatus.totalMovements}`,
            canvas.width / 2,
            canvas.height / 2 + restartFontSize + walletFontSize * 3 + 30
          );
        }
      }
    }

    function showStartGameTextWithWallet() {
      // Create cyberpunk-style start screen
      const fontSize = Math.floor(game.scaleRatio * 24);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = "#929397";
      ctx.textAlign = "center";
      
      // Add subtle glow effect
      ctx.shadowColor = "#929397";
      ctx.shadowBlur = 5;
      ctx.fillText(
        "> PRESS ANY KEY TO START MISSION",
        canvas.width / 2,
        canvas.height / 2
      );
      ctx.shadowBlur = 0;

      // Show connection status
      const walletInfo = getWalletInfo();
      const statusFontSize = Math.floor(game.scaleRatio * 12);
      ctx.font = `${statusFontSize}px monospace`;
      
      if (walletInfo) {
        ctx.fillStyle = "#1391ff";
        ctx.shadowColor = "#1391ff";
        ctx.shadowBlur = 3;
        ctx.fillText(
          `> PILOT AUTHENTICATED: ${walletInfo.identifier}`,
          canvas.width / 2,
          canvas.height / 2 + fontSize + 20
        );
        ctx.shadowBlur = 0;
        
        // Show network status
        ctx.fillStyle = "#929397";
        ctx.fillText(
          `> TARGET NETWORK: ${blockchainStatus.networkName}`,
          canvas.width / 2,
          canvas.height / 2 + fontSize + statusFontSize + 25
        );

        // console.log("selected network is here: ", selectedNetwork)

        if (selectedNetwork.id!="web2"){
          ctx.fillStyle = "#28a745";
          ctx.fillText(
            "> BLOCKCHAIN CONNECTION: ACTIVE",
            canvas.width / 2,
            canvas.height / 2 + fontSize + statusFontSize * 2 + 30
          );
          
        }
        
      } else {
        ctx.fillStyle = "#ef5435";
        ctx.fillText(
          "> WARNING: NO PILOT AUTHENTICATED",
          canvas.width / 2,
          canvas.height / 2 + fontSize + 20
        );
      }
    }

    function clearScreen() {
      // Create cyberpunk-style background with grid pattern
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, "#121218");
      gradient.addColorStop(0.5, "#1a1a2e");
      gradient.addColorStop(1, "#16213e");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Add grid overlay
      ctx.strokeStyle = "rgba(146, 147, 151, 0.1)";
      ctx.lineWidth = 1;
      
      const gridSize = 20 * game.scaleRatio;
      
      // Vertical lines
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Add scanning line effect
      const scanLineY = (Date.now() / 20) % canvas.height;
      ctx.strokeStyle = "rgba(19, 145, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, scanLineY);
      ctx.lineTo(canvas.width, scanLineY);
      ctx.stroke();
      
      // Add glow effect at top
      const glowGradient = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.3);
      glowGradient.addColorStop(0, "rgba(19, 145, 255, 0.1)");
      glowGradient.addColorStop(1, "transparent");
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.3);
    }

    function setupGameReset() {
      if (!game.hasAddedEventListenersForRestart) {
        game.hasAddedEventListenersForRestart = true;
        setTimeout(() => {
          const resetHandler = () => {
            reset();
            document.removeEventListener("keyup", resetHandler);
            document.removeEventListener("touchstart", resetHandler);
          };
          document.addEventListener("keyup", resetHandler);
          document.addEventListener("touchstart", resetHandler);
        }, 1000);
      }
    }

    function reset() {
      game.hasAddedEventListenersForRestart = false;
      game.gameOver = false;
      game.waitingToStart = false;
      game.ground.reset();
      game.carrotController.reset();
      game.score.reset();
      game.gameSpeed = GAME_SPEED_START;
    }

    function updateGameSpeed(frameTimeDelta) {
      game.gameSpeed += frameTimeDelta * GAME_SPEED_INCREMENT;
    }

    function checkCollision() {
      return game.carrotController.collideWith(game.player);
    }



    function gameLoop(currentTime) {
      if (game.previousTime === null) {
        game.previousTime = currentTime;
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      const frameTimeDelta = currentTime - game.previousTime;
      game.previousTime = currentTime;

      clearScreen();

      if (!game.gameOver && !game.waitingToStart) {
        // Update
        game.ground.update(game.gameSpeed, frameTimeDelta);
        game.carrotController.update(game.gameSpeed, frameTimeDelta);
        game.player.update(game.gameSpeed, frameTimeDelta);
        game.score.update(frameTimeDelta);
        updateGameSpeed(frameTimeDelta);

        // Check collision
        if (checkCollision()) {
          game.gameOver = true;
          game.score.setHighScore();
          setupGameReset();
        }

        // Remove random blockchain movements - these interfere with proper execution
        // Real blockchain transactions should only happen on actual player jumps
      }

      // Draw
      game.ground.draw();
      game.carrotController.draw();
      game.player.draw();
      game.score.draw(blockchainStatusRef.current);

      if (game.gameOver) {
        showGameOverWithWallet();
      }

      if (game.waitingToStart) {
        showStartGameTextWithWallet();
      }

      animationId = requestAnimationFrame(gameLoop);
    }

    // Initialize game
    setScreen();
    
    // Handle resize
    const handleResize = () => setTimeout(setScreen, 500);
    window.addEventListener("resize", handleResize);
    
    if (screen.orientation) {
      screen.orientation.addEventListener("change", setScreen);
    }

    // Initial input handlers
    const initialKeyHandler = () => {
      // Don't start game if blockchain network is selected but not initialized
      if (selectedNetwork && !selectedNetwork.isWeb2 && !blockchainStatusRef.current.initialized) {
        console.log("Blockchain not initialized yet, cannot start game");
        return;
      }

      reset();
      document.removeEventListener("keyup", initialKeyHandler);
      document.removeEventListener("touchstart", initialKeyHandler);
    };
    
    document.addEventListener("keyup", initialKeyHandler);
    document.addEventListener("touchstart", initialKeyHandler);

    // Start game loop
    animationId = requestAnimationFrame(gameLoop);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener("resize", handleResize);
      if (screen.orientation) {
        screen.orientation.removeEventListener("change", setScreen);
      }
      document.removeEventListener("keyup", initialKeyHandler);
      document.removeEventListener("touchstart", initialKeyHandler);
    };
  }, [selectedNetwork, authenticated, isReady]);

  return (
    <div className="game-container">

      
      <canvas ref={canvasRef} />
      
      {/* Privy Wallet Status Monitor
      {authenticated && selectedNetwork && !selectedNetwork.isWeb2 && (
        <PrivyWalletStatus 
          selectedNetwork={selectedNetwork}
          className="wallet-status-overlay"
        />
      )} */}
      
      {/* Transaction Status Toast */}
      {showToast && (
        <div className="transaction-toast">
          <div className="toast-content">
            <div className="loading-spinner"></div>
            <span>Sending on-chain jump...</span>
          </div>
        </div>
      )}
      
      {/* Blockchain Status Panel с Real-Time Gaming метриками */}
      {/* Blockchain Status Panel with Real-Time Gaming metrics */}
      {selectedNetwork && !selectedNetwork.isWeb2 && (
        <div className="blockchain-status-panel">
          <div className="status-header">
            <span className="network-name">{blockchainStatus.networkName}</span>
            <span className={`status-indicator ${blockchainStatus.initialized ? 'connected' : 'disconnected'}`}>
              {blockchainStatus.initialized ? '🟢' : '🔴'}
            </span>
          </div>
          
          {blockchainStatus.initialized && (
            <div className="status-details">
              <div className="status-item">
                <span className="label">Balance:</span>
                <span className="value">{balance} ETH</span>
              </div>

              <div className="status-item">
                <span className="label">Jumps:</span>
                <span className="value">{blockchainStatus.totalMovements}</span>
              </div>
              
              {/* 🎮 НОВЫЕ Real-Time Gaming метрики */}
              {/* 🎮 NEW Real-Time Gaming metrics */}
              {blockchainStatus.lastTransactionTime && (
                <div className="status-item">
                  <span className="label">Last TX:</span>
                  <span className="value performance-metric">
                    {blockchainStatus.lastTransactionTime}ms
                  </span>
                </div>
              )}
              
              {blockchainStatus.averageTransactionTime && (
                <div className="status-item">
                  <span className="label">Avg Speed:</span>
                  <span className="value performance-metric">
                    {Math.round(blockchainStatus.averageTransactionTime)}ms
                  </span>
                </div>
              )}
              
              {/* Индикатор производительности */}
              {/* Performance indicator */}
              {blockchainStatus.averageTransactionTime && (
                <div className="status-item">
                  <span className="label">Performance:</span>
                  <span className={`value performance-indicator ${
                    blockchainStatus.averageTransactionTime < 1000 ? 'excellent' :
                    blockchainStatus.averageTransactionTime < 3000 ? 'good' :
                    blockchainStatus.averageTransactionTime < 5000 ? 'fair' : 'slow'
                  }`}>
                    {blockchainStatus.averageTransactionTime < 1000 ? '🚀 INSTANT' :
                     blockchainStatus.averageTransactionTime < 3000 ? '⚡ FAST' :
                     blockchainStatus.averageTransactionTime < 5000 ? '🔥 GOOD' : '🐌 SLOW'}
                  </span>
                </div>
              )}
              
              {/* Ошибка последней транзакции */}
              {/* Last transaction error */}
              {blockchainStatus.lastError && (
                <div className="status-item error">
                  <span className="label">Last Error:</span>
                  <span className="value error-text" title={blockchainStatus.lastError.message}>
                    {blockchainStatus.lastError.type}
                  </span>
                </div>
              )}
              
              {parseFloat(balance) < 0.00005 && (
                <div className="status-item">
                  <button 
                    className="faucet-button" 
                    onClick={handleManualFaucet}
                    disabled={manualFaucetLoading}
                  >
                    {manualFaucetLoading ? 'Requesting...' : 'Get Test ETH'}
                  </button>
                </div>
              )}
              {transactionPending && (
                <div className="status-item">
                  <span className="label">Status:</span>
                  <span className="value pending">⚡ Processing TX...</span>
                </div>
              )}
            </div>
          )}
          
          {isInitializing && (
            <div className="initialization-status">
              <div className="loading-spinner"></div>
              <span>🚀 Initializing blockchain...</span>
            </div>
          )}
        </div>
      )}

      {/* Transaction Notifications - правый нижний угол */}
      {/* Transaction Notifications - bottom right corner */}
      <TransactionNotifications
        transactionPending={transactionPending}
        transactionPendingCount={transactionPendingCount}
        balance={balance}
        blockchainStatus={blockchainStatus}
        selectedNetwork={selectedNetwork}
        authenticated={authenticated}
      />
    </div>
  );
};

export default GameComponent;