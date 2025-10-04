import { ethers } from 'ethers';

// Конфигурация сетей и контрактов
const NETWORKS = {
  6342: { // MegaETH Testnet
    rpcUrl: process.env.MEGAETH_RPC_URL || 'https://carrot.megaeth.com/rpc',
    chainId: 6342
  },
  31337: { // Foundry Local
    rpcUrl: process.env.FOUNDRY_RPC_URL || 'http://127.0.0.1:8545',
    chainId: 31337
  },
  84532: { // Base Sepolia
    rpcUrl: 'https://sepolia.base.org',
    chainId: 84532
  },
  10143: { // Monad Testnet
    rpcUrl: 'https://testnet-rpc.monad.xyz',
    chainId: 10143
  },
  50311: { // Somnia Testnet
    rpcUrl: 'https://testnet.somnia.network',
    chainId: 50311
  },
  1313161556: { // RISE Testnet
    rpcUrl: 'https://testnet-rpc.rise.com',
    chainId: 1313161556
  }
};

export default async function handler(req, res) {

  console.log("faucet called")
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, chainId, force } = req.body;

    console.log('[FAUCET] Request received:', { address, chainId, force });

    // Валидация входных данных
    if (!address || !chainId) {
      console.log('[FAUCET] Validation failed: Missing address or chainId');
      return res.status(400).json({ error: 'Address and chainId are required' });
    }

    if (!ethers.isAddress(address)) {
      console.log('[FAUCET] Validation failed: Invalid address format');
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const network = NETWORKS[chainId];
    if (!network) {
      console.log('[FAUCET] Validation failed: Unsupported network', chainId);
      return res.status(400).json({ error: 'Unsupported network' });
    }

    console.log('[FAUCET] Validation passed for', network.rpcUrl);

    // Получаем приватный ключ владельца из переменных окружения
    const ownerPrivateKey = process.env.FAUCET_OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      console.log('[FAUCET] Error: Private key not configured');
      return res.status(500).json({ error: 'Faucet owner private key not configured', code: 'MISSING_PRIVATE_KEY' });
    }

    console.log('[FAUCET] Creating provider for', network.rpcUrl);

    // Создаем провайдер и faucet кошелёк
    const provider = new ethers.JsonRpcProvider(network.rpcUrl);
    const ownerWallet = new ethers.Wallet(ownerPrivateKey, provider);

    console.log('[FAUCET] Faucet wallet address:', ownerWallet.address);

    // Проверяем баланс фонда
    const dripAmount = ethers.parseEther('0.0001'); // Изменено на 0.0001 ETH
    const faucetBalance = await provider.getBalance(ownerWallet.address); // Проверяем баланс отдельного faucet кошелька
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка баланса faucet
    // if (faucetBalance < dripAmount) {
    //   return res.status(400).json({ 
    //     error: 'Faucet wallet is empty',
    //     balance: ethers.formatEther(faucetBalance),
    //     code: 'INSUFFICIENT_FAUCET_FUNDS'
    //   });
    // }
    
    // Логируем текущий баланс faucet для мониторинга
    console.log(`Faucet balance: ${ethers.formatEther(faucetBalance)} ETH`);

    // Проверяем, что у пользователя мало средств (< 0.00005 ETH)
    console.log('[FAUCET] Checking user balance for', address);
    const userBalance = await provider.getBalance(address);
    const minBalance = ethers.parseEther('0.00005'); // Изменено на 0.00005 ETH

    console.log('[FAUCET] User balance:', ethers.formatEther(userBalance), 'ETH');

    if (!force && userBalance >= minBalance) {
      console.log('[FAUCET] User already has sufficient balance');
      return res.status(400).json({
        error: 'Address already has sufficient balance',
        balance: ethers.formatEther(userBalance),
        minimum: '0.00005',
        code: 'ALREADY_SUFFICIENT'
      });
    }

    // Отправляем ETH напрямую из faucet кошелька
    console.log(`[FAUCET] Sending 0.0001 ETH from faucet wallet to ${address} on chain ${chainId}`);

    const tx = await ownerWallet.sendTransaction({
      to: address,
      value: dripAmount,
      gasLimit: 21000n // Стандартный газ для простого перевода ETH
    });

    console.log('[FAUCET] Transaction sent, hash:', tx.hash);
    console.log('[FAUCET] Waiting for confirmation...');

    // Ждём подтверждения транзакции
    const receipt = await tx.wait();

    console.log(`[FAUCET] Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`[FAUCET] Transaction successful: ${receipt.hash}`);

    return res.status(200).json({
      success: true,
      // Совместимость с клиентом: дублируем поле txHash
      txHash: receipt.hash,
      transactionHash: receipt.hash,
      amount: '0.0001',
      recipient: address,
      blockNumber: receipt.blockNumber
    });

  } catch (error) {
    console.error('Faucet error:', error);
    
    // Обработка специфичных ошибок
    if (error.message.includes('insufficient funds')) {
      // Логируем для отладки
      console.error('Insufficient funds error:', error.message);
      return res.status(400).json({ 
        error: 'Faucet wallet has insufficient funds for this transaction',
        details: 'The faucet wallet needs to be refilled',
        code: 'INSUFFICIENT_FAUCET_FUNDS'
      });
    }
    
    if (error.message.includes('nonce')) {
      return res.status(500).json({ error: 'Transaction nonce error, please try again', code: 'NONCE_ERROR' });
    }
    
    if (error.message.includes('gas')) {
      return res.status(500).json({ error: 'Gas estimation failed, please try again', code: 'GAS_ERROR' });
    }

    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      code: 'INTERNAL_ERROR'
    });
  }
}