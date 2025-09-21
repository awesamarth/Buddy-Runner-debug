import React, { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const PrivyWalletStatus = ({ selectedNetwork, className = "" }) => {
  const { user, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!authenticated) {
    return null;
  }

  // Find embedded wallet
  const embeddedWallet = wallets.find(wallet => wallet.walletClientType === 'privy');

  if (!embeddedWallet) {
    return null;
  }

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className={`privy-wallet-status ${className}`}>
      <div
        className="status-header"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer' }}
      >
        <div className="wallet-info">
          <span className="wallet-icon">👛</span>
          <span className="wallet-address">{formatAddress(embeddedWallet.address)}</span>
          <span className="embedded-badge">Privy</span>
        </div>

        <div className="status-indicators">
          <span className="status-icon text-green-400">🚀</span>
          <span className="expand-icon" style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="status-details">
          <div className="status-grid">
            <div className="status-item">
              <span className="label">Network:</span>
              <span className="value">{selectedNetwork?.name || 'Not selected'}</span>
            </div>

            <div className="status-item">
              <span className="label">Type:</span>
              <span className="value">Embedded Wallet</span>
            </div>

            <div className="status-item">
              <span className="label">Status:</span>
              <span className="value text-green-400">Connected</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivyWalletStatus;