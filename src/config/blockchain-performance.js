// // Конфигурация для мониторинга производительности блокчейна
// export const PERFORMANCE_CONFIG = {
//   // Мониторинг RPC эндпоинтов
//   rpcMonitoring: {
//     healthCheckInterval: 30000, // 30 секунд
//     maxResponseTime: 10000, // 10 секунд
//     failureThreshold: 3, // Количество неудач для маркировки как нездоровый
//     recoveryCheckInterval: 60000, // 1 минута
//   },

//   // Системы оповещений
//   alerts: {
//     slowTransaction: 15000, // Предупреждение если транзакция > 15 секунд
//     highFailureRate: 0.3, // Предупреждение если >30% транзакций неудачны
//     lowBalance: 0.00005, // Предупреждение если баланс < 0.00005 ETH
//     circuitBreakerOpen: true, // Уведомление когда circuit breaker открыт
//   },

//   // Автоматическое восстановление
//   autoRecovery: {
//     enabled: true,
//     maxRetries: 3,
//     backoffMultiplier: 2,
//     enableFallbackMode: true,
//     fallbackTimeout: 300000, // 5 минут до отключения fallback режима
//   },

//   // Производительность по сетям
//   networkOptimization: {
//     6342: { // MegaETH
//       batchOptimization: true,
//       preSigningEnabled: true,
//       burstModeEnabled: true,
//       connectionPooling: true,
//       adaptiveTimeouts: true,
//     },
//     31337: { // Foundry
//       batchOptimization: true,
//       preSigningEnabled: true,
//       burstModeEnabled: true,
//       connectionPooling: false,
//       adaptiveTimeouts: false,
//     },
//     50311: { // Somnia
//       batchOptimization: false,
//       preSigningEnabled: true,
//       burstModeEnabled: false,
//       connectionPooling: true,
//       adaptiveTimeouts: true,
//     },
//     1313161556: { // RISE
//       batchOptimization: false,
//       preSigningEnabled: true,
//       burstModeEnabled: false,
//       connectionPooling: true,
//       adaptiveTimeouts: true,
//     }
//   }
// };

// // Утилиты для мониторинга
// export const performanceUtils = {
//   // Логирование метрик производительности
//   logPerformanceMetric: (chainId, metric, value, metadata = {}) => {
//     const timestamp = new Date().toISOString();
//     console.log(`[PERF-${chainId}] ${timestamp} ${metric}: ${value}`, metadata);
//   },

//   // Создание отчета о состоянии системы
//   generateHealthReport: (chainId, rpcHealth, poolStatus, circuitBreakerState) => {
//     return {
//       timestamp: Date.now(),
//       chainId,
//       rpcEndpoints: rpcHealth,
//       transactionPool: poolStatus,
//       circuitBreaker: circuitBreakerState,
//       recommendations: performanceUtils.getRecommendations(rpcHealth, poolStatus, circuitBreakerState)
//     };
//   },

//   // Получение рекомендаций для оптимизации
//   getRecommendations: (rpcHealth, poolStatus, circuitBreakerState) => {
//     const recommendations = [];

//     // Проверка RPC здоровья
//     if (rpcHealth?.endpoints) {
//       const unhealthyEndpoints = rpcHealth.endpoints.filter(ep => !ep.healthy).length;
//       if (unhealthyEndpoints > 0) {
//         recommendations.push({
//           type: 'warning',
//           message: `${unhealthyEndpoints} RPC endpoints are unhealthy`,
//           action: 'Consider switching to fallback endpoints or reducing request rate'
//         });
//       }
//     }

//     // Проверка пула транзакций
//     if (poolStatus?.transactions?.length < 3) {
//       recommendations.push({
//         type: 'info',
//         message: 'Transaction pool is running low',
//         action: 'Consider pre-signing more transactions'
//       });
//     }

//     // Проверка circuit breaker
//     if (circuitBreakerState?.state === 'OPEN') {
//       recommendations.push({
//         type: 'error',
//         message: 'Circuit breaker is open',
//         action: 'Wait for recovery period or investigate underlying issues'
//       });
//     }

//     return recommendations;
//   },

//   // Автоматическая диагностика проблем
//   diagnoseIssue: (error, chainId) => {
//     const diagnosis = {
//       issue: error.message,
//       category: 'unknown',
//       severity: 'medium',
//       solutions: []
//     };

//     // Анализ типичных ошибок RPC
//     if (error.message?.includes('context deadline exceeded')) {
//       diagnosis.category = 'timeout';
//       diagnosis.severity = 'high';
//       diagnosis.solutions = [
//         'Увеличить timeout параметры для RPC запросов',
//         'Переключиться на fallback RPC endpoint',
//         'Уменьшить размер batch для предподписания',
//         'Включить circuit breaker для защиты от cascade failures'
//       ];
//     } else if (error.message?.includes('rate limit')) {
//       diagnosis.category = 'rate_limiting';
//       diagnosis.severity = 'medium';
//       diagnosis.solutions = [
//         'Включить burst mode для управления скоростью отправки',
//         'Увеличить задержки между транзакциями',
//         'Использовать несколько RPC endpoints для распределения нагрузки'
//       ];
//     } else if (error.message?.includes('nonce too low')) {
//       diagnosis.category = 'nonce_management';
//       diagnosis.severity = 'medium';
//       diagnosis.solutions = [
//         'Обновить nonce manager принудительно',
//         'Очистить кэш предподписанных транзакций',
//         'Синхронизировать nonce с сетью'
//       ];
//     } else if (error.message?.includes('insufficient funds')) {
//       diagnosis.category = 'balance';
//       diagnosis.severity = 'high';
//       diagnosis.solutions = [
//         'Пополнить баланс через faucet',
//         'Проверить актуальность адреса кошелька',
//         'Уменьшить gas параметры для транзакций'
//       ];
//     }

//     return diagnosis;
//   }
// };

// // Экспорт конфигурации по умолчанию
// export default PERFORMANCE_CONFIG;