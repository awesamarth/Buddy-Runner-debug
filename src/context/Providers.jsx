'use client';

import { PrivyProvider } from '@privy-io/react-auth';

// Simple network configurations matching the existing networks
const megaethTestnet = {
  id: 6342,
  name: 'MegaETH Testnet',
  network: 'megaeth-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://carrot.megaeth.com/rpc'],
      webSocket: ['wss://carrot.megaeth.com/ws'],
    },
  },
  blockExplorers: {
    default: {
      name: 'MegaETH Explorer',
      url: 'https://carrot.megaeth.com',
    },
  },
};

const foundryNetwork = {
  id: 31337,
  name: 'Foundry Local',
  network: 'foundry',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://127.0.0.1:8545'],
    },
  },
};

const somniaTestnet = {
  id: 50311,
  name: 'Somnia Testnet',
  network: 'somnia-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet.somnia.network'],
    },
  },
};

const riseTestnet = {
  id: 1313161556,
  name: 'RISE Testnet',
  network: 'rise-testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.rise.com'],
    },
  },
};

const baseSepolia = {
  id: 84532,
  name: 'Base Sepolia',
  network: 'base-sepolia',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://sepolia.base.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Base Sepolia Explorer',
      url: 'https://sepolia.basescan.org',
    },
  },
};

const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  network: 'monad-testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
};

export default function Providers({ children }) {
  // Use the same App ID as before
  const appId = 'cme84q0og02aalc0bh9blzwa9';

  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Simple embedded wallet configuration
        embeddedWallets: {
          createOnLogin: 'all-users',
        },
        // Clean appearance settings
        appearance: {
          theme: 'dark',
          accentColor: '#1391ff',
        },
        // Simple login methods
        loginMethods: ['email', 'wallet', 'google', 'discord', 'twitter'],
        // Network configuration
        defaultChain: megaethTestnet,
        supportedChains: [
          megaethTestnet,
          foundryNetwork,
          somniaTestnet,
          riseTestnet,
          baseSepolia,
          monadTestnet,
        ],
      }}
    >
      {children}
    </PrivyProvider>
  );
}