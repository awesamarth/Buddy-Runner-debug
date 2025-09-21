import React, { useState, useEffect, useCallback, useMemo } from 'react';
import '../styles/TransactionNotifications.css';

const TransactionNotifications = ({ 
  transactionPending, 
  transactionPendingCount,
  balance, 
  blockchainStatus, 
  selectedNetwork,
  authenticated 
}) => {
  const [notifications, setNotifications] = useState([]);
  const [lastProcessedTransactionTime, setLastProcessedTransactionTime] = useState(0);
  const [lastPendingCount, setLastPendingCount] = useState(0);

  // Добавляем уведомление о транзакции (отслеживаем изменения totalMovements)
  useEffect(() => {
    if (authenticated && selectedNetwork && !selectedNetwork.isWeb2 && blockchainStatus) {
      // Отслеживаем увеличение totalMovements как индикатор новой транзакции
      const currentMovements = blockchainStatus.totalMovements || 0;
      
      // Если totalMovements увеличился, значит была новая транзакция
      if (currentMovements > 0) {
        // Проверяем, есть ли новая транзакция по времени
        const currentTransactionTime = blockchainStatus.lastTransactionTime || 0;
        
        if (currentTransactionTime > lastProcessedTransactionTime && currentTransactionTime > 0) {
          const notification = {
            id: Date.now() + Math.random(),
            type: 'transaction',
            title: 'Jump Completed',
            message: `Jump completed in ${currentTransactionTime}ms on ${selectedNetwork.name}`,
            status: 'completed',
            timestamp: Date.now(),
            completedAt: Date.now()
          };
          
          setNotifications(prev => [...prev, notification]);
          setLastProcessedTransactionTime(currentTransactionTime);
        }
      }
    }
  }, [blockchainStatus?.totalMovements, blockchainStatus?.lastTransactionTime, authenticated, selectedNetwork, lastProcessedTransactionTime]);

  // Добавляем уведомление о pending транзакции (отслеживаем увеличение transactionPendingCount)
  useEffect(() => {
    if (authenticated && selectedNetwork && !selectedNetwork.isWeb2) {
      // Если количество pending транзакций увеличилось, создаем уведомление
      if (transactionPendingCount > lastPendingCount) {
        const notification = {
          id: Date.now() + Math.random(),
          type: 'transaction',
          title: 'Transaction Pending',
          message: `Processing jump on ${selectedNetwork.name}`,
          status: 'pending',
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);
        setLastPendingCount(transactionPendingCount);
      } else if (transactionPendingCount < lastPendingCount) {
        // Если количество pending уменьшилось, обновляем счетчик
        setLastPendingCount(transactionPendingCount);
      }
    }
  }, [transactionPendingCount, authenticated, selectedNetwork, lastPendingCount]);

  // Обновляем pending транзакции до completed (только для не-MegaETH сетей)
  useEffect(() => {
    if (blockchainStatus?.lastTransactionTime && authenticated && selectedNetwork && !selectedNetwork.isWeb2) {
      // Находим pending транзакцию и обновляем её (только если есть pending транзакции)
      setNotifications(prev => prev.map(notif => 
        notif.status === 'pending' && notif.type === 'transaction' 
          ? {
              ...notif,
              status: 'completed',
              message: `Jump completed in ${blockchainStatus.lastTransactionTime}ms`,
              completedAt: Date.now()
            }
          : notif
      ));
    }
  }, [blockchainStatus?.lastTransactionTime, authenticated, selectedNetwork]);

  // Добавляем уведомление об ошибках транзакций
  useEffect(() => {
    if (blockchainStatus?.lastError && authenticated && selectedNetwork && !selectedNetwork.isWeb2) {
      // Проверяем, что это новая ошибка (по timestamp)
      const hasRecentError = notifications.some(n => 
        n.type === 'error' && 
        (Date.now() - n.timestamp) < 5000 && // За последние 5 секунд
        n.message.includes(blockchainStatus.lastError.type)
      );
      
      if (!hasRecentError) {
        const notification = {
          id: Date.now() + Math.random(),
          type: 'error',
          title: 'Transaction Error',
          message: `${blockchainStatus.lastError.type}: ${blockchainStatus.lastError.message?.slice(0, 50)}...`,
          status: 'error',
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);
      }
    }
  }, [blockchainStatus?.lastError?.timestamp, authenticated, selectedNetwork]); // Используем timestamp вместо всего объекта

  // Добавляем уведомление о высокой производительности
  useEffect(() => {
    if (blockchainStatus?.averageTransactionTime && 
        blockchainStatus.averageTransactionTime < 1000 && 
        authenticated && selectedNetwork && !selectedNetwork.isWeb2) {
      
      const hasPerformanceNotif = notifications.some(n => n.type === 'performance' && (Date.now() - n.timestamp) < 30000);
      
      if (!hasPerformanceNotif) {
        const notification = {
          id: Date.now() + Math.random(),
          type: 'performance',
          title: 'Excellent Performance!',
          message: `Average speed: ${Math.round(blockchainStatus.averageTransactionTime)}ms - Gaming Mode Active! 🚀`,
          status: 'success',
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);
      }
    }
  }, [blockchainStatus?.averageTransactionTime, authenticated, selectedNetwork]);

  // Добавляем уведомление о низком балансе
  useEffect(() => {
    if (balance && parseFloat(balance) < 0.00005 && authenticated && selectedNetwork && !selectedNetwork.isWeb2) {
      const hasLowBalanceNotif = notifications.some(n => n.type === 'low-balance' && n.status !== 'dismissed');
      
      if (!hasLowBalanceNotif) {
        const notification = {
          id: Date.now() + Math.random(),
          type: 'low-balance',
          title: 'Low Balance',
          message: `Balance: ${balance} ETH - Get test tokens`,
          status: 'warning',
          timestamp: Date.now()
        };

        setNotifications(prev => [...prev, notification]);
      }
    }
  }, [balance, authenticated, selectedNetwork]);

  // Автоматическое удаление старых уведомлений
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev => {
        const now = Date.now();
        const filtered = prev.filter(notif => {
          // Удаляем completed уведомления через 3 секунды
          if (notif.status === 'completed' && notif.completedAt && (now - notif.completedAt) > 3000) {
            return false;
          }
          // Удаляем старые уведомления через 10 секунд
          if ((now - notif.timestamp) > 10000) {
            return false;
          }
          return true;
        });
        
        // Возвращаем тот же массив, если ничего не изменилось (избегаем лишних ререндеров)
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 2000); // Увеличиваем интервал до 2 секунд

    return () => clearInterval(interval);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);

  const getNotificationIcon = useCallback((type, status) => {
    if (type === 'transaction') {
      return status === 'pending' ? '⏳' : status === 'completed' ? '✅' : '🔄';
    }
    if (type === 'low-balance') {
      return '⚠️';
    }
    if (type === 'error') {
      return '❌';
    }
    if (type === 'performance') {
      return '🚀';
    }
    return '📢';
  }, []);

  const getNotificationClass = useCallback((type, status) => {
    if (type === 'transaction') {
      return status === 'pending' ? 'pending' : status === 'completed' ? 'success' : 'info';
    }
    if (type === 'low-balance') {
      return 'warning';
    }
    if (type === 'error') {
      return 'error';
    }
    if (type === 'performance') {
      return 'success';
    }
    return 'info';
  }, []);

  if (!authenticated || !selectedNetwork || selectedNetwork.isWeb2 || notifications.length === 0) {
    return null;
  }

  return (
    <div className="transaction-notifications">
      {notifications.map((notification) => (
        <div 
          key={notification.id}
          className={`notification ${getNotificationClass(notification.type, notification.status)}`}
        >
          <div className="notification-content">
            <div className="notification-header">
              <span className="notification-icon">
                {getNotificationIcon(notification.type, notification.status)}
              </span>
              <span className="notification-title">{notification.title}</span>
              <button 
                className="notification-close"
                onClick={() => dismissNotification(notification.id)}
              >
                ×
              </button>
            </div>
            <div className="notification-message">{notification.message}</div>
            {notification.type === 'transaction' && notification.status === 'pending' && (
              <div className="notification-progress">
                <div className="progress-bar">
                  <div className="progress-fill"></div>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TransactionNotifications;