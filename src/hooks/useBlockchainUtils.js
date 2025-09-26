import { useState, useEffect, useRef } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, http, custom, parseGwei, createPublicClient } from 'viem';

// Конфигурация сетей
// Network configuration
const NETWORK_CONFIGS = {
  6342: { // MegaETH Testnet
    name: 'MegaETH Testnet',
    rpcUrl: 'https://carrot.megaeth.com/rpc',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0', 
    faucetAddress: '0x76b71a17d82232fd29aca475d14ed596c67c4b85',
    chainId: 6342,
    sendMethod: 'realtime_sendRawTransaction', // Специальный метод для MegaETH
    // Special method for MegaETH
    connectionTimeouts: {
      initial: 10000, // 10 seconds for initial connection
      retry: 3000,    // 3 seconds for retries (быстрые retry для gaming)
      // fast retries for gaming
      request: 5000   // 5 seconds for individual requests (для real-time gaming)
      // for real-time gaming
    },
    maxConnections: 3, // Limit concurrent connections
  },
  31337: { // Foundry Local
    name: 'Foundry Local',
    rpcUrl: 'http://127.0.0.1:8545',
    fallbackRpcUrls: ['http://127.0.0.1:8545'],
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    faucetAddress: '0x76b71a17d82232fd29aca475d14ed596c67c4b85',
    chainId: 31337,
    sendMethod: 'eth_sendRawTransaction',
    connectionTimeouts: {
      initial: 10000,
      retry: 5000,
      request: 15000
    },
    maxConnections: 2,
  },
  50311: { // Somnia Testnet
    name: 'Somnia Testnet',
    rpcUrl: 'https://testnet.somnia.network',
    fallbackRpcUrls: ['https://testnet.somnia.network'],
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    faucetAddress: '0x76b71a17d82232fd29aca475d14ed596c67c4b85',
    chainId: 50311,
    sendMethod: 'eth_sendRawTransaction',
    connectionTimeouts: {
      initial: 20000,
      retry: 10000,
      request: 30000
    },
    maxConnections: 2,
  },
  1313161556: { // RISE Testnet
    name: 'RISE Testnet',
    rpcUrl: 'https://testnet-rpc.rise.com',
    fallbackRpcUrls: ['https://testnet-rpc.rise.com'],
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    faucetAddress: '0x76b71a17d82232fd29aca475d14ed596c67c4b85',
    chainId: 1313161556,
    sendMethod: 'eth_sendRawTransactionSync', // Синхронный метод для RISE
    // Synchronous method for RISE
    connectionTimeouts: {
      initial: 20000,
      retry: 10000,
      request: 30000
    },
    maxConnections: 2,
  }
};

