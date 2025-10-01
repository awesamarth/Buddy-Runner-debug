// Simplified blockchain utils hook based on Blaze Arcade approach
import { useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, http, parseGwei, publicActions, encodeFunctionData } from 'viem';

// Simple chain configurations (matching Blaze Arcade pattern)
const CHAIN_CONFIGS = {
  6342: { // MegaETH Testnet
    name: 'MegaETH Testnet',
    rpcUrl: 'https://carrot.megaeth.com/rpc',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 6342,
  },
  31337: { // Foundry Local
    name: 'Foundry Local',
    rpcUrl: 'http://127.0.0.1:8545',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 31337,
  },
  50311: { // Somnia Testnet
    name: 'Somnia Testnet',
    rpcUrl: 'https://testnet.somnia.network',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 50311,
  },
  1313161556: { // RISE Testnet
    name: 'RISE Testnet',
    rpcUrl: 'https://testnet-rpc.rise.com',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 1313161556,
  },
  84532: { // Base Sepolia
    name: 'Base Sepolia',
    rpcUrl: 'https://sepolia.base.org',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 84532,
  },
  10143: { // Monad Testnet
    name: 'Monad Testnet',
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    contractAddress: '0xb34cac1135c27ec810e7e6880325085783c1a7e0',
    chainId: 10143,
  }
};

// Simple pre-signed transaction pool (like Blaze Arcade)
let preSignedPool = {};

// Simple client cache
let clientCache = {};

// Simple gas parameters cache
let gasParams = {};

// Simple ABI for BuddyGame contract
const BUDDY_GAME_ABI = [
  {
    "type": "function",
    "name": "makeMovement",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
];

export function useBlockchainUtilsSimple() {
  const { wallets } = useWallets();
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  // Create wallet client for a specific chain
  const createChainClient = async (chainId) => {
    if (!embeddedWallet) throw new Error('No embedded wallet found');

    const config = CHAIN_CONFIGS[chainId];
    if (!config) throw new Error(`Unsupported chain: ${chainId}`);

    const provider = await embeddedWallet.getEthereumProvider();
    

    const chain = {
      id: config.chainId,
      name: config.name,
      network: config.name.toLowerCase().replace(/\s+/g, '-'),
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } }
    };

    const client = createWalletClient({
      account: embeddedWallet.address,
      chain,
      transport: custom(provider),
    }).extend(publicActions);

    return client;
  };

  // Switch to a specific chain
  const switchToChain = async (chainId) => {
    if (!embeddedWallet) throw new Error('No embedded wallet found');
    await embeddedWallet.switchChain(chainId);
  };

  // Check balance
  const checkBalance = async (chainId) => {
    if (!embeddedWallet) throw new Error('No embedded wallet found');

    // Use cached client if available, otherwise create one
    const client = clientCache[chainId] || await createChainClient(chainId);

    const balance = await client.getBalance({
      address: embeddedWallet.address
    });
    
    return balance;
  };

  // Initialize and pre-sign transactions (simplified version)
  const initData = async (chainId, batchSize = 10) => {
    if (!embeddedWallet) {
      return;
    }


    // Ensure we're on the correct chain
    await switchToChain(chainId);

    // Create client only if not already cached
    if (!clientCache[chainId]) {
      clientCache[chainId] = await createChainClient(chainId);
    }

    const client = clientCache[chainId];
    const config = CHAIN_CONFIGS[chainId];

    // Get current nonce
    const currentNonce = await client.getTransactionCount({
      address: embeddedWallet.address
    });

    console.log("here's the current nonce: ", currentNonce)

    // Get gas parameters (simplified)
    if (!gasParams[chainId]) {
      try {
        const gasPrice = await client.getGasPrice();
        gasParams[chainId] = {
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: gasPrice / 10n // 10% tip
        };
      } catch (error) {
        // Fallback gas values
        gasParams[chainId] = {
          maxFeePerGas: 20000000000n, // 20 gwei
          maxPriorityFeePerGas: 2000000000n, // 2 gwei
        };
      }
    }

    // Pre-sign batch of transactions
    await preSignBatch(chainId, currentNonce, batchSize);
  };

  // Pre-sign a batch of transactions (simplified)
  const preSignBatch = async (chainId, startNonce, batchSize) => {
    if (!embeddedWallet) return;

    const client = clientCache[chainId];
    const config = CHAIN_CONFIGS[chainId];
    const transactions = [];


    for (let i = 0; i < batchSize; i++) {
      try {
        const txRequest = {
          to: config.contractAddress,
          data: encodeFunctionData({
            abi: BUDDY_GAME_ABI,
            functionName: 'makeMovement',
            args: []
          }),
          nonce: startNonce + i,
          gas: 21000n + 50000n, // Simple gas estimate
          ...gasParams[chainId]
        };

        const signedTx = await client.signTransaction(txRequest);
        transactions.push(signedTx);

      } catch (error) {
        break;
      }
    }

    // Store in simple pool structure
    preSignedPool[chainId] = {
      transactions,
      currentIndex: 0,
      baseNonce: startNonce,
      hasTriggeredRefill: false
    };

  };

  // Send update (simplified)
  const sendUpdate = async (chainId) => {
    const startTime = performance.now();

    if (!preSignedPool[chainId] || preSignedPool[chainId].transactions.length === 0) {
      throw new Error('No pre-signed transactions available');
    }

    const pool = preSignedPool[chainId];
    const client = clientCache[chainId];

    if (pool.currentIndex >= pool.transactions.length) {
      throw new Error('Pre-signed transaction pool exhausted');
    }

    // Get next pre-signed transaction
    const signedTx = pool.transactions[pool.currentIndex];
    pool.currentIndex++;

    // Send the transaction
    const txHash = await client.sendRawTransaction({
      serializedTransaction: signedTx
    });

    // Simple refill logic (like Blaze Arcade)
    if (pool.currentIndex >= pool.transactions.length * 0.8 && !pool.hasTriggeredRefill) {
      pool.hasTriggeredRefill = true;
      // Trigger refill in background
      setTimeout(() => {
        preSignBatch(chainId, pool.baseNonce + pool.transactions.length, 10)
          .then(() => {
          })
          .catch(() => {});
      }, 100);
    }

    const blockchainTime = Math.round(performance.now() - startTime);

    return {
      transactionHash: txHash,
      hash: txHash,
      blockchainTime,
      isInstant: true
    };
  };

  return {
    initData,
    sendUpdate,
    checkBalance,
    isReady: !!embeddedWallet,
  };
}