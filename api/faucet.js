
import { createPublicClient, createWalletClient, formatEther, http, isAddress, parseEther, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, megaethTestnet, riseTestnet, foundry, somniaTestnet, monadTestnet } from "viem/chains";
//supoorted networks are megaeth, foundry, base sepolia, monad testnet, somnia testnet, rise testnet



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

    if (!isAddress(address)) {
      console.log('[FAUCET] Validation failed: Invalid address format');
      return res.status(400).json({ error: 'Invalid address format' });
    }
    const CHAIN_MAP = {
      [megaethTestnet.id]: megaethTestnet,
      [monadTestnet.id]: monadTestnet,
      [riseTestnet.id]: riseTestnet,
      [baseSepolia.id]: baseSepolia,
      [foundry.id]: foundry,
      [somniaTestnet.id]: somniaTestnet,
    };

    const network = CHAIN_MAP[chainId];
    if (!network) {
      console.log('[FAUCET] Validation failed: Unsupported network', chainId);
      return res.status(400).json({ error: 'Unsupported network' });
    }


    // Получаем приватный ключ владельца из переменных окружения
    const ownerPrivateKey = process.env.FAUCET_OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      console.log('[FAUCET] Error: Private key not configured');
      return res.status(500).json({ error: 'Faucet owner private key not configured', code: 'MISSING_PRIVATE_KEY' });
    }

    // Создаем провайдер и faucet кошелёк
    const faucetOwnerWalletClient = createWalletClient({
      account:privateKeyToAccount(ownerPrivateKey),
      chain:network,
      transport:http()
    }).extend(publicActions)
    // const faucetOwnerAccount = privateKeyToAccount(ownerPrivateKey)

    console.log('[FAUCET] Faucet wallet address:', faucetOwnerWalletClient.account.address);

    // Проверяем баланс фонда
    const dripAmount = parseEther('0.0001');
    let faucetBalance;
    try {
      faucetBalance = await faucetOwnerWalletClient.getBalance({address: faucetOwnerWalletClient.account.address});
      console.log("faucet (owner) balance is here: ", faucetBalance);
    } catch (error) {
      console.error('[FAUCET] Failed to check faucet balance:', error.message);
      return res.status(500).json({
        error: 'Failed to connect to RPC',
        details: error.message,
        code: 'RPC_ERROR'
      });
    }
    
    // ВРЕМЕННО ОТКЛЮЧЕНО: Проверка баланса faucet
    if (faucetBalance < dripAmount) {
      return res.status(400).json({ 
        error: 'Faucet wallet is empty',
        balance: formatEther(faucetBalance),
        code: 'INSUFFICIENT_FAUCET_FUNDS'
      });
    }
    
    // Логируем текущий баланс faucet для мониторинга
    console.log(`Faucet balance: ${formatEther(faucetBalance)} ETH`);

    // Проверяем, что у пользователя мало средств (< 0.00005 ETH)
    console.log('[FAUCET] Checking user balance for', address);
    let userBalance;
    try {
      userBalance = await faucetOwnerWalletClient.getBalance({address});
    } catch (error) {
      console.error('[FAUCET] Failed to check user balance:', error.message);
      return res.status(500).json({
        error: 'Failed to check user balance',
        details: error.message,
        code: 'RPC_ERROR'
      });
    }
    const minBalance = parseEther('0.00005'); 

    console.log('[FAUCET] User balance:', formatEther(userBalance), 'ETH');

    if (!force && userBalance >= minBalance) {
      console.log('[FAUCET] User already has sufficient balance');
      return res.status(400).json({
        error: 'Address already has sufficient balance',
        balance: formatEther(userBalance),
        minimum: '0.00005',
        code: 'ALREADY_SUFFICIENT'
      });
    }

    // Отправляем ETH напрямую из faucet кошелька
    console.log(`[FAUCET] Sending 0.0001 ETH from faucet wallet to ${address} on chain ${chainId}`);

    let tx;
    try {
      tx = await faucetOwnerWalletClient.sendTransaction({
        to: address,
        value: dripAmount,
      });
      console.log('[FAUCET] Transaction sent, hash:', tx);
    } catch (error) {
      console.error('[FAUCET] Failed to send transaction:', error.message);
      return res.status(500).json({
        error: 'Failed to send transaction',
        details: error.message,
        code: 'TRANSACTION_SEND_ERROR'
      });
    }

    console.log('[FAUCET] Waiting for confirmation...');

    let receipt;
    try {
      receipt = await faucetOwnerWalletClient.waitForTransactionReceipt({ hash: tx });
    } catch (error) {
      console.error('[FAUCET] Transaction confirmation failed:', error.message);
      return res.status(500).json({
        error: 'Transaction sent but confirmation failed',
        txHash: tx,
        details: error.message,
        code: 'CONFIRMATION_TIMEOUT'
      });
    }


    console.log(`[FAUCET] Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`[FAUCET] Transaction successful: ${receipt.transactionHash}`);

    return res.status(200).json({
      success: true,
      txHash: receipt.transactionHash,
      transactionHash: receipt.transactionHash,
      amount: '0.0001',
      recipient: address,
      blockNumber: Number(receipt.blockNumber)
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