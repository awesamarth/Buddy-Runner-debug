// // PRE-SIGNED TRANSACTIONS ONLY - Используем только предварительно подписанные транзакции
// // We use only pre-signed transactions
// // Этот сервис больше не создает транзакции через ethers.js, а использует pre-signed пул
// // This service no longer creates transactions through ethers.js, but uses pre-signed pool

// // Contract addresses for different networks
// const CONTRACT_ADDRESSES = {
//   6342: "0x0000000000000000000000000000000000000000",  // MegaETH Testnet - Deploy contract here
//   84532: "0x0000000000000000000000000000000000000000", // Base Sepolia - Deploy contract here
//   10143: "0x0000000000000000000000000000000000000000"  // Monad Testnet - Deploy contract here
// };

// class BlockchainService {
//   constructor() {
//     this.chainId = null;
//     this.transactionQueue = [];
//     this.isProcessingQueue = false;
//     this.blockchainUtils = null; // Будет инициализирован через setBlockchainUtils
//     // Will be initialized through setBlockchainUtils
//   }

//   // Установка blockchain utils для использования pre-signed транзакций
//   // Setting up blockchain utils for using pre-signed transactions
//   setBlockchainUtils(utils) {
//     this.blockchainUtils = utils;
//   }

//   async initialize(privyWallet, chainId) {
//     try {
//       if (!privyWallet) {
//         throw new Error('No wallet provided');
//       }

//       this.chainId = chainId;

//       console.log(`Blockchain service initialized for pre-signed transactions on chain ${this.chainId}`);
//       return true;
//     } catch (error) {
//       console.error('Failed to initialize blockchain service:', error);
//       return false;
//     }
//   }

//   async startGame() {
//     if (!this.blockchainUtils) {
//       console.error('BlockchainUtils not set, cannot use pre-signed transactions');
//       return { success: false, error: 'Pre-signed transaction system not available' };
//     }

//     try {
//       console.log('Starting game with pre-signed transaction...');
      
//       // Используем pre-signed транзакцию через blockchainUtils
//       // Use pre-signed transaction through blockchainUtils
//       const result = await this.blockchainUtils.sendAndConfirmTransaction(this.chainId);
      
//       console.log('Game started with pre-signed transaction:', result);
      
//       return { 
//         success: true, 
//         txHash: result.transactionHash || result.hash,
//         blockchainTime: result.blockchainTime
//       };
//     } catch (error) {
//       console.error('Failed to start game with pre-signed transaction:', error);
//       return { success: false, error: error.message };
//     }
//   }

//   async makeMovement() {
//     if (!this.blockchainUtils) {
//       console.warn('BlockchainUtils not set, simulating movement');
//       return { success: true, simulated: true };
//     }

//     // Add to queue for processing with pre-signed transactions
//     return new Promise((resolve) => {
//       this.transactionQueue.push({
//         type: 'movement',
//         resolve,
//         timestamp: Date.now()
//       });
//       this.processQueue();
//     });
//   }

//   async processQueue() {
//     if (this.isProcessingQueue || this.transactionQueue.length === 0) {
//       return;
//     }

//     this.isProcessingQueue = true;

//     try {
//       // Process movements in batches using pre-signed transactions
//       const batchSize = 2; // Allow max 2 pending transactions as per Crossy Fluffle
//       const currentBatch = this.transactionQueue.splice(0, batchSize);

//       for (const item of currentBatch) {
//         try {
//           // Используем pre-signed транзакцию для движения
//           // Use pre-signed transaction for movement
//           const result = await this.blockchainUtils.sendAndConfirmTransaction(this.chainId);
//           console.log('Movement sent with pre-signed transaction:', result);

//           item.resolve({ 
//             success: true, 
//             txHash: result.transactionHash || result.hash,
//             blockchainTime: result.blockchainTime,
//             pending: false // Pre-signed транзакции обрабатываются быстрее
//             // Pre-signed transactions are processed faster
//           });
//         } catch (error) {
//           console.error('Pre-signed movement transaction failed:', error);
//           item.resolve({ 
//             success: false, 
//             error: error.message 
//           });
//         }
//       }
//     } catch (error) {
//       console.error('Error processing pre-signed transaction queue:', error);
//     }

//     this.isProcessingQueue = false;

//     // Continue processing if there are more items
//     if (this.transactionQueue.length > 0) {
//       setTimeout(() => this.processQueue(), 100);
//     }
//   }

//   async endGame() {
//     if (!this.blockchainUtils) {
//       console.warn('BlockchainUtils not set, cannot end game on-chain');
//       return { success: false, error: 'Pre-signed transaction system not available' };
//     }

//     try {
//       console.log('Ending game with pre-signed transaction...');
      
//       // Используем pre-signed транзакцию для завершения игры
//       // Use pre-signed transaction for game completion
//       const result = await this.blockchainUtils.sendAndConfirmTransaction(this.chainId);
      
//       console.log('Game ended with pre-signed transaction:', result);
      
//       return { 
//         success: true, 
//         txHash: result.transactionHash || result.hash,
//         blockchainTime: result.blockchainTime
//       };
//     } catch (error) {
//       console.error('Failed to end game with pre-signed transaction:', error);
//       return { success: false, error: error.message };
//     }
//   }

//   async getPlayerSession(address) {
//     // В режиме pre-signed транзакций данные сессии недоступны через контракт
//     // In pre-signed transaction mode, session data is not available through contract
//     // Возвращаем mock данные или получаем из локального состояния
//     // Return mock data or get from local state
//     console.warn('Player session data not available in pre-signed only mode');
//     return null;
//   }

//   async getPlayerHighScore(address) {
//     // В режиме pre-signed транзакций хай-скор недоступен через контракт
//     // In pre-signed transaction mode, high score is not available through contract
//     // Возвращаем mock данные или получаем из локального состояния
//     // Return mock data or get from local state
//     console.warn('High score data not available in pre-signed only mode');
//     return 0;
//   }

//   getNetworkName() {
//     const networks = {
//       6342: 'MegaETH Testnet',
//       84532: 'Base Sepolia',
//       10143: 'Monad Testnet',
//       1: 'Ethereum Mainnet',
//       11155111: 'Sepolia Testnet'
//     };
//     return networks[this.chainId] || `Unknown Network (${this.chainId})`;
//   }

//   isContractAvailable() {
//     // В режиме pre-signed транзакций контракт всегда "доступен" через pre-signed пул
//     // In pre-signed transaction mode, contract is always "available" through pre-signed pool
//     return this.blockchainUtils !== null;
//   }

//   getPendingTransactions() {
//     return this.transactionQueue.length;
//   }
// }

// export default new BlockchainService();