// ABI для Updater контракта
// ABI for Updater contract
const UPDATER_ABI = [
  {
    "inputs": [],
    "name": "update",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "number",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Safe JSON parsing utility to handle malformed responses
const safeJsonParse = (data) => {
  try {
    // Handle common malformed responses
    if (typeof data === 'string') {
      // Remove common prefixes that cause JSON parsing issues
      const cleanedData = data
        .replace(/^cadesplugin_loaded/, '')
        .replace(/^EnableInte.*?$/, '')
        .trim();
      
      if (cleanedData.length === 0) {
        return null;
      }
      
      return JSON.parse(cleanedData);
    }
    return data;
  } catch (error) {
    console.warn('Failed to parse JSON response:', error.message, 'Data:', data);
    return null;
  }
};

export const useBlockchainUtils = () => {
  const { authenticated, user, login, logout, isReady } = usePrivy();
  const { wallets } = useWallets();

  // Состояние
  // State
  const [isInitializing, setIsInitializing] = useState(false);
  const [transactionPending, setTransactionPending] = useState(false);
  const [balance, setBalance] = useState('0');
  const [contractNumber, setContractNumber] = useState(0);

  // РЕВОЛЮЦИОННАЯ система кеширования с долгосрочным хранением
  // REVOLUTIONARY caching system with long-term storage
  const clientCache = useRef({});
  const gasParams = useRef({});
  
  // НОВАЯ система глобального кеширования для минимизации RPC вызовов
  // NEW global caching system to minimize RPC calls
  const GLOBAL_CACHE_KEY = 'megaBuddies_globalCache';
  const CACHE_EXPIRY = {
    gasParams: 5 * 60 * 1000, // 5 минут для газовых параметров
    // 5 minutes for gas parameters
    chainParams: 30 * 1000,   // 30 секунд для параметров сети
    // 30 seconds for network parameters
    rpcHealth: 2 * 60 * 1000, // 2 минуты для RPC health
    // 2 minutes for RPC health
    clients: 10 * 60 * 1000,  // 10 минут для клиентов
    // 10 minutes for clients
    nonce: 30 * 1000          // 30 секунд для nonce кэша
  };

  // Сохранение глобального кеша в localStorage с обработкой BigInt
  // Saving global cache to localStorage with BigInt handling
  const saveGlobalCache = () => {
    try {
      // Функция для безопасной сериализации BigInt
      // Function for safe BigInt serialization
      const serializeBigInt = (obj) => {
        return JSON.parse(JSON.stringify(obj, (key, value) => {
          if (typeof value === 'bigint') {
            return value.toString() + 'n'; // Добавляем маркер 'n' для BigInt
            // Add 'n' marker for BigInt
          }
          return value;
        }));
      };
      
      const cacheData = {
        gasParams: {
          data: serializeBigInt(gasParams.current),
          timestamp: Date.now()
        },
        chainParams: {
          data: chainParamsCache.current,
          timestamp: Date.now()
        },
        rpcHealth: {
          data: rpcHealthStatus.current,
          timestamp: Date.now()
        },
        nonceCache: {
          data: nonceManager.current,
          timestamp: Date.now()
        }
      };
      
      localStorage.setItem(GLOBAL_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to save global cache:', error);
    }
  };

  // Загрузка глобального кеша из localStorage с восстановлением BigInt
  const loadGlobalCache = () => {
    try {
      const cached = localStorage.getItem(GLOBAL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        
        // Функция для восстановления BigInt
        const deserializeBigInt = (obj) => {
          if (typeof obj === 'string' && obj.endsWith('n')) {
            return BigInt(obj.slice(0, -1));
          }
          if (typeof obj === 'object' && obj !== null) {
            const result = Array.isArray(obj) ? [] : {};
            for (const [key, value] of Object.entries(obj)) {
              result[key] = deserializeBigInt(value);
            }
            return result;
          }
          return obj;
        };
        
        // Проверяем и загружаем только актуальные данные
        if (parsed.gasParams && (now - parsed.gasParams.timestamp) < CACHE_EXPIRY.gasParams) {
          gasParams.current = deserializeBigInt(parsed.gasParams.data);
          console.log('🎯 Loaded cached gas parameters from storage');
        }
        
        if (parsed.chainParams && (now - parsed.chainParams.timestamp) < CACHE_EXPIRY.chainParams) {
          chainParamsCache.current = parsed.chainParams.data;
          console.log('🎯 Loaded cached chain parameters from storage');
        }
        
        if (parsed.rpcHealth && (now - parsed.rpcHealth.timestamp) < CACHE_EXPIRY.rpcHealth) {
          rpcHealthStatus.current = parsed.rpcHealth.data;
          console.log('🎯 Loaded cached RPC health from storage');
        }
        
        if (parsed.nonceCache && (now - parsed.nonceCache.timestamp) < CACHE_EXPIRY.nonce) {
          // Осторожно восстанавливаем nonce кэш - используем только если данные не слишком старые
          Object.entries(parsed.nonceCache.data).forEach(([key, cachedManager]) => {
            if (cachedManager && typeof cachedManager.currentNonce === 'number') {
              nonceManager.current[key] = {
                ...cachedManager,
                isUpdating: false, // Сбрасываем флаг обновления
                lastUpdate: cachedManager.lastUpdate || 0
              };
            }
          });
          console.log('🎯 Loaded cached nonce data from storage');
        }
      }
    } catch (error) {
      console.warn('Failed to load global cache:', error);
    }
  };

  // Инициализация глобального кеша при загрузке
  useEffect(() => {
    loadGlobalCache();
    
    // Сохраняем кеш каждые 30 секунд
    const saveInterval = setInterval(saveGlobalCache, 30000);
    
    // Сохраняем при закрытии страницы
    const handleBeforeUnload = () => saveGlobalCache();
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // АВТОМАТИЧЕСКИЙ сброс circuit breaker для быстрого восстановления
    const resetCircuitBreakerInterval = setInterval(() => {
      Object.keys(circuitBreakers.current).forEach(chainId => {
        const cb = circuitBreakers.current[chainId];
        if (cb && cb.state === 'OPEN') {
          const timeSinceLastFailure = Date.now() - cb.lastFailureTime;
          if (timeSinceLastFailure > cb.timeout) {
            cb.state = 'HALF_OPEN';
            cb.failures = 0;
            console.log(`🔄 Auto-reset circuit breaker for chain ${chainId} - trying again`);
          }
        }
      });
    }, 10000); // Проверяем каждые 10 секунд
    
    return () => {
      clearInterval(saveInterval);
      clearInterval(resetCircuitBreakerInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveGlobalCache(); // Финальное сохранение
    };
  }, []);

  // НОВАЯ система управления соединениями
  const connectionPool = useRef({});
  const rpcHealthStatus = useRef({});
  const activeConnections = useRef({});
  
  // УЛУЧШЕННЫЙ ПУЛ ТРАНЗАКЦИЙ с большим размером и централизованным nonce
  const preSignedPool = useRef({});
  const nonceManager = useRef({}); // Централизованное управление nonce
  const isInitialized = useRef({});
  const transactionPendingCount = useRef(0); // Счетчик одновременных транзакций
  
  // РЕВОЛЮЦИОННАЯ система Performance Monitoring для Real-Time Gaming
  const performanceMetrics = useRef({});
  
  const initPerformanceMonitoring = (chainId) => {
    if (!performanceMetrics.current[chainId]) {
      performanceMetrics.current[chainId] = {
        recentTransactions: [],
        averageBlockchainTime: 0,
        successRate: 0,
        totalTransactions: 0,
        successfulTransactions: 0,
        lastUpdate: Date.now()
      };
    }
    return performanceMetrics.current[chainId];
  };

  const recordPerformanceMetric = (chainId, blockchainTime, success) => {
    const metrics = initPerformanceMonitoring(chainId);
    
    metrics.recentTransactions.push({
      blockchainTime,
      success,
      timestamp: Date.now()
    });
    
    // Держим только последние 50 транзакций для расчетов
    if (metrics.recentTransactions.length > 50) {
      metrics.recentTransactions.shift();
    }
    
    // Обновляем статистику
    metrics.totalTransactions++;
    if (success) {
      metrics.successfulTransactions++;
    }
    
    // Рассчитываем средние значения
    const recentSuccessful = metrics.recentTransactions.filter(tx => tx.success);
    if (recentSuccessful.length > 0) {
      metrics.averageBlockchainTime = recentSuccessful.reduce((sum, tx) => sum + tx.blockchainTime, 0) / recentSuccessful.length;
    }
    
    metrics.successRate = (metrics.successfulTransactions / metrics.totalTransactions) * 100;
    metrics.lastUpdate = Date.now();
    
    return metrics;
  };

  // Кеширование параметров сети для минимизации RPC вызовов
  const chainParamsCache = useRef({});

  // PRE-SIGNED ONLY MODE: Увеличенные пулы для гарантированной доступности транзакций
  const ENHANCED_POOL_CONFIG = {
    6342: { // MegaETH - МАКСИМАЛЬНАЯ ПРОИЗВОДИТЕЛЬНОСТЬ с исправлениями
      poolSize: 300, // ЗНАЧИТЕЛЬНО УВЕЛИЧЕН для предотвращения исчерпания
      refillAt: 0.1, // ОЧЕНЬ РАННЕЕ пополнение при 10% использования  
      batchSize: 100, // БОЛЬШОЙ размер пакета для редких пополнений
      maxRetries: 3,
      retryDelay: 200, // Быстрые retry для MegaETH
      burstMode: true, // Поддержка burst режима
      maxBurstSize: 15, // УВЕЛИЧЕН лимит burst для длинных сессий
      burstCooldown: 100 // УМЕНЬШЕН cooldown для минимизации задержек
    },
    31337: { // Foundry
      poolSize: 120, // УВЕЛИЧЕН для длинных игровых сессий
      refillAt: 0.2, // Более раннее пополнение
      batchSize: 30, // Больший размер пакета
      maxRetries: 3,
      retryDelay: 150,
      burstMode: true,
      maxBurstSize: 8, // Увеличен лимит burst
      burstCooldown: 200 // Уменьшен cooldown
    },
    50311: { // Somnia
      poolSize: 100, // УВЕЛИЧЕН для длинных игровых сессий
      refillAt: 0.2, // Более раннее пополнение
      batchSize: 25, // Больший размер пакета
      maxRetries: 3,
      retryDelay: 300,
      burstMode: true,
      maxBurstSize: 6, // Увеличен лимит burst
      burstCooldown: 400 // Уменьшен cooldown
    },
    1313161556: { // RISE
      poolSize: 50, // Увеличен для pre-signed only
      refillAt: 0.4,
      batchSize: 12,
      maxRetries: 2,
      retryDelay: 400,
      burstMode: false,
      maxBurstSize: 2,
      burstCooldown: 1500
    },
    default: {
      poolSize: 60, // Увеличен для pre-signed only
      refillAt: 0.3, // Раннее пополнение
      batchSize: 15,
      maxRetries: 3,
      retryDelay: 300,
      burstMode: false,
      maxBurstSize: 2,
      burstCooldown: 1000
    }
  };

  // Fallback конфигурация для MegaETH
  const MEGAETH_FALLBACK_CONFIG = {
    // Уменьшаем batch size при проблемах с RPC
    reducedBatchSize: 1,
    // Увеличиваем задержки
    increasedDelay: 1000,
    // Режим graceful degradation
    degradedMode: false
  };

  const fallbackState = useRef({
    6342: { ...MEGAETH_FALLBACK_CONFIG } // MegaETH
  });

  // Система управления burst режимом и rate limiting
  const burstState = useRef({});
  
  const getBurstManager = (chainId) => {
    if (!burstState.current[chainId]) {
      const config = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
      burstState.current[chainId] = {
        lastBurstTime: 0,
        burstCount: 0,
        inCooldown: false,
        pendingTransactions: [],
        processingBurst: false
      };
    }
    return burstState.current[chainId];
  };

  // Проверка возможности burst транзакции
  const canExecuteBurst = (chainId) => {
    const config = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
    if (!config.burstMode) return false;

    const burstManager = getBurstManager(chainId);
    const now = Date.now();

    // Проверяем cooldown период
    if (burstManager.inCooldown && (now - burstManager.lastBurstTime) < config.burstCooldown) {
      return false;
    }

    // Если cooldown закончился, сбрасываем состояние
    if (burstManager.inCooldown && (now - burstManager.lastBurstTime) >= config.burstCooldown) {
      burstManager.inCooldown = false;
      burstManager.burstCount = 0;
    }

    return burstManager.burstCount < config.maxBurstSize;
  };

  // Обновление состояния burst менеджера
  const updateBurstState = (chainId, success) => {
    const config = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
    if (!config.burstMode) return;

    const burstManager = getBurstManager(chainId);
    const now = Date.now();

    if (success) {
      burstManager.burstCount++;
      burstManager.lastBurstTime = now;

              // Если достигли лимита burst, включаем КОРОТКИЙ cooldown
        if (burstManager.burstCount >= config.maxBurstSize) {
          burstManager.inCooldown = true;
          console.log(`Burst mode short cooldown activated for chain ${chainId} (${config.burstCooldown}ms) - optimized for long sessions`);
        }
    }
  };

  // Умная очередь транзакций для burst режима
  const queueBurstTransaction = async (chainId, transactionFn) => {
    const burstManager = getBurstManager(chainId);
    
    return new Promise((resolve, reject) => {
      burstManager.pendingTransactions.push({
        fn: transactionFn,
        resolve,
        reject,
        timestamp: Date.now()
      });
      
      // Запускаем обработку очереди если еще не запущена
      if (!burstManager.processingBurst) {
        processBurstQueue(chainId);
      }
    });
  };

  // Обработка очереди burst транзакций
  const processBurstQueue = async (chainId) => {
    const burstManager = getBurstManager(chainId);
    burstManager.processingBurst = true;

    while (burstManager.pendingTransactions.length > 0) {
      const canBurst = canExecuteBurst(chainId);
      
      if (!canBurst) {
        // Ждем окончания cooldown
        const config = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
        const waitTime = Math.max(100, config.burstCooldown / 10);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const transaction = burstManager.pendingTransactions.shift();
      if (!transaction) break;

      try {
        const result = await transaction.fn();
        updateBurstState(chainId, true);
        transaction.resolve(result);
      } catch (error) {
        updateBurstState(chainId, false);
        transaction.reject(error);
      }
    }

    burstManager.processingBurst = false;
  };

  // НОВАЯ система мониторинга здоровья RPC endpoints
  const initializeRpcHealth = (chainId) => {
    const config = NETWORK_CONFIGS[chainId];
    if (!config) return;

    if (!rpcHealthStatus.current[chainId]) {
      rpcHealthStatus.current[chainId] = {
        endpoints: config.fallbackRpcUrls.map(url => ({
          url,
          healthy: true,
          lastChecked: 0,
          consecutiveFailures: 0,
          responseTime: 0
        })),
        currentEndpointIndex: 0,
        lastHealthCheck: 0
      };
    }
  };

  // Получение следующего здорового RPC endpoint
  const getHealthyRpcEndpoint = async (chainId) => {
    const health = rpcHealthStatus.current[chainId];
    if (!health) {
      initializeRpcHealth(chainId);
      return NETWORK_CONFIGS[chainId].rpcUrl;
    }

    // Ищем здоровый endpoint
    for (let i = 0; i < health.endpoints.length; i++) {
      const endpoint = health.endpoints[health.currentEndpointIndex];
      
      if (endpoint.healthy || endpoint.consecutiveFailures < 3) {
        return endpoint.url;
      }
      
      // Переходим к следующему endpoint
      health.currentEndpointIndex = (health.currentEndpointIndex + 1) % health.endpoints.length;
    }

    // Если все endpoints нездоровы, возвращаем первый (возможно, проблема временная)
    console.warn(`All RPC endpoints for chain ${chainId} appear unhealthy, using primary`);
    return health.endpoints[0].url;
  };

  // Обновление статуса здоровья endpoint
  const updateRpcHealth = (chainId, rpcUrl, success, responseTime = 0) => {
    const health = rpcHealthStatus.current[chainId];
    if (!health) return;

    const endpoint = health.endpoints.find(ep => ep.url === rpcUrl);
    if (!endpoint) return;

    endpoint.lastChecked = Date.now();
    endpoint.responseTime = responseTime;

    if (success) {
      endpoint.healthy = true;
      endpoint.consecutiveFailures = 0;
    } else {
      endpoint.consecutiveFailures++;
      if (endpoint.consecutiveFailures >= 3) {
        endpoint.healthy = false;
        console.warn(`Marking RPC endpoint as unhealthy: ${rpcUrl} (${endpoint.consecutiveFailures} failures)`);
      }
    }
  };

  // Управление пулом соединений
  const getConnectionFromPool = (chainId, rpcUrl) => {
    const poolKey = `${chainId}-${rpcUrl}`;
    const config = NETWORK_CONFIGS[chainId];
    
    if (!activeConnections.current[poolKey]) {
      activeConnections.current[poolKey] = 0;
    }

    if (activeConnections.current[poolKey] >= config.maxConnections) {
      throw new Error(`Maximum connections (${config.maxConnections}) reached for ${poolKey}`);
    }

    activeConnections.current[poolKey]++;
    
    return () => {
      // Cleanup function
      if (activeConnections.current[poolKey] > 0) {
        activeConnections.current[poolKey]--;
      }
    };
  };

  // Управление fallback режимом
  const enableFallbackMode = (chainId) => {
    const state = fallbackState.current[chainId];
    if (state) {
      state.degradedMode = true;
      console.log(`Enabled fallback mode for chain ${chainId}`);
    }
  };

  const getFallbackConfig = (chainId) => {
    const state = fallbackState.current[chainId];
    return state?.degradedMode ? state : null;
  };

  // УЛУЧШЕННОЕ получение embedded wallet с дополнительными проверками
  const getEmbeddedWallet = () => {
    if (!authenticated || !wallets.length) {
      console.log('🔍 getEmbeddedWallet: Not authenticated or no wallets available');
      return null;
    }
    
    // Only log in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 getEmbeddedWallet: Available wallets:', wallets.map(w => ({
        address: w.address,
        walletClientType: w.walletClientType,
        connectorType: w.connectorType,
        type: w.type,
        walletIndex: w.walletIndex
      })));
    }
    
    // Enhanced embedded wallet detection with multiple criteria
    const embeddedWallet = wallets.find(wallet => {
      // Check for embedded wallet indicators
      const isEmbedded = 
        wallet.walletClientType === 'privy' || 
        wallet.connectorType === 'embedded' ||
        wallet.connectorType === 'privy' ||
        wallet.type === 'embedded' ||
        wallet.walletClientType === 'embedded' ||
        wallet.walletIndex === 0; // First wallet is usually embedded
      
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Checking wallet ${wallet.address}:`, {
          walletClientType: wallet.walletClientType,
          connectorType: wallet.connectorType,
          type: wallet.type,
          walletIndex: wallet.walletIndex,
          isEmbedded
        });
      }
      
      return isEmbedded;
    });
    
    if (embeddedWallet) {
      console.log('✅ Found embedded wallet:', {
        address: embeddedWallet.address,
        walletClientType: embeddedWallet.walletClientType,
        connectorType: embeddedWallet.connectorType,
        type: embeddedWallet.type,
        walletIndex: embeddedWallet.walletIndex
      });
      return embeddedWallet;
    }
    
    console.log('⚠️ No embedded wallet found, available wallets:', wallets.length);
    console.log('⚠️ This might cause faucet to send to wrong wallet!');
    
    // Do NOT fall back to first wallet; require embedded wallet
    return null;
  };


  // ЗНАЧИТЕЛЬНО УЛУЧШЕННОЕ создание клиентов с системой fallback endpoints
  const createClients = async (chainId) => {
    const cacheKey = `${chainId}`;
    if (clientCache.current[cacheKey]) {
      return clientCache.current[cacheKey];
    }

    const config = NETWORK_CONFIGS[chainId];
    if (!config) throw new Error(`Unsupported network: ${chainId}`);

    let embeddedWallet = getEmbeddedWallet();
    if (!embeddedWallet) {
      console.log('🔄 No embedded wallet found, attempting to ensure one exists...');
      embeddedWallet = await ensureEmbeddedWallet();
      if (!embeddedWallet) {
        throw new Error('No embedded wallet found and could not create one');
      }
    }

    // Инициализируем систему мониторинга RPC здоровья
    initializeRpcHealth(chainId);

    try {
      // Получаем здоровый RPC endpoint
      const healthyRpcUrl = await getHealthyRpcEndpoint(chainId);
      console.log(`Using RPC endpoint for chain ${chainId}: ${healthyRpcUrl}`);

      // Получаем соединение из пула
      const releaseConnection = getConnectionFromPool(chainId, healthyRpcUrl);

      // Создаем публичный клиент с адаптивными таймаутами
      const publicClient = createPublicClient({
        chain: {
          id: chainId,
          name: config.name,
          network: config.name.toLowerCase().replace(/\s+/g, '-'),
          nativeCurrency: {
            name: 'Ether',
            symbol: 'ETH',
            decimals: 18
          },
          rpcUrls: {
            default: { http: [healthyRpcUrl] },
            public: { http: [healthyRpcUrl] }
          }
        },
        transport: http(healthyRpcUrl, {
          timeout: config.connectionTimeouts.initial,
          retryCount: 4, // Увеличен retry count
          retryDelay: ({ count }) => Math.min(1000 * Math.pow(2, count), 8000) // Exponential backoff
        })
      });

      // Для MegaETH используем локальное подписание (не RPC)
      let walletClient;
      if (chainId === 6342) {
        // MegaETH: локальное подписание с Privy account
        walletClient = createWalletClient({
          account: embeddedWallet.address,
          chain: publicClient.chain,
          transport: custom({
            async request({ method, params }) {
              if (method === 'eth_signTransaction') {
                // Локальное подписание через embedded wallet
                const embeddedWallet = getEmbeddedWallet();
                if (!embeddedWallet) {
                  throw new Error('No embedded wallet found for signing');
                }
                
                // Создаем walletClient с embedded wallet
                const provider = await embeddedWallet.getProvider?.() || 
                                await embeddedWallet.getEthereumProvider?.() ||
                                embeddedWallet;
                
                if (provider?.request) {
                  return await provider.request({ method, params });
                }
                
                throw new Error('Unable to get provider for signing');
              }
              // Остальные методы идут через публичный RPC
              return await publicClient.request({ method, params });
            }
          })
        });
      } else {
        // Для других сетей используем стандартный подход с улучшенными таймаутами
        walletClient = createWalletClient({
          account: embeddedWallet.address,
          chain: publicClient.chain,
          transport: http(healthyRpcUrl, {
            timeout: config.connectionTimeouts.retry,
            retryCount: 4,
            retryDelay: ({ count }) => Math.min(1000 * Math.pow(2, count), 5000)
          })
        });
      }

      const clients = { 
        publicClient, 
        walletClient, 
        config,
        rpcUrl: healthyRpcUrl,
        releaseConnection // Функция для освобождения соединения
      };
      clientCache.current[cacheKey] = clients;

      console.log(`Created clients for chain ${chainId}:`, {
        publicRPC: healthyRpcUrl,
        signingMethod: chainId === 6342 ? 'Local Privy' : 'RPC'
      });

      return clients;
    } catch (error) {
      console.error(`Error creating clients for chain ${chainId}:`, error);
      throw error;
    }
  };

  // ЦЕНТРАЛИЗОВАННОЕ управление nonce
  const getNonceManager = (chainId, address) => {
    const key = `${chainId}-${address}`;
    if (!nonceManager.current[key]) {
      nonceManager.current[key] = {
        currentNonce: null,
        pendingNonce: null,
        lastUpdate: 0,
        isUpdating: false
      };
    }
    return nonceManager.current[key];
  };

  // УЛУЧШЕННОЕ получение и управление nonce
  const getNextNonce = async (chainId, address, forceRefresh = false) => {
    const manager = getNonceManager(chainId, address);
    const now = Date.now();
    
    // ВАЖНО: Для предподписанных транзакций НЕ обновляем nonce из сети
    // Только для первичной инициализации или при форсированном обновлении
    const chainKey = chainId.toString();
    const pool = preSignedPool.current[chainKey];
    
    // Если есть активный пул предподписанных транзакций, используем его базовый nonce
    if (pool && pool.isReady && !forceRefresh) {
      const poolNonce = pool.baseNonce + pool.currentIndex;
      console.log(`🎯 Using pool-based nonce ${poolNonce} for ${address} on chain ${chainId} (pool: ${pool.currentIndex}/${pool.transactions.length})`);
      return poolNonce;
    }
    
    // Обновляем nonce если прошло больше 30 секунд или принудительное обновление
    if (!manager.currentNonce || forceRefresh || (now - manager.lastUpdate) > 30000) {
      if (manager.isUpdating) {
        // Ждем завершения текущего обновления с таймаутом
        let waitTime = 0;
        while (manager.isUpdating && waitTime < 5000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitTime += 100;
        }
        
        // Если обновление заблокировано слишком долго, принудительно сбрасываем флаг
        if (manager.isUpdating) {
          console.warn('⚠️ Nonce update timeout, forcing reset');
          manager.isUpdating = false;
        }
      }
      
      if (!manager.isUpdating) {
        manager.isUpdating = true;
        try {
          const { publicClient } = await createClients(chainId);
          
          // Получаем и подтвержденный, и pending nonces для лучшей синхронизации
          const [latestNonce, pendingNonce] = await Promise.all([
            publicClient.getTransactionCount({ address: address, blockTag: 'latest' }),
            publicClient.getTransactionCount({ address: address, blockTag: 'pending' })
          ]);
          
          // Используем максимальное значение между всеми nonces
          const networkNonce = Math.max(latestNonce, pendingNonce);
          const previousNonce = manager.currentNonce || 0;
          
          // При форсированном обновлении всегда используем сетевой nonce
          if (forceRefresh) {
            manager.currentNonce = networkNonce;
            manager.pendingNonce = networkNonce;
            console.log(`🔄 Force refresh: nonce updated for ${address} on chain ${chainId}: ${previousNonce} → ${networkNonce}`);
          } else if (networkNonce > previousNonce) {
            manager.currentNonce = networkNonce;
            manager.pendingNonce = networkNonce;
            console.log(`🔄 Nonce updated for ${address} on chain ${chainId}: ${previousNonce} → ${networkNonce}`);
          } else {
            // Если сетевой nonce меньше, используем наш локальный (возможно есть pending транзакции)
            manager.pendingNonce = manager.currentNonce;
            console.log(`🔄 Keeping local nonce for ${address} on chain ${chainId}: ${manager.currentNonce} (network: ${networkNonce})`);
          }
          
          manager.lastUpdate = now;
          
        } catch (error) {
          console.error('❌ Error updating nonce:', error);
          // Если не удалось получить nonce из сети
          if (manager.currentNonce !== null) {
            // При ошибке не увеличиваем nonce, просто логируем
            console.warn(`⚠️ Using cached nonce ${manager.currentNonce} due to network error`);
            manager.pendingNonce = manager.currentNonce;
          } else {
            // Если nonce вообще не инициализирован, начинаем с 0
            manager.currentNonce = 0;
            manager.pendingNonce = 0;
            console.warn(`⚠️ Initializing nonce to 0 due to network error`);
          }
        } finally {
          manager.isUpdating = false;
        }
      }
    }
    
    // Возвращаем следующий доступный nonce (только для real-time транзакций)
    const nextNonce = manager.pendingNonce;
    manager.pendingNonce += 1;
    
    console.log(`🎯 Allocated nonce ${nextNonce} for ${address} on chain ${chainId}`);
    return nextNonce;
  };

  // Получение газовых параметров
  const getGasParams = async (chainId) => {
    const cacheKey = chainId.toString();
    
    // Проверяем кеш с учетом времени жизни
    if (gasParams.current[cacheKey]) {
      const cached = gasParams.current[cacheKey];
      const age = Date.now() - (cached.timestamp || 0);
      
      // Для MegaETH используем более частое обновление (2 минуты)
      // Для других сетей - стандартное (5 минут)
      const maxAge = chainId === 6342 ? 2 * 60 * 1000 : CACHE_EXPIRY.gasParams;
      
      if (age < maxAge) {
        console.log(`🎯 Using cached gas params for chain ${chainId} (age: ${Math.round(age/1000)}s)`);
        return cached;
      }
    }

    try {
      const { publicClient } = await createClients(chainId);
      
      let maxFeePerGas, maxPriorityFeePerGas;
      
      // Специальные ОПТИМИЗИРОВАННЫЕ параметры для разных сетей
      if (chainId === 6342) {
        // MegaETH Testnet - максимально оптимизированные параметры для real-time
        console.log('⚡ Using ultra-optimized gas parameters for MegaETH real-time gaming');
        maxFeePerGas = parseGwei('0.001'); // Снижено до 1 mwei для максимальной скорости
        maxPriorityFeePerGas = parseGwei('0.0005'); // 0.5 mwei priority
        
      } else if (chainId === 31337) {
        // Foundry Local - минимальные параметры
        maxFeePerGas = parseGwei('0.01');
        maxPriorityFeePerGas = parseGwei('0.001');
        
      } else {
        // Для остальных сетей используем динамические параметры с кешированием
        try {
          const gasPrice = await publicClient.getGasPrice();
          maxFeePerGas = gasPrice * 2n; // 2x для запаса
          maxPriorityFeePerGas = parseGwei('1'); // 1 gwei priority
        } catch (error) {
          console.warn('Failed to get dynamic gas price, using fallback:', error);
          // Fallback значения
          maxFeePerGas = parseGwei('20');
          maxPriorityFeePerGas = parseGwei('2');
        }
      }

      const params = { 
        maxFeePerGas, 
        maxPriorityFeePerGas,
        timestamp: Date.now()
      };
      
      gasParams.current[cacheKey] = params;
      
      console.log(`⚡ Gas params for chain ${chainId}: {maxFeePerGas: ${Number(maxFeePerGas) / 1e9} gwei, maxPriorityFeePerGas: ${Number(maxPriorityFeePerGas) / 1e9} gwei}`);
      
      // Сохраняем в глобальный кеш асинхронно
      setTimeout(saveGlobalCache, 100);
      
      return params;
    } catch (error) {
      console.error('Error getting gas params:', error);
      
      // Возвращаем кешированные данные если есть, даже если устарели
      if (gasParams.current[cacheKey]) {
        console.log('🔄 Using stale cached gas params due to error');
        return gasParams.current[cacheKey];
      }
      
      // Последний fallback
      const fallbackParams = {
        maxFeePerGas: parseGwei('20'),
        maxPriorityFeePerGas: parseGwei('2'),
        timestamp: Date.now()
      };
      
      gasParams.current[cacheKey] = fallbackParams;
      return fallbackParams;
    }
  };

  // Получение параметров сети с кешированием
  const getCachedChainParams = async (chainId) => {
    const cacheKey = chainId.toString();
    
    if (chainParamsCache.current[cacheKey]) {
      return chainParamsCache.current[cacheKey];
    }

    try {
      const { publicClient } = await createClients(chainId);
      
      // Получаем все необходимые параметры одним запросом для оффлайн подписания
              const [chainIdHex, blockNumber] = await Promise.all([
        retryWithBackoff(() => publicClient.getChainId(), 2, 500, chainId),
        retryWithBackoff(() => publicClient.getBlockNumber(), 2, 500, chainId)
      ]);

      const params = {
        chainId: chainIdHex,
        blockNumber: Number(blockNumber)
      };

      // Кешируем на 30 секунд для MegaETH, дольше для других сетей
      const cacheTime = chainId === 6342 ? 30000 : 60000;
      chainParamsCache.current[cacheKey] = params;
      
      setTimeout(() => {
        delete chainParamsCache.current[cacheKey];
      }, cacheTime);

      console.log(`Cached chain params for ${chainId}:`, params);
      return params;
    } catch (error) {
      console.error('Error getting chain params:', error);
      // Возвращаем базовые параметры если RPC недоступен
      return {
        chainId: chainId,
        blockNumber: 0
      };
    }
  };

  // ЗНАЧИТЕЛЬНО УЛУЧШЕННОЕ предварительное подписание пакета транзакций
  const preSignBatch = async (chainId, startNonce, count) => {
    const chainKey = chainId.toString();
    
    // Получаем конфигурацию для данной сети
    const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
    const fallbackConfig = getFallbackConfig(chainId);
    
    // Применяем конфигурацию
    let actualCount = Math.min(count, poolConfig.poolSize);
    if (fallbackConfig) {
      actualCount = Math.min(actualCount, fallbackConfig.reducedBatchSize);
      console.log(`Using fallback mode for chain ${chainId}: batch size ${actualCount}`);
    }
    
    console.log(`Pre-signing ${actualCount} transactions for chain ${chainId} starting from nonce ${startNonce}`);
    
    if (!preSignedPool.current[chainKey]) {
      preSignedPool.current[chainKey] = {
        transactions: [],
        currentIndex: 0,
        baseNonce: startNonce,
        hasTriggeredRefill: false,
        isRefilling: false,
        isReady: false // Новый флаг готовности
      };
    }

    const pool = preSignedPool.current[chainKey];
    const { walletClient } = await createClients(chainId);
    const gasParams = await getGasParams(chainId);

    console.log(`Using gas parameters: {maxFeePerGasGwei: ${Number(gasParams.maxFeePerGas) / 10**9}, maxPriorityFeePerGasGwei: ${Number(gasParams.maxPriorityFeePerGas) / 10**9}}`);

    const config = NETWORK_CONFIGS[chainId];
    const embeddedWallet = getEmbeddedWallet();
    
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    // ПАРАЛЛЕЛЬНОЕ подписание транзакций для максимальной скорости
    const PARALLEL_BATCH_SIZE = 10; // Подписываем по 10 транзакций параллельно
    console.log(`🚀 Starting parallel pre-signing of ${actualCount} transactions`);
    
    // Сначала подписываем первую транзакцию отдельно для быстрого старта
    try {
      const firstNonce = startNonce;
      const firstTxData = {
        account: embeddedWallet.address,
        to: config.contractAddress,
        data: '0xa2e62045',
        nonce: firstNonce,
        maxFeePerGas: gasParams.maxFeePerGas,
        maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
        value: 0n,
        type: 'eip1559',
        gas: 100000n,
      };
      
      const firstSignedTx = await walletClient.signTransaction(firstTxData);
      
      pool.transactions.push({
        signedTx: firstSignedTx,
        _reservedNonce: firstNonce,
        timestamp: Date.now()
      });
      
      // КРИТИЧНО: Делаем пул доступным сразу же после первой транзакции
      pool.isReady = true;
      console.log(`🎮 First transaction ready - gaming can begin!`);
      console.log(`✅ Pre-signed transaction pool is now ACTIVE with 1 transaction`);
      
      // Запускаем проактивный мониторинг пула
      startPoolMonitoring(chainId);
    } catch (error) {
      console.error('Failed to sign first transaction:', error);
      throw error;
    }
    
    // Подписываем остальные транзакции параллельными батчами
    for (let batchStart = 1; batchStart < actualCount; batchStart += PARALLEL_BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + PARALLEL_BATCH_SIZE, actualCount);
      const batchSize = batchEnd - batchStart;
      
      // Создаем массив промисов для параллельного подписания
      const signingPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        const nonce = startNonce + i;
        
        const signTransaction = async () => {
          try {
            const txData = {
              account: embeddedWallet.address,
              to: config.contractAddress,
              data: '0xa2e62045',
              nonce,
              maxFeePerGas: gasParams.maxFeePerGas,
              maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
              value: 0n,
              type: 'eip1559',
              gas: 100000n,
            };

            let signedTx;
            
            // Разные методы подписания для разных сетей
            if (chainId === 6342) {
              // MegaETH: используем прямое подписание
              signedTx = await retryWithBackoff(
                async () => await walletClient.signTransaction(txData),
                fallbackConfig ? 1 : poolConfig.maxRetries,
                poolConfig.retryDelay,
                chainId
              );
            } else {
              // Другие сети: используем walletClient
              signedTx = await retryWithBackoff(
                () => walletClient.signTransaction(txData),
                fallbackConfig ? 1 : poolConfig.maxRetries,
                poolConfig.retryDelay,
                chainId
              );
            }
            
            return {
              signedTx,
              _reservedNonce: nonce,
              timestamp: Date.now()
            };
          } catch (error) {
            console.error(`Error signing transaction with nonce ${nonce}:`, error);
            
            // Для rate limiting ошибок, просто логируем но продолжаем
            if (error.message?.includes('rate limit') || error.status === 429 || error.status === 403 || error.message?.includes('not whitelisted')) {
              console.log('Rate limit/403/not whitelisted detected during pre-signing, skipping transaction');
              return null;
            }
            
            return null;
          }
        };
        
        signingPromises.push(signTransaction());
      }
      
      // Ждем завершения всех транзакций в батче
      const batchResults = await Promise.all(signingPromises);
      
      // Добавляем успешно подписанные транзакции
      const successfulTxs = batchResults.filter(tx => tx !== null);
      pool.transactions.push(...successfulTxs);
      
      console.log(`Pre-signed batch ${Math.floor((batchStart - 1) / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil((actualCount - 1) / PARALLEL_BATCH_SIZE)} - total ${pool.transactions.length}/${actualCount}`);
      
      // Добавляем небольшую задержку между батчами для предотвращения rate limiting
      if (batchEnd < actualCount) {
        const delay = fallbackConfig ? fallbackConfig.increasedDelay : Math.min(poolConfig.retryDelay, 100);
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.log(`Successfully pre-signed ${pool.transactions.length} transactions`);
    
    // Если мы в fallback режиме и у нас есть хотя бы одна транзакция, это успех
    if (fallbackConfig && pool.transactions.length > 0) {
      console.log('Fallback mode: minimum transactions ready for gaming');
    }
    
    // Обновляем nonce manager чтобы учесть использованные nonces
    const manager = getNonceManager(chainId, embeddedWallet.address);
    if (manager) {
      manager.pendingNonce = Math.max(manager.pendingNonce || 0, startNonce + pool.transactions.length);
    }
  };

  // УЛУЧШЕННОЕ умное пополнение пула
  const extendPool = async (chainId, startNonce, count) => {
    const chainKey = chainId.toString();
    const pool = preSignedPool.current[chainKey];
    
    // Предотвращаем параллельные пополнения
    if (!pool || pool.isRefilling) {
      console.log('Pool extension already in progress, skipping');
      return;
    }
    
    try {
      pool.isRefilling = true;
      console.log(`Extending pool for chain ${chainId} from nonce ${startNonce} with ${count} transactions`);
      
      // Создаем отдельный временный пул для новых транзакций
      const tempTransactions = [];
      const { walletClient } = await createClients(chainId);
      const gasParams = await getGasParams(chainId);
      const config = NETWORK_CONFIGS[chainId];
      const embeddedWallet = getEmbeddedWallet();
      
      // ПАРАЛЛЕЛЬНОЕ подписание новых транзакций для максимальной скорости
      const PARALLEL_BATCH_SIZE = 10; // Подписываем по 10 транзакций параллельно
      console.log(`📝 Starting parallel signing of ${count} transactions in batches of ${PARALLEL_BATCH_SIZE}`);
      
      for (let batchStart = 0; batchStart < count; batchStart += PARALLEL_BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + PARALLEL_BATCH_SIZE, count);
        const batchSize = batchEnd - batchStart;
        
        // Создаем массив промисов для параллельного подписания
        const signingPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          const nonce = startNonce + i;
          
          const signTransaction = async () => {
            try {
              const txData = {
                account: embeddedWallet.address,
                to: config.contractAddress,
                data: '0xa2e62045',
                nonce,
                maxFeePerGas: gasParams.maxFeePerGas,
                maxPriorityFeePerGas: gasParams.maxPriorityFeePerGas,
                value: 0n,
                type: 'eip1559',
                gas: 100000n,
              };

              const signedTx = await walletClient.signTransaction(txData);
              
              return {
                signedTx,
                _reservedNonce: nonce,
                timestamp: Date.now()
              };
            } catch (error) {
              console.error(`Error signing extension transaction with nonce ${nonce}:`, error);
              return null;
            }
          };
          
          signingPromises.push(signTransaction());
        }
        
        // Ждем завершения всех транзакций в батче
        const batchResults = await Promise.all(signingPromises);
        
        // Добавляем успешно подписанные транзакции
        const successfulTxs = batchResults.filter(tx => tx !== null);
        tempTransactions.push(...successfulTxs);
        
        console.log(`Extended pool: signed batch ${Math.floor(batchStart / PARALLEL_BATCH_SIZE) + 1}/${Math.ceil(count / PARALLEL_BATCH_SIZE)} - total ${tempTransactions.length}/${count}`);
        
        // Если в батче были ошибки, прерываем процесс
        if (successfulTxs.length < batchSize) {
          console.warn(`⚠️ Only ${successfulTxs.length}/${batchSize} transactions signed in batch, stopping extension`);
          break;
        }
      }
      
      // Добавляем новые транзакции в основной пул
      if (pool && tempTransactions.length > 0) {
        pool.transactions.push(...tempTransactions);
        console.log(`Pool extended successfully. Total transactions: ${pool.transactions.length}`);
        
        // Обновляем nonce manager
        const manager = getNonceManager(chainId, embeddedWallet.address);
        if (manager) {
          manager.pendingNonce = Math.max(manager.pendingNonce || 0, startNonce + tempTransactions.length);
        }
        
        // ИСПРАВЛЕНИЕ: Сбрасываем флаг немедленно после успешного пополнения
        if (pool) {
          pool.hasTriggeredRefill = false;
          console.log(`✅ Pool refill completed and flag reset. Pool now has ${pool.transactions.length} total transactions`);
        }
      }
    } catch (error) {
      console.error('Error extending transaction pool:', error);
      // Не бросаем ошибку, просто логируем - игра может продолжаться в realtime режиме
    } finally {
      if (pool) {
        pool.isRefilling = false;
      }
    }
  };

  // МАТЕМАТИЧЕСКИ БЕСКОНЕЧНЫЙ пул pre-signed транзакций
  const getNextTransaction = async (chainId) => {
    const chainKey = chainId.toString();
    const pool = preSignedPool.current[chainKey];
    const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;

    // Если пул готов и есть предподписанные транзакции, используем их
    if (pool && pool.isReady && pool.transactions.length > pool.currentIndex) {
      const txWrapper = pool.transactions[pool.currentIndex];
      pool.currentIndex++;

      console.log(`🎯 Using pre-signed transaction ${pool.currentIndex}/${pool.transactions.length} (nonce: ${txWrapper._reservedNonce})`);
      
      // Диагностическая информация каждые 10 транзакций
      if (pool.currentIndex % 10 === 0) {
        const remainingTx = pool.transactions.length - pool.currentIndex;
        const utilizationPercent = (pool.currentIndex / pool.transactions.length * 100).toFixed(1);
        console.log(`📊 Pool utilization: ${utilizationPercent}% (${pool.currentIndex}/${pool.transactions.length}), ${remainingTx} remaining`);
      }

      // 🔄 ИСПРАВЛЕННОЕ ПРЕВЕНТИВНОЕ ПОПОЛНЕНИЕ - более частое и надежное
      // Пополняем каждые 5 транзакций для предотвращения исчерпания пула
      if (pool.currentIndex % 5 === 0 && pool.currentIndex > 0 && !pool.hasTriggeredRefill && !pool.isRefilling) {
        console.log(`🔄 FREQUENT refilling at ${pool.currentIndex} transactions used`);
        pool.hasTriggeredRefill = true;
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Немедленное синхронное пополнение
        (async () => {
          try {
            const embeddedWallet = getEmbeddedWallet();
            if (embeddedWallet) {
              // ИСПРАВЛЕНИЕ NONCE: Получаем актуальный nonce из сети
              const { publicClient } = await createClients(chainId);
              const currentNetworkNonce = await publicClient.getTransactionCount({
                address: embeddedWallet.address,
                blockTag: 'pending'
              });
              
              // Вычисляем следующий доступный nonce с учетом всех транзакций в пуле
              const lastUsedNonce = pool.baseNonce + pool.currentIndex - 1;
              const nextAvailableNonce = Math.max(currentNetworkNonce, lastUsedNonce + 1);
              
              console.log(`🎯 Refill nonce calculation: network=${currentNetworkNonce}, lastUsed=${lastUsedNonce}, nextAvailable=${nextAvailableNonce}`);
              
              // Увеличенный размер пополнения для предотвращения частых пополнений
              const usedCount = pool.currentIndex;
              const baseRefillSize = Math.max(50, poolConfig.batchSize * 3); // Увеличено в 3 раза
              const refillSize = usedCount > 50 ? Math.floor(baseRefillSize * 1.8) : baseRefillSize;
              
              console.log(`🚀 CRITICAL refill: adding ${refillSize} transactions from nonce ${nextAvailableNonce}`);
              console.log(`📊 Pool status before refill: ${pool.transactions.length - pool.currentIndex} remaining`);
              
              await extendPool(chainId, nextAvailableNonce, refillSize);
              
              // Обновляем nonce manager с правильными значениями
              const manager = getNonceManager(chainId, embeddedWallet.address);
              if (manager) {
                manager.currentNonce = nextAvailableNonce;
                manager.pendingNonce = nextAvailableNonce + refillSize;
                manager.lastUpdate = Date.now();
              }
            }
          } catch (error) {
            console.error('❌ Error in critical pool refill:', error);
            // В случае ошибки сбрасываем флаг НЕМЕДЛЕННО для повторной попытки
            pool.hasTriggeredRefill = false;
          }
        })();
      }
      
      // ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Экстренное пополнение при критически низком уровне
      const remainingTransactions = pool.transactions.length - pool.currentIndex;
      if (remainingTransactions <= 5 && !pool.hasTriggeredRefill && !pool.isRefilling) {
        console.warn(`🚨 CRITICAL: Only ${remainingTransactions} transactions left, emergency refill!`);
        pool.hasTriggeredRefill = true;
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Немедленное экстренное пополнение
        (async () => {
          try {
            const embeddedWallet = getEmbeddedWallet();
            if (embeddedWallet) {
              // Получаем актуальный nonce из сети для экстренного пополнения
              const { publicClient } = await createClients(chainId);
              const currentNetworkNonce = await publicClient.getTransactionCount({
                address: embeddedWallet.address,
                blockTag: 'pending'
              });
              
              const lastUsedNonce = pool.baseNonce + pool.currentIndex - 1;
              const nextAvailableNonce = Math.max(currentNetworkNonce, lastUsedNonce + 1);
              
              const emergencyRefillSize = Math.max(100, poolConfig.batchSize * 4); // Большой экстренный пул
              
              console.log(`🆘 EMERGENCY refill: adding ${emergencyRefillSize} transactions from nonce ${nextAvailableNonce}`);
              await extendPool(chainId, nextAvailableNonce, emergencyRefillSize);
              
              // Обновляем nonce manager
              const manager = getNonceManager(chainId, embeddedWallet.address);
              if (manager) {
                manager.currentNonce = nextAvailableNonce;
                manager.pendingNonce = nextAvailableNonce + emergencyRefillSize;
                manager.lastUpdate = Date.now();
              }
            }
          } catch (error) {
            console.error('❌ Emergency refill failed:', error);
            pool.hasTriggeredRefill = false;
          }
        })();
      }

      return txWrapper.signedTx;
    } else {
      // Детальное логирование для отладки
      if (!pool) {
        console.log(`❌ No transaction pool exists for chain ${chainId}`);
        throw new Error(`No pre-signed transaction pool available for chain ${chainId}. Only pre-signed transactions are allowed.`);
      } else if (!pool.isReady) {
        console.log(`⏳ Transaction pool not ready yet for chain ${chainId} (${pool.transactions.length} transactions in progress)`);
        throw new Error(`Pre-signed transaction pool not ready for chain ${chainId}. Wait for initialization to complete.`);
      } else if (pool.transactions.length <= pool.currentIndex) {
        console.log(`📭 Transaction pool empty for chain ${chainId} (used ${pool.currentIndex}/${pool.transactions.length})`);
        throw new Error(`Pre-signed transaction pool exhausted for chain ${chainId}. Only pre-signed transactions are allowed.`);
      }
    }

    // КРИТИЧЕСКАЯ СИТУАЦИЯ: пул транзакций пуст, но игра требует транзакцию
    // Пытаемся экстренно пополнить пул
    try {
      console.error('🚨 CRITICAL: Pre-signed pool empty! Attempting emergency refill...');
      const embeddedWallet = getEmbeddedWallet();
      if (embeddedWallet) {
        const manager = getNonceManager(chainId, embeddedWallet.address);
        const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
        
        // Экстренное пополнение с минимальным размером пакета
        const emergencyBatchSize = Math.min(5, poolConfig.batchSize);
        const nextNonce = manager.pendingNonce;
        
        console.log(`🚨 Emergency pre-signing ${emergencyBatchSize} transactions from nonce ${nextNonce}`);
        await preSignBatch(chainId, nextNonce, emergencyBatchSize);
        
        // Повторная попытка получить транзакцию
        const pool = preSignedPool.current[chainId.toString()];
        if (pool && pool.isReady && pool.transactions.length > pool.currentIndex) {
          const txWrapper = pool.transactions[pool.currentIndex];
          pool.currentIndex++;
          console.log(`✅ Emergency transaction obtained: ${pool.currentIndex}/${pool.transactions.length}`);
          return txWrapper.signedTx;
        }
      }
    } catch (emergencyError) {
      console.error('❌ Emergency refill failed:', emergencyError);
    }
    
    // REALTIME ТРАНЗАКЦИИ ОТКЛЮЧЕНЫ - используем только pre-signed
    throw new Error('CRITICAL ERROR: Pre-signed transaction pool exhausted and emergency refill failed. Only pre-signed transactions are allowed in this game.');
  };

  // ОТКЛЮЧЕНО: создание и подписание транзакции в реальном времени
  // В игре используются ТОЛЬКО pre-signed транзакции
  const createRealtimeTransaction = async (chainId) => {
    throw new Error('Realtime transaction creation is disabled. Only pre-signed transactions are allowed in this game.');
  };

  // МОНИТОРИНГ БЕСКОНЕЧНОГО ПУЛА pre-signed транзакций
  const startPoolMonitoring = (chainId) => {
    const chainKey = chainId.toString();
    
    const monitorInterval = setInterval(() => {
      const pool = preSignedPool.current[chainKey];
      if (!pool || !pool.isReady) return;
      
      const remainingTx = pool.transactions.length - pool.currentIndex;
      const totalTx = pool.transactions.length;
      const consumedTx = pool.currentIndex;
      
      // 📊 Статистика бесконечного пула
      const cyclesCompleted = Math.floor(consumedTx / 5);
      const netGrowth = cyclesCompleted * 10; // +10 транзакций каждый цикл
      const predictedGrowth = totalTx + netGrowth;
      
      // УЛУЧШЕННЫЕ информационные логи каждые 5 транзакций для раннего выявления проблем
      if (consumedTx % 5 === 0 && consumedTx > 0) {
        const performanceGrade = remainingTx > 30 ? '🚀 EXCELLENT' : 
                               remainingTx > 20 ? '✅ GOOD' : 
                               remainingTx > 10 ? '⚠️ WARNING' : '🚨 CRITICAL';
                               
        console.log(`📊 Enhanced Pool Stats for chain ${chainId} (Jump #${consumedTx}):`);
        console.log(`  • Consumed: ${consumedTx} transactions`);
        console.log(`  • Remaining: ${remainingTx} transactions`);
        console.log(`  • Total pool size: ${totalTx} transactions`);
        console.log(`  • Pool health: ${performanceGrade}`);
        console.log(`  • Refill status: ${pool.isRefilling ? '🔄 ACTIVE' : '⏸️ IDLE'}`);
        console.log(`  • Last refill triggered: ${pool.hasTriggeredRefill ? '✅ YES' : '❌ NO'}`);
        
        // Специальное предупреждение для проблемной зоны 15-25 прыжков
        if (consumedTx >= 15 && consumedTx <= 25) {
          console.warn(`⚠️ CRITICAL ZONE: Jump ${consumedTx}/20+ - monitoring for slowdown issues`);
          if (remainingTx < 15) {
            console.error(`🚨 DANGER: Only ${remainingTx} transactions left at jump ${consumedTx}! This causes 5s delays!`);
          }
        }
      }
      
      // Проверка математической корректности бесконечного пула
      if (remainingTx <= 3 && !pool.isRefilling) {
        console.error(`🚨 INFINITE POOL VIOLATION: Only ${remainingTx} transactions left!`);
        console.error(`  • This should never happen with infinite pool logic`);
        console.error(`  • Consumed: ${consumedTx}, Total: ${totalTx}, Cycles: ${cyclesCompleted}`);
        
        // Экстренное пополнение с большим батчем
        if (!pool.hasTriggeredRefill) {
          pool.hasTriggeredRefill = true;
          console.log('🚨 EMERGENCY: Force-refilling infinite pool...');
          
          setTimeout(async () => {
            try {
              const embeddedWallet = getEmbeddedWallet();
              if (embeddedWallet) {
                const manager = getNonceManager(chainId, embeddedWallet.address);
                // Большой экстренный батч для восстановления бесконечности
                await extendPool(chainId, manager.pendingNonce, 25);
              }
            } catch (error) {
              console.error('❌ Emergency infinite pool refill failed:', error);
            }
          }, 0);
        }
      }
      
      // Предупреждение если нормальный механизм не работает
      if (remainingTx <= 8 && consumedTx > 10) {
        console.warn(`⚠️ INFINITE POOL: Low remaining transactions (${remainingTx}) - check refill mechanism`);
      }
      
    }, 3000); // Проверка каждые 3 секунды (реже для бесконечного пула)
    
    console.log(`👁️ Started INFINITE pool monitoring for chain ${chainId}`);
    console.log(`📊 Pool will grow by +10 transactions every 5 consumed (mathematical infinity)`);
    return monitorInterval;
  };

  // Проверка баланса
  const checkBalance = async (chainId) => {
    try {
      const { publicClient } = await createClients(chainId);
      const embeddedWallet = getEmbeddedWallet();
      
      if (!embeddedWallet) {
        console.error('No embedded wallet available for balance check');
        return '0';
      }
      
      const balance = await publicClient.getBalance({
        address: embeddedWallet.address
      });
      
      const balanceEth = (Number(balance) / 10**18).toFixed(4);
      setBalance(balanceEth);
      console.log(`Balance for ${embeddedWallet.address}: ${balanceEth} ETH`);
      return balanceEth;
    } catch (error) {
      console.error('Error checking balance:', error);
      // Return 0 balance and let the system continue
      setBalance('0');
      return '0';
    }
  };

  // Автоматическое обновление баланса
  const startBalanceAutoUpdate = (chainId) => {
    if (!chainId) return;
    
    console.log('🔄 Starting automatic balance updates for chain:', chainId);
    
    // Очищаем предыдущий интервал
    if (balanceUpdateInterval.current) {
      clearInterval(balanceUpdateInterval.current);
    }
    
    // Обновляем баланс каждые 10 секунд
    balanceUpdateInterval.current = setInterval(async () => {
      try {
        await checkBalance(chainId);
      } catch (error) {
        console.warn('Auto balance update failed:', error);
      }
    }, 10000); // 10 секунд
  };

  // Остановка автоматического обновления баланса
  const stopBalanceAutoUpdate = () => {
    if (balanceUpdateInterval.current) {
      clearInterval(balanceUpdateInterval.current);
      balanceUpdateInterval.current = null;
      console.log('🛑 Stopped automatic balance updates');
    }
  };

  // РЕВОЛЮЦИОННЫЙ вызов faucet с кешированием и умной обработкой
  const callFaucet = async (address, chainId) => {
    const cacheKey = `faucet_${chainId}_${address}`;
    const FAUCET_COOLDOWN = 5 * 60 * 1000; // 5 минут между вызовами
    
    try {
      // Проверяем кеш последнего вызова faucet
      const lastFaucetCall = localStorage.getItem(cacheKey);
      if (lastFaucetCall) {
        const timeSinceLastCall = Date.now() - parseInt(lastFaucetCall);
        if (timeSinceLastCall < FAUCET_COOLDOWN) {
          const remainingTime = Math.ceil((FAUCET_COOLDOWN - timeSinceLastCall) / 1000);
          console.log(`⏱️ Faucet cooldown: ${remainingTime}s remaining`);
          throw new Error(`Faucet is on cooldown. Try again in ${remainingTime} seconds.`);
        }
      }
      
      console.log('💰 Calling optimized faucet for address:', address);
      console.log('🌐 Chain ID:', chainId);
      
      // Проверяем, что адрес принадлежит embedded wallet
      const embeddedWallet = getEmbeddedWallet();
      const isEmbeddedWallet = embeddedWallet && embeddedWallet.address === address;
      if (!isEmbeddedWallet) {
        throw new Error('Faucet target must be the embedded wallet. Please wait for wallet to initialize.');
      }
      
      console.log('🔍 Faucet target address check:', {
        address,
        isEmbeddedWallet,
        embeddedWalletAddress: embeddedWallet?.address,
        walletType: embeddedWallet?.walletClientType || embeddedWallet?.connectorType || embeddedWallet?.type
      });
      
      // Создаем контроллер для timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      // Определяем базовый URL для API
      const apiUrl = window.location.hostname === 'localhost' 
        ? '/api/faucet'
        : `${window.location.origin}/api/faucet`;
      
      console.log('📡 Faucet API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          address, 
          chainId,
          timestamp: Date.now(), // Добавляем timestamp для предотвращения кеширования
          clientVersion: '1.0',   // Версия клиента для аналитики
          force: true             // Принудительно отправить, даже если баланс уже достаточный
        }),
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = 'Faucet request failed';
        try {
          const text = await response.text();
          let errorData = {};
          try { errorData = JSON.parse(text); } catch (_) {}
          errorMessage = errorData.error || errorMessage;
          
          // Специальная обработка известных ошибок
          if (errorData.code === 'INSUFFICIENT_BALANCE') {
            errorMessage = 'Faucet is temporarily empty. Please try again later.';
          } else if (errorData.code === 'RATE_LIMIT') {
            const retryAfter = errorData.retryAfter || 300;
            errorMessage = `Rate limit exceeded. Try again in ${retryAfter} seconds.`;
          } else if (errorData.code === 'ALREADY_SUFFICIENT') {
            // Если баланс уже достаточный, это не ошибка
            console.log('💰 Balance already sufficient, skipping faucet');
            return { 
              success: true, 
              message: 'Sufficient balance already available',
              skipped: true
            };
          }
        } catch (parseError) {
          console.error('Failed to parse faucet error response:', parseError);
          
          // Обработка HTTP статусов
          if (response.status === 429) {
            errorMessage = 'Too many requests. Please wait a few minutes and try again.';
          } else if (response.status === 503) {
            errorMessage = 'Faucet service is temporarily unavailable. Please try again later.';
          } else {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const text = await response.text();
      let result = {};
      try { result = JSON.parse(text); } catch (_) {}
      if (!result || !result.success) {
        console.warn('Faucet responded without success flag:', text);
      }
      
      // Сохраняем время последнего успешного вызова
      if (result && result.success) {
        localStorage.setItem(cacheKey, Date.now().toString());
      }
      
      console.log('💰 Faucet success:', result);
      
      // Если faucet возвращает txHash, ждем немного и обновляем баланс
      if (result.txHash) {
        console.log('⏳ Waiting for faucet transaction to be processed...');
        
        // Асинхронно обновляем баланс через 3 секунды
        setTimeout(async () => {
          try {
            await checkBalance(chainId);
            console.log('✅ Balance updated after faucet transaction');
          } catch (error) {
            console.warn('Failed to update balance after faucet:', error);
          }
        }, 3000);
      }
      
      return {
        success: true,
        ...result,
        timestamp: Date.now(),
        isEmbeddedWallet
      };
      
    } catch (error) {
      console.error('❌ Faucet error:', error);
      
      // Обработка timeout ошибок
      if (error.name === 'AbortError') {
        throw new Error('Faucet request timed out. Please check your connection and try again.');
      }
      
      // Обработка сетевых ошибок
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      
      // Если ошибка уже обработана выше, просто пробрасываем
      if (error.message.includes('cooldown') || 
          error.message.includes('Rate limit') || 
          error.message.includes('temporarily unavailable')) {
        throw error;
      }
      
      // Для неизвестных ошибок добавляем контекст
      throw new Error(`Faucet error: ${error.message}`);
    }
  };

  // РЕВОЛЮЦИОННАЯ отправка транзакции с оптимизированными RPC методами для каждой сети
  const sendRawTransaction = async (chainId, signedTx) => {
    const config = NETWORK_CONFIGS[chainId];
    const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
    
    // Получаем здоровый RPC endpoint для отправки
    const rpcUrl = await getHealthyRpcEndpoint(chainId);
    const startTime = Date.now();
    let success = false;
    
    try {
      let response;
      let txHash;
      
      if (config.sendMethod === 'realtime_sendRawTransaction') {
        // 🚀 MegaETH реалтайм метод - МАКСИМАЛЬНАЯ ОПТИМИЗАЦИЯ
        console.log('🚀 Using MegaETH realtime_sendRawTransaction for instant execution...');
        
        const sendMegaETHTransaction = async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), config.connectionTimeouts.request);
          
          try {
            // ИСПРАВЛЕНО: убираем заголовки, вызывающие CORS preflight
            const response = await fetch(rpcUrl, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json'
                // Убрали все дополнительные заголовки для избежания CORS
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'realtime_sendRawTransaction',
                params: [signedTx],
                id: Date.now()
              }),
              signal: controller.signal,
              mode: 'cors' // Явно указываем CORS режим
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const jsonResponse = await response.text();
            const parsedResponse = safeJsonParse(jsonResponse);
            
            if (!parsedResponse) {
              throw new Error('Invalid response format from MegaETH RPC');
            }

            // Специальная обработка MegaETH ответов
            if (parsedResponse.error) {
              // Обработка специфичных ошибок MegaETH
              if (parsedResponse.error.message?.includes('nonce too low')) {
                console.log('🔄 MegaETH nonce too low, triggering refresh');
                throw new Error('nonce too low');
              } else if (parsedResponse.error.message?.includes('rate limit')) {
                console.log('⏱️ MegaETH rate limit hit, will retry');
                throw new Error('rate limit exceeded');
              } else if (parsedResponse.error.message?.includes('already known')) {
                console.log('🔄 Transaction already known by network - likely duplicate, treating as success');
                // Для "already known" ошибок, мы считаем транзакцию успешной
                // поскольку она уже была отправлена ранее
                return {
                  result: {
                    transactionHash: 'duplicate_tx_' + Date.now(),
                    status: '0x1',
                    gasUsed: '0x66f9', 
                    blockNumber: '0x' + Date.now().toString(16),
                    from: parsedResponse.error.data?.from || '0x0',
                    to: parsedResponse.error.data?.to || '0x0'
                  }
                };
              }
              throw new Error(`MegaETH RPC Error: ${parsedResponse.error.message}`);
            }

            return parsedResponse;
          } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new Error('MegaETH RPC timeout - real-time deadline exceeded');
            }
            throw error;
          }
        };

        // Специальная retry логика для MegaETH с быстрыми интервалами
        response = await retryWithBackoff(
          sendMegaETHTransaction, 
          poolConfig.maxRetries, 
          100, // Очень быстрый retry для real-time
          chainId
        );
        
        if (response.error) {
          throw new Error(`MegaETH Real-time Error: ${response.error.message}`);
        }
        
        txHash = response.result;
        console.log('⚡ MegaETH instant transaction hash:', txHash);
        success = true;
        
        // Для MegaETH realtime метод возвращает мгновенное подтверждение
        return { 
          hash: txHash, 
          receipt: response.result,
          isInstant: true, // Флаг мгновенной обработки
          network: 'MegaETH'
        };
        
      } else if (config.sendMethod === 'eth_sendRawTransactionSync') {
        // 📦 RISE синхронный метод с оптимизацией
        console.log('📦 Using RISE eth_sendRawTransactionSync for fast execution...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.connectionTimeouts.retry);
        
        try {
          response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_sendRawTransactionSync',
              params: [signedTx],
              id: Date.now()
            }),
            signal: controller.signal,
            mode: 'cors'
          });

          clearTimeout(timeoutId);
          
          const jsonResponse = await response.text();
          const result = safeJsonParse(jsonResponse);
          
          if (!result) {
            throw new Error('Invalid response format from RISE RPC');
          }
          
          if (result.error) {
            if (result.error.message?.includes('nonce too low')) {
              console.log('🔄 RISE nonce too low detected');
              throw new Error('nonce too low');
            }
            throw new Error(result.error.message || 'RISE transaction failed');
          }

          success = true;
          return { 
            hash: result.result, 
            receipt: result.result,
            isInstant: true,
            network: 'RISE'
          };
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error('RISE RPC timeout');
          }
          throw error;
        }
        
      } else {
        // 🔗 Стандартная отправка с улучшенной обработкой
        console.log('🔗 Using standard eth_sendRawTransaction...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.connectionTimeouts.retry);
        
        try {
          response = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_sendRawTransaction',
              params: [signedTx],
              id: Date.now()
            }),
            signal: controller.signal,
            mode: 'cors'
          });

          clearTimeout(timeoutId);
          
          const jsonResponse = await response.text();
          const result = safeJsonParse(jsonResponse);
          
          if (!result) {
            throw new Error('Invalid response format from RPC');
          }
          
          if (result.error) {
            if (result.error.message?.includes('nonce too low')) {
              console.log('🔄 Standard RPC nonce too low detected');
              throw new Error('nonce too low');
            }
            throw new Error(result.error.message || 'Transaction failed');
          }

          success = true;
          return { 
            hash: result.result,
            isInstant: false,
            network: config.name
          };
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error('Standard RPC timeout');
          }
          throw error;
        }
      }
    } catch (error) {
      console.error('❌ Send transaction error:', error);
      
      // Специальная обработка ошибок nonce для всех сетей
      if (error.message?.includes('nonce too low')) {
        const embeddedWallet = getEmbeddedWallet();
        if (embeddedWallet) {
          console.log('🔄 Refreshing nonce due to "nonce too low" error');
          try {
            // Принудительно обновляем nonce с сети
            await getNextNonce(chainId, embeddedWallet.address, true);
            
            // Очищаем пул предподписанных транзакций, так как они теперь имеют неверные nonces
            const chainKey = chainId.toString();
            const pool = preSignedPool.current[chainKey];
            if (pool) {
              console.log('🗑️ Clearing invalid pre-signed transaction pool');
              pool.transactions = [];
              pool.currentIndex = 0;
              pool.isReady = false;
              pool.hasTriggeredRefill = false;
              
              // Запускаем пересоздание пула в фоне с правильным nonce
              setTimeout(async () => {
                try {
                  // Принудительно получаем актуальный nonce из сети
                  const { publicClient } = await createClients(chainId);
                  const actualNonce = await publicClient.getTransactionCount({
                    address: embeddedWallet.address,
                    blockTag: 'pending'
                  });
                  
                  console.log(`🔄 Recreating pool with actual network nonce: ${actualNonce}`);
                  
                  // Обновляем менеджер nonce
                  const manager = getNonceManager(chainId, embeddedWallet.address);
                  manager.currentNonce = actualNonce;
                  manager.pendingNonce = actualNonce;
                  manager.lastUpdate = Date.now();
                  
                  // Пересоздаем пул с правильным nonce
                  const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
                  await preSignBatch(chainId, actualNonce, poolConfig.batchSize);
                  console.log(`✅ Pre-signed transaction pool recreated with correct nonces starting from ${actualNonce}`);
                } catch (recreateError) {
                  console.error('❌ Failed to recreate transaction pool:', recreateError);
                }
              }, 100);
            }
          } catch (nonceError) {
            console.error('Failed to refresh nonce:', nonceError);
          }
        }
      }
      
      throw error;
    } finally {
      // Обновляем статус здоровья RPC endpoint
      const responseTime = Date.now() - startTime;
      updateRpcHealth(chainId, rpcUrl, success, responseTime);
      
      // Логируем производительность
      if (success) {
        console.log(`✅ Transaction sent successfully in ${responseTime}ms via ${config.sendMethod}`);
      }
    }
  };

  // РЕВОЛЮЦИОННЫЙ основной метод отправки обновления с Real-Time Gaming архитектурой
  const sendUpdate = async (chainId) => {
    const embeddedWallet = getEmbeddedWallet();
    if (!embeddedWallet) {
      throw new Error('No embedded wallet available');
    }

    // Для MegaETH (instant transactions) менее строгая проверка pending состояния
    if (chainId === 6342) {
      // Проверяем есть ли доступные pre-signed транзакции
      const chainKey = chainId.toString();
      const pool = preSignedPool.current[chainKey];
      const hasPreSignedTx = pool && pool.isReady && pool.transactions.length > pool.currentIndex;
      
      if (hasPreSignedTx) {
        // Если есть pre-signed транзакции, разрешаем много параллельных операций
        if (transactionPendingCount.current > 10) {
          console.log('🚫 Maximum MegaETH throughput reached, throttling');
          throw new Error('Transaction throughput limit reached');
        }
      } else {
        // Если нет pre-signed, более строгий лимит
        if (transactionPendingCount.current > 2) {
          console.log('🚫 Too many concurrent realtime transactions');
          throw new Error('Realtime transaction limit reached');
        }
      }
    } else {
      // Для других сетей сохраняем строгую блокировку
      if (transactionPending) {
        throw new Error('Transaction already pending, blocking jump');
      }
    }

    // Инициализируем мониторинг производительности
    const performanceMetrics = initPerformanceMonitoring(chainId);
    const startTime = performance.now(); // Точное измерение времени блокчейна

    const config = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
    
    // Проверяем, можем ли использовать burst режим
    if (config.burstMode && canExecuteBurst(chainId)) {
      console.log('🚀 Using burst mode for transaction');
      return await queueBurstTransaction(chainId, async () => {
        return await executeTransaction(chainId, startTime);
      });
    } else {
      return await executeTransaction(chainId, startTime);
    }
  };

  // Отдельная функция для выполнения транзакции с измерением производительности
  const executeTransaction = async (chainId, startTime) => {
    let signedTx = null;
    let blockchainTime = 0;
    let success = false;
    
    try {
      // Для MegaETH не блокируем глобально - используем только счетчик
      if (chainId !== 6342) {
        setTransactionPending(true);
      }
      transactionPendingCount.current++;
      
      // Получаем предподписанную транзакцию или создаем новую
      signedTx = await getNextTransaction(chainId);
      
      if (!signedTx) {
        throw new Error('Failed to get transaction for sending');
      }
      
      console.log('⚡ Sending instant on-chain jump transaction...');
      
      // Отправляем транзакцию с улучшенной обработкой ошибок
      const txResult = await sendRawTransaction(chainId, signedTx);
      console.log('📡 Transaction sent:', txResult);

      const config = NETWORK_CONFIGS[chainId];
      let finalResult = txResult;
      
      // Обработка подтверждения в зависимости от сети
      if (config.sendMethod === 'realtime_sendRawTransaction') {
        // MegaETH: realtime метод уже возвращает подтверждение
        console.log('✅ MegaETH instant confirmation:', txResult);
        finalResult = txResult.receipt || txResult;
        success = true;
        
      } else if (config.sendMethod === 'eth_sendRawTransactionSync') {
        // RISE: синхронный метод уже подтвержден
        console.log('✅ RISE sync confirmation:', txResult);
        finalResult = txResult.receipt || txResult;
        success = true;
        
      } else {
        // Стандартные сети: ждём подтверждения с таймаутом
        console.log('⏳ Waiting for transaction confirmation...');
        try {
          const { publicClient } = await createClients(chainId);
          const receipt = await Promise.race([
            publicClient.waitForTransactionReceipt({ 
              hash: txResult.hash,
              timeout: 30000 // 30 seconds timeout
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Transaction confirmation timeout')), 35000)
            )
          ]);
          console.log('✅ Transaction confirmed:', receipt);
          finalResult = receipt;
          success = true;
        } catch (confirmError) {
          console.warn('⚠️ Transaction confirmation failed, but transaction may still be valid:', confirmError);
          // Не бросаем ошибку - транзакция может быть валидной, просто подтверждение не получили
          finalResult = txResult;
          success = true; // Считаем успешной если отправлена
        }
      }

      // Рассчитываем время блокчейна для Real-Time Gaming метрик
      blockchainTime = performance.now() - startTime;
      
      console.log(`🎮 Jump transaction completed in ${Math.round(blockchainTime)}ms:`, finalResult);
      
      // Записываем метрики производительности
      const metrics = recordPerformanceMetric(chainId, blockchainTime, success);
      console.log(`📊 Performance: Avg ${Math.round(metrics.averageBlockchainTime)}ms, Success Rate ${metrics.successRate.toFixed(1)}%`);
      
      // Возвращаем результат с метриками для интеграции в игру
      return {
        ...finalResult,
        blockchainTime: Math.round(blockchainTime),
        reactionTime: 0, // Будет заполнено игрой
        performanceMetrics: {
          averageBlockchainTime: Math.round(metrics.averageBlockchainTime),
          successRate: metrics.successRate,
          totalTransactions: metrics.totalTransactions
        }
      };
      
    } catch (error) {
      console.error('❌ Error sending on-chain movement:', error);
      
      // Записываем неудачную метрику
      blockchainTime = performance.now() - startTime;
      recordPerformanceMetric(chainId, blockchainTime, false);
      
      // Обработка специфичных ошибок для улучшения UX
      if (error.message?.includes('nonce too low')) {
        console.log('🔄 Nonce too low detected, refreshing nonce and retrying...');
        try {
          // Получаем кошелек и обновляем nonce принудительно
          const wallet = getEmbeddedWallet();
          if (wallet) {
            await getNextNonce(chainId, wallet.address, true);
            
            // Очищаем пул предподписанных транзакций
            const chainKey = chainId.toString();
            const pool = preSignedPool.current[chainKey];
            if (pool) {
              console.log('🗑️ Clearing invalid pre-signed transaction pool due to nonce error');
              pool.transactions = [];
              pool.currentIndex = 0;
              pool.isReady = false;
              pool.hasTriggeredRefill = false;
            }
            
            console.log('✅ Nonce refreshed, please try again');
          } else {
            console.error('❌ No wallet available for nonce refresh');
          }
        } catch (nonceError) {
          console.error('❌ Failed to refresh nonce:', nonceError);
        }
      } else if (error.message?.includes('context deadline exceeded')) {
        console.log('⏰ Network timeout detected, transaction may still be processing...');
      } else if (error.message?.includes('insufficient funds')) {
        console.log('💰 Insufficient funds detected, consider calling faucet...');
      }
      
      throw new Error(`Blockchain transaction error: ${error.message}`);
    } finally {
      if (chainId !== 6342) {
        setTransactionPending(false);
      }
      transactionPendingCount.current = Math.max(0, transactionPendingCount.current - 1);
    }
  };

  // РЕВОЛЮЦИОННАЯ неблокирующая инициализация данных для instant gaming
  const initData = async (chainId) => {
    const chainKey = chainId.toString();
    if (isInitialized.current[chainKey] || isInitializing) {
      return;
    }

    try {
      setIsInitializing(true);
      console.log('🚀 Starting instant blockchain initialization for chain:', chainId);

      // Wait for embedded wallet to be created (with retry)
      let embeddedWallet = null;
      let retries = 0;
      const maxRetries = 10;
      
      while (!embeddedWallet && retries < maxRetries) {
        embeddedWallet = getEmbeddedWallet();
        if (!embeddedWallet) {

          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
      }

      if (!embeddedWallet) {
        throw new Error('No embedded wallet available');
      }



      // Для Privy embedded wallets пропускаем переключение сети
      // Используем логику bypass для избежания ошибок Privy
      if (embeddedWallet.walletClientType === 'privy') {
        console.log('⚡ INSTANT GAMING MODE ENABLED - игра готова!');
        // Сразу переходим к инициализации без переключения сети
      }

      // Получаем кешированные параметры сети (минимизируем RPC вызовы)
      await getCachedChainParams(chainId);

      // УЛУЧШЕННАЯ инициализация nonce manager
      const nonceManager = getNonceManager(chainId, embeddedWallet.address);
      
      // ПАРАЛЛЕЛЬНАЯ инициализация - не блокируем игру!
      const initializationPromises = [];
      
      // 1. Проверяем баланс и получаем начальный nonce
      const balanceAndNoncePromise = Promise.all([
        checkBalance(chainId),
        retryWithBackoff(async () => {
          const { publicClient } = await createClients(chainId);
          return await publicClient.getTransactionCount({
            address: embeddedWallet.address,
            blockTag: 'pending'
          });
        }, 3, 1000, chainId)
      ]).then(([currentBalance, initialNonce]) => {
        // Инициализируем nonce manager с текущим nonce
        nonceManager.currentNonce = initialNonce;
        nonceManager.pendingNonce = initialNonce;
        nonceManager.lastUpdate = Date.now();

        console.log('💰 Current balance:', currentBalance);
        console.log('🎯 Starting nonce:', initialNonce);

        // Если баланс меньше 0.00005 ETH, вызываем faucet АСИНХРОННО
        if (parseFloat(currentBalance) < 0.00005) {
          console.log(`💰 Balance is ${currentBalance} ETH (< 0.00005), calling faucet in background...`);
          
                // Получаем правильный embedded wallet для faucet
      const faucetWallet = getEmbeddedWallet();
      if (!faucetWallet) {
        console.warn('⚠️ No embedded wallet available for faucet, deferring until available');
        return { currentBalance, initialNonce };
      }
      
      console.log('🎯 Using embedded wallet for faucet:', faucetWallet.address);
      
      // НЕБЛОКИРУЮЩИЙ faucet вызов (строго на embedded wallet)
      callFaucet(faucetWallet.address, chainId)
            .then(async (result) => {
              console.log('✅ Background faucet completed:', result);

              // Wait for transaction to be confirmed before updating balance
              if (result.txHash || result.transactionHash) {
                console.log('🎯 Automatic faucet transaction confirmed, updating balance...');

                // Wait just 1 second since chains are fast
                setTimeout(async () => {
                  await checkBalance(chainId);
                }, 1000);
              } else {
                console.warn('⚠️ No transaction hash from automatic faucet, balance may not update');
              }

              // Обновляем nonce после faucet
              return getNextNonce(chainId, faucetWallet.address, true);
            })
            .catch(faucetError => {
              console.warn('⚠️ Background faucet failed (non-blocking):', faucetError);
            });
        }
        
        return { currentBalance, initialNonce };
      });
      
      initializationPromises.push(balanceAndNoncePromise);

      // 2. НЕМЕДЛЕННО помечаем как инициализированный для instant gaming
      isInitialized.current[chainKey] = true;
      console.log('⚡ INSTANT GAMING MODE ENABLED - игра готова!');
      
      // 3. Pre-signing в ФОНОВОМ режиме (не блокируем игру)
      const poolConfig = ENHANCED_POOL_CONFIG[chainId] || ENHANCED_POOL_CONFIG.default;
      const fallbackConfig = getFallbackConfig(chainId);
      
      let batchSize = poolConfig.poolSize;
      if (fallbackConfig) {
        batchSize = fallbackConfig.reducedBatchSize;
        console.log(`Using fallback batch size: ${batchSize}`);
      }
      
      // ФОНОВОЕ предподписание
      const preSigningPromise = balanceAndNoncePromise.then(({ initialNonce }) => {
        console.log(`🔄 Background pre-signing ${batchSize} transactions starting from nonce ${initialNonce}`);
        
        // Резервируем nonces для pre-signing
        const manager = getNonceManager(chainId, embeddedWallet.address);
        if (manager) {
          manager.pendingNonce = Math.max(manager.pendingNonce || initialNonce, initialNonce + batchSize);
        }
        
        return preSignBatch(chainId, initialNonce, batchSize)
          .then(() => {
            const pool = preSignedPool.current[chainKey];
            if (pool && pool.transactions.length > 0) {
              console.log(`✅ Background pre-signed ${pool.transactions.length} transactions - performance boost ready!`);
            } else {
              console.log('⚠️ Pre-signing completed with 0 transactions - using realtime mode');
            }
          })
          .catch(error => {
            console.warn('⚠️ Background pre-signing failed (non-blocking):', error);
            enableFallbackMode(chainId);
            console.log('🔄 Enabled realtime fallback mode - game continues smoothly');
          });
      });
      
      // НЕ ДОБАВЛЯЕМ pre-signing в критический путь инициализации
      // Это позволяет игре начаться сразу, а pre-signing работает в фоне
      // initializationPromises.push(preSigningPromise);
      
             // Запускаем pre-signing в фоне
       preSigningPromise.catch(error => {
         console.warn('Background pre-signing error (non-critical):', error);
       });
      
      // Ждем только базовую инициализацию (баланс + nonce)
      await balanceAndNoncePromise;
      
      // Запускаем автоматическое обновление баланса
      startBalanceAutoUpdate(chainId);
      
      console.log('🎮 Blockchain ready for instant gaming on chain:', chainId);
      
      if (fallbackConfig) {
        console.log('⚠️ Running in fallback mode - reduced performance expected');
      } else {
        console.log('🚀 Full performance mode activating in background...');
      }
      
      // Остальные задачи выполняются в фоне
      Promise.all(initializationPromises.slice(1)).then(() => {
        console.log('✅ Full blockchain optimization complete');
      }).catch(error => {
        console.warn('⚠️ Some background optimizations failed (non-critical):', error);
      });
      
    } catch (error) {
      console.error('❌ Critical initialization error:', error);
      // Даже при ошибке, позволяем игре работать в fallback режиме
      isInitialized.current[chainKey] = true;
      enableFallbackMode(chainId);
      console.log('🔄 Emergency fallback mode enabled - game will work with realtime signing');
    } finally {
      setIsInitializing(false);
    }
  };

  // Получение текущего номера из контракта
  const getContractNumber = async (chainId) => {
    try {
      const { publicClient, config } = await createClients(chainId);
      
      const number = await publicClient.readContract({
        address: config.contractAddress,
        abi: UPDATER_ABI,
        functionName: 'number'
      });

      setContractNumber(Number(number));
      return Number(number);
    } catch (error) {
      console.error('Error reading contract number:', error);
      return 0;
    }
  };

  // ЗНАЧИТЕЛЬНО УЛУЧШЕННАЯ retry функция с circuit breaker и умной обработкой ошибок
  const circuitBreakers = useRef({});
  const balanceUpdateInterval = useRef(null);

  const getCircuitBreaker = (chainId) => {
    if (!circuitBreakers.current[chainId]) {
      circuitBreakers.current[chainId] = {
        failures: 0,
        lastFailureTime: 0,
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        threshold: 5, // Открываем circuit после 5 неудач
        timeout: 60000 // 60 секунд до попытки перехода в HALF_OPEN
      };
    }
    return circuitBreakers.current[chainId];
  };

  const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000, chainId = null) => {
    let lastError;
    let circuitBreaker = null;
    
    // Используем circuit breaker если указан chainId
    if (chainId) {
      circuitBreaker = getCircuitBreaker(chainId);
      
      // Проверяем состояние circuit breaker
      if (circuitBreaker.state === 'OPEN') {
        const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure < circuitBreaker.timeout) {
          throw new Error(`Circuit breaker is OPEN for chain ${chainId}. Try again in ${Math.round((circuitBreaker.timeout - timeSinceLastFailure) / 1000)} seconds.`);
        } else {
          // Переходим в состояние HALF_OPEN для тестирования
          circuitBreaker.state = 'HALF_OPEN';
          console.log(`Circuit breaker for chain ${chainId} entering HALF_OPEN state`);
        }
      }
    }
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const result = await fn();
        
        // Успех - сбрасываем circuit breaker
        if (circuitBreaker) {
          circuitBreaker.failures = 0;
          circuitBreaker.state = 'CLOSED';
        }
        
        return result;
      } catch (error) {
        lastError = error;
        const isLastRetry = i === maxRetries - 1;
        
        // Обновляем circuit breaker при ошибке
        if (circuitBreaker) {
          circuitBreaker.failures++;
          circuitBreaker.lastFailureTime = Date.now();
          
          // Переводим в OPEN состояние если превышен порог
          if (circuitBreaker.failures >= circuitBreaker.threshold) {
            circuitBreaker.state = 'OPEN';
            console.warn(`Circuit breaker OPENED for chain ${chainId} after ${circuitBreaker.failures} failures`);
          }
        }
        
        // Проверяем, стоит ли повторять попытку
        const isRetryableError = 
          error.status === 429 || // Too Many Requests
          error.status === 403 || // Forbidden (может быть временно)
          error.status === 500 || // Internal Server Error
          error.status === 502 || // Bad Gateway
          error.status === 503 || // Service Unavailable
          error.status === 504 || // Gateway Timeout
          error.message?.includes('rate limit') ||
          error.message?.includes('timeout') ||
          error.message?.includes('context deadline exceeded') ||
          error.message?.includes('connection') ||
          error.message?.includes('network') ||
          error.message?.includes('fetch') ||
          error.name === 'AbortError' ||
          error.name === 'TypeError'; // Network errors

        // Специальные ошибки, которые не стоит повторять
        const isNonRetryableError = 
          error.message?.includes('nonce too low') ||
          error.message?.includes('insufficient funds') ||
          error.message?.includes('gas too low') ||
          error.message?.includes('invalid signature') ||
          error.message?.includes('execution reverted');

        if (isLastRetry || isNonRetryableError || !isRetryableError) {
          if (isNonRetryableError) {
            console.log(`Non-retryable error encountered: ${error.message}`);
          }
          throw error;
        }

        // Circuit breaker может заставить нас остановиться раньше
        if (circuitBreaker && circuitBreaker.state === 'OPEN') {
          console.log(`Circuit breaker is OPEN, stopping retries for chain ${chainId}`);
          break;
        }

        // Exponential backoff с jitter для избежания thundering herd
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay * Math.pow(2, i) + jitter, 30000); // Максимум 30 секунд
        
        console.log(`Retry attempt ${i + 1}/${maxRetries} after ${Math.round(delay)}ms delay due to:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  };

  // Debug утилиты для мониторинга (только в development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      window.blockchainDebug = {
        getRPCHealth: (chainId) => rpcHealthStatus.current[chainId],
        getCircuitBreaker: (chainId) => circuitBreakers.current[chainId],
        getTransactionPool: (chainId) => preSignedPool.current[chainId],
        getBurstState: (chainId) => burstState.current[chainId],
        getConnectionPool: () => activeConnections.current,
        getNonceManager: (chainId, address) => nonceManager.current[`${chainId}-${address}`],
        
        // Утилиты для тестирования
        forceCircuitBreakerOpen: (chainId) => {
          const cb = getCircuitBreaker(chainId);
          cb.state = 'OPEN';
          cb.failures = cb.threshold;
          cb.lastFailureTime = Date.now();
          console.log(`Force opened circuit breaker for chain ${chainId}`);
        },
        
        resetCircuitBreaker: (chainId) => {
          const cb = getCircuitBreaker(chainId);
          cb.state = 'CLOSED';
          cb.failures = 0;
          console.log(`Reset circuit breaker for chain ${chainId}`);
        },
        
        clearTransactionPool: (chainId) => {
          const chainKey = chainId.toString();
          if (preSignedPool.current[chainKey]) {
            preSignedPool.current[chainKey].transactions = [];
            preSignedPool.current[chainKey].currentIndex = 0;
            console.log(`Cleared transaction pool for chain ${chainId}`);
          }
        },
        
        generateHealthReport: (chainId) => {
          const rpcHealth = rpcHealthStatus.current[chainId];
          const poolStatus = preSignedPool.current[chainId?.toString()];
          const circuitBreakerState = circuitBreakers.current[chainId];
          
          const report = {
            timestamp: new Date().toISOString(),
            chainId,
            rpcEndpoints: rpcHealth,
            transactionPool: poolStatus ? {
              totalTransactions: poolStatus.transactions.length,
              currentIndex: poolStatus.currentIndex,
              availableTransactions: poolStatus.transactions.length - poolStatus.currentIndex,
              isRefilling: poolStatus.isRefilling
            } : null,
            circuitBreaker: circuitBreakerState,
            connections: activeConnections.current,
            burstState: burstState.current[chainId]
          };
          
          console.table(report);
          return report;
        }
      };
      
      console.log('🔧 Blockchain debug utilities loaded. Use window.blockchainDebug for monitoring.');
      console.log('📊 Example: window.blockchainDebug.generateHealthReport(6342)');
    }
  }, []);

  // Debug утилиты для мониторинга (только в development) - ДОПОЛНЕННЫЕ для Real-Time Gaming
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
      window.blockchainDebug = {
        getRPCHealth: (chainId) => rpcHealthStatus.current[chainId],
        getCircuitBreaker: (chainId) => circuitBreakers.current[chainId],
        getTransactionPool: (chainId) => preSignedPool.current[chainId],
        getBurstState: (chainId) => burstState.current[chainId],
        getConnectionPool: () => activeConnections.current,
        getNonceManager: (chainId, address) => nonceManager.current[`${chainId}-${address}`],
        
        // 🎮 НОВЫЕ утилиты для Real-Time Gaming мониторинга
        getPerformanceMetrics: (chainId) => performanceMetrics.current[chainId],
        getGlobalCache: () => {
          try {
            const cached = localStorage.getItem(GLOBAL_CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
          } catch (error) {
            return null;
          }
        },
        
        // Утилиты для тестирования
        forceCircuitBreakerOpen: (chainId) => {
          const cb = getCircuitBreaker(chainId);
          cb.state = 'OPEN';
          cb.failures = cb.threshold;
          cb.lastFailureTime = Date.now();
          console.log(`Force opened circuit breaker for chain ${chainId}`);
        },
        
        resetCircuitBreaker: (chainId) => {
          const cb = getCircuitBreaker(chainId);
          cb.state = 'CLOSED';
          cb.failures = 0;
          console.log(`Reset circuit breaker for chain ${chainId}`);
        },
        
        clearTransactionPool: (chainId) => {
          const chainKey = chainId.toString();
          if (preSignedPool.current[chainKey]) {
            preSignedPool.current[chainKey].transactions = [];
            preSignedPool.current[chainKey].currentIndex = 0;
            console.log(`Cleared transaction pool for chain ${chainId}`);
          }
        },
        
        // 🎯 РЕВОЛЮЦИОННЫЙ отчет о производительности
        generatePerformanceReport: (chainId) => {
          const rpcHealth = rpcHealthStatus.current[chainId];
          const poolStatus = preSignedPool.current[chainId?.toString()];
          const circuitBreakerState = circuitBreakers.current[chainId];
          const performanceData = performanceMetrics.current[chainId];
          const globalCache = window.blockchainDebug.getGlobalCache();
          
          const report = {
            timestamp: new Date().toISOString(),
            chainId,
            network: NETWORK_CONFIGS[chainId]?.name || 'Unknown',
            
            // RPC здоровье
            rpcEndpoints: rpcHealth ? {
              current: rpcHealth.endpoints[rpcHealth.currentEndpointIndex]?.url,
              healthyCount: rpcHealth.endpoints.filter(ep => ep.healthy).length,
              totalCount: rpcHealth.endpoints.length,
              endpoints: rpcHealth.endpoints.map(ep => ({
                url: ep.url,
                healthy: ep.healthy,
                failures: ep.consecutiveFailures,
                responseTime: ep.responseTime
              }))
            } : null,
            
            // Пул транзакций
            transactionPool: poolStatus ? {
              totalTransactions: poolStatus.transactions.length,
              currentIndex: poolStatus.currentIndex,
              availableTransactions: poolStatus.transactions.length - poolStatus.currentIndex,
              poolUtilization: `${Math.round((poolStatus.currentIndex / poolStatus.transactions.length) * 100)}%`,
              isRefilling: poolStatus.isRefilling,
              hasTriggeredRefill: poolStatus.hasTriggeredRefill
            } : null,
            
            // Circuit breaker
            circuitBreaker: circuitBreakerState ? {
              state: circuitBreakerState.state,
              failures: circuitBreakerState.failures,
              threshold: circuitBreakerState.threshold,
              lastFailure: circuitBreakerState.lastFailureTime ? 
                new Date(circuitBreakerState.lastFailureTime).toISOString() : null
            } : null,
            
            // 🎮 Метрики производительности Real-Time Gaming
            performance: performanceData ? {
              totalTransactions: performanceData.totalTransactions,
              successfulTransactions: performanceData.successfulTransactions,
              successRate: `${performanceData.successRate.toFixed(1)}%`,
              averageBlockchainTime: `${Math.round(performanceData.averageBlockchainTime)}ms`,
              recentTransactions: performanceData.recentTransactions.slice(-10).map(tx => ({
                blockchainTime: `${tx.blockchainTime}ms`,
                success: tx.success,
                timestamp: new Date(tx.timestamp).toISOString()
              })),
              performanceGrade: performanceData.averageBlockchainTime < 1000 ? '🚀 INSTANT' :
                              performanceData.averageBlockchainTime < 3000 ? '⚡ FAST' :
                              performanceData.averageBlockchainTime < 5000 ? '🔥 GOOD' : '🐌 SLOW'
            } : null,
            
            // Активные соединения
            connections: activeConnections.current,
            
            // Burst состояние
            burstState: burstState.current[chainId] ? {
              lastBurstTime: new Date(burstState.current[chainId].lastBurstTime).toISOString(),
              burstCount: burstState.current[chainId].burstCount,
              inCooldown: burstState.current[chainId].inCooldown,
              pendingTransactions: burstState.current[chainId].pendingTransactions.length
            } : null,
            
            // Глобальный кеш
            globalCache: globalCache ? {
              gasParamsAge: globalCache.gasParams ? 
                `${Math.round((Date.now() - globalCache.gasParams.timestamp) / 1000)}s ago` : 'None',
              chainParamsAge: globalCache.chainParams ? 
                `${Math.round((Date.now() - globalCache.chainParams.timestamp) / 1000)}s ago` : 'None',
              rpcHealthAge: globalCache.rpcHealth ? 
                `${Math.round((Date.now() - globalCache.rpcHealth.timestamp) / 1000)}s ago` : 'None'
            } : null
          };
          
          console.group(`📊 Performance Report - ${report.network} (Chain ${chainId})`);
          console.table(report.performance);
          console.log('🔗 RPC Health:', report.rpcEndpoints);
          console.log('🎯 Transaction Pool:', report.transactionPool);
          console.log('⚡ Circuit Breaker:', report.circuitBreaker);
          console.log('🚀 Burst State:', report.burstState);
          console.log('💾 Global Cache:', report.globalCache);
          console.groupEnd();
          
          return report;
        },
        
        // Быстрый вызов для основных метрик
        quickStats: (chainId) => {
          const perf = performanceMetrics.current[chainId];
          const pool = preSignedPool.current[chainId?.toString()];
          
          if (perf && pool) {
            const consumed = pool.currentIndex;
            const remaining = pool.transactions.length - pool.currentIndex;
            const cyclesCompleted = Math.floor(consumed / 5);
            const netGrowth = cyclesCompleted * 10;
            
            console.log(`🎮 ${NETWORK_CONFIGS[chainId]?.name || 'Chain ' + chainId}:`);
            console.log(`  ⚡ Avg Speed: ${Math.round(perf.averageBlockchainTime)}ms`);
            console.log(`  📊 Success Rate: ${perf.successRate.toFixed(1)}%`);
            console.log(`  🎯 Pool Status: ${remaining}/${pool.transactions.length} ready`);
            console.log(`  ♾️  Infinite Pool: ${consumed} used, +${netGrowth} growth (${cyclesCompleted} cycles)`);
            console.log(`  📈 Next refill: ${5 - (consumed % 5)} transactions`);
            console.log(`  🚀 Performance: ${perf.averageBlockchainTime < 1000 ? 'INSTANT' : perf.averageBlockchainTime < 3000 ? 'FAST' : 'SLOW'}`);
          } else {
            console.log('📊 No performance data available yet');
          }
        },
        
        // Детальная статистика бесконечного пула
        infinitePoolStats: (chainId) => {
          const pool = preSignedPool.current[chainId?.toString()];
          if (!pool) {
            console.log('❌ No pool found for chain', chainId);
            return;
          }
          
          const consumed = pool.currentIndex;
          const remaining = pool.transactions.length - pool.currentIndex;
          const total = pool.transactions.length;
          const cyclesCompleted = Math.floor(consumed / 5);
          const netGrowth = cyclesCompleted * 10;
          const nextRefillAt = (Math.floor(consumed / 5) + 1) * 5;
          const transactionsToNextRefill = nextRefillAt - consumed;
          
          console.group(`♾️ Infinite Pool Analysis - Chain ${chainId}`);
          console.log(`📊 Current Status:`);
          console.log(`  • Total transactions: ${total}`);
          console.log(`  • Consumed: ${consumed}`);
          console.log(`  • Remaining: ${remaining}`);
          console.log(`  • Pool ready: ${pool.isReady ? '✅' : '❌'}`);
          console.log(`  • Refilling: ${pool.isRefilling ? '🔄' : '⏸️'}`);
          
          console.log(`🔄 Growth Cycles:`);
          console.log(`  • Completed cycles: ${cyclesCompleted}`);
          console.log(`  • Net growth: +${netGrowth} transactions`);
          console.log(`  • Growth rate: ${consumed > 0 ? ((netGrowth / consumed) * 100).toFixed(1) : 0}%`);
          
          console.log(`📈 Next Refill:`);
          console.log(`  • Refill trigger at: ${nextRefillAt} consumed`);
          console.log(`  • Transactions until refill: ${transactionsToNextRefill}`);
          console.log(`  • Will add: +15 transactions`);
          
          console.log(`🎯 Pool Efficiency:`);
          console.log(`  • Efficiency: ${((remaining / total) * 100).toFixed(1)}%`);
          console.log(`  • Trend: ${remaining > 20 ? '📈 Growing' : remaining > 10 ? '➡️ Stable' : '📉 Needs attention'}`);
          console.log(`  • Is infinite: ${total > 50 ? '✅ Yes' : '❌ Not yet'}`);
          
          if (consumed > 0) {
            const theoreticalPool = consumed + netGrowth;
            console.log(`🧮 Mathematical Verification:`);
            console.log(`  • Theoretical pool size: ${theoreticalPool}`);
            console.log(`  • Actual pool size: ${total}`);
            console.log(`  • Difference: ${total - theoreticalPool} (should be positive)`);
          }
          
          console.groupEnd();
        },
        
        // 🚨 ЭКСТРЕННЫЙ сброс circuit breaker для немедленного восстановления
        forceResetAllCircuitBreakers: () => {
          Object.keys(circuitBreakers.current).forEach(chainId => {
            const cb = circuitBreakers.current[chainId];
            if (cb) {
              cb.state = 'CLOSED';
              cb.failures = 0;
              cb.lastFailureTime = 0;
              console.log(`✅ Force reset circuit breaker for chain ${chainId}`);
            }
          });
          console.log('🚀 All circuit breakers reset - ready for gaming!');
        }
      };
      
      console.log('🔧 Blockchain debug utilities loaded. Use window.blockchainDebug for monitoring.');
      console.log('📊 Examples:');
      console.log('  • window.blockchainDebug.generatePerformanceReport(6342)');
      console.log('  • window.blockchainDebug.quickStats(6342)');
      console.log('  • window.blockchainDebug.infinitePoolStats(6342) // 🆕 Infinite pool analysis');
      console.log('  • window.blockchainDebug.getPerformanceMetrics(6342)');
      console.log('  • window.blockchainDebug.forceResetAllCircuitBreakers() // Экстренный сброс');
      
      // АВТОМАТИЧЕСКИЙ сброс circuit breakers при первой загрузке
      setTimeout(() => {
        Object.keys(circuitBreakers.current).forEach(chainId => {
          const cb = circuitBreakers.current[chainId];
          if (cb && cb.state === 'OPEN') {
            cb.state = 'CLOSED';
            cb.failures = 0;
            console.log(`🔄 Auto-reset circuit breaker for chain ${chainId} on page load`);
          }
        });
      }, 2000); // Через 2 секунды после загрузки
      
      // Добавляем глобальные функции для отладки
      if (process.env.NODE_ENV === 'development') {
        window.gameCallFaucet = callFaucet;
        window.gameGetEmbeddedWallet = getEmbeddedWallet;
        window.gameEnsureEmbeddedWallet = ensureEmbeddedWallet;
        console.log('🔧 Отладочные функции добавлены в window:');
        console.log('  • window.gameCallFaucet(address, chainId)');
        console.log('  • window.gameGetEmbeddedWallet()');
        console.log('  • window.gameEnsureEmbeddedWallet()');
      }
    }
    
    // Очистка при размонтировании
    return () => {
      stopBalanceAutoUpdate();
    };
  }, []);

  // Effect для автоматического обеспечения embedded wallet при аутентификации
  useEffect(() => {
    if (authenticated && user && wallets.length === 0) {
      console.log('🔄 User authenticated but no wallets found, ensuring embedded wallet creation...');
      const ensureWallet = async () => {
        try {
          await ensureEmbeddedWallet();
        } catch (error) {
          console.error('Failed to ensure embedded wallet:', error);
        }
      };
      ensureWallet();
    }
  }, [authenticated, user, wallets.length]);

  // Effect для повторных попыток создания embedded wallet
  useEffect(() => {
    if (authenticated && user && wallets.length > 0) {
      const embeddedWallet = getEmbeddedWallet();
      if (!embeddedWallet) {
        console.log('🔄 User has wallets but no embedded wallet found, retrying creation...');
        const retryWallet = async () => {
          try {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            await ensureEmbeddedWallet();
          } catch (error) {
            console.error('Failed to retry embedded wallet creation:', error);
          }
        };
        retryWallet();
      }
    }
  }, [authenticated, user, wallets.length]);

  return {
    // Состояние
    isInitializing,
    transactionPending,
    transactionPendingCount: transactionPendingCount.current, // Добавляем счетчик pending транзакций
    balance,
    contractNumber,
    
    // Методы
    initData,
    sendUpdate,
    checkBalance,
    callFaucet,
    getContractNumber,
    
    // Утилиты
    getEmbeddedWallet,
    ensureEmbeddedWallet,
    startBalanceAutoUpdate,
    stopBalanceAutoUpdate,
    isAuthenticated: authenticated,
    isReady: authenticated && wallets.length > 0,
    
    // INFINITE POOL: Дополнительные утилиты для мониторинга бесконечного пула
    getPoolStatus: (chainId) => {
      const pool = preSignedPool.current[chainId?.toString()];
      if (!pool) return null;
      const cyclesCompleted = Math.floor(pool.currentIndex / 5);
      const netGrowth = cyclesCompleted * 10;
      return {
        total: pool.transactions.length,
        used: pool.currentIndex,
        remaining: pool.transactions.length - pool.currentIndex,
        isReady: pool.isReady,
        isRefilling: pool.isRefilling,
        // Infinite pool specific stats
        cyclesCompleted,
        netGrowth,
        isInfinite: pool.transactions.length > 50,
        trend: pool.transactions.length - pool.currentIndex > 20 ? 'growing' : 
               pool.transactions.length - pool.currentIndex > 10 ? 'stable' : 'attention'
      };
    },
    
    // Статистика бесконечного пула
    getInfinitePoolStats: (chainId) => {
      const pool = preSignedPool.current[chainId?.toString()];
      if (!pool) return null;
      
      const consumed = pool.currentIndex;
      const remaining = pool.transactions.length - pool.currentIndex;
      const total = pool.transactions.length;
      const cyclesCompleted = Math.floor(consumed / 5);
      const netGrowth = cyclesCompleted * 10;
      const nextRefillAt = (Math.floor(consumed / 5) + 1) * 5;
      const transactionsToNextRefill = nextRefillAt - consumed;
      
      return {
        consumed,
        remaining,
        total,
        cyclesCompleted,
        netGrowth,
        nextRefillAt,
        transactionsToNextRefill,
        isInfinite: total > 50,
        growthRate: consumed > 0 ? (netGrowth / consumed * 100).toFixed(1) + '%' : '0%',
        poolEfficiency: total > 0 ? (remaining / total * 100).toFixed(1) + '%' : '0%'
      };
    },
    
    startPoolMonitoring, // Для ручного запуска мониторинга если нужно
    
    // Debug методы (только для разработки)
    ...(process.env.NODE_ENV === 'development' && {
      debugGetRPCHealth: (chainId) => rpcHealthStatus.current[chainId],
      debugGetCircuitBreaker: (chainId) => circuitBreakers.current[chainId],
      debugGenerateReport: (chainId) => window.blockchainDebug?.generateHealthReport(chainId)
    })
  };
};