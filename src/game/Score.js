export default class Score {
  score = 0;
  HIGH_SCORE_KEY = "highScore";

  constructor(ctx, scaleRatio, blockchainStatus = null, networkId = null) {
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    this.scaleRatio = scaleRatio;
    this.blockchainStatus = blockchainStatus;
    this.networkId = networkId;
  }

  getHighScoreKey() {
    // Different high scores for different networks
    if (this.networkId === "web2") {
      return "highScore_offline";
    } else if (this.networkId) {
      return `highScore_${this.networkId}`;
    }
    return this.HIGH_SCORE_KEY; // fallback
  }

  update(frameTimeDelta) {
    this.score += frameTimeDelta * 0.01;
  }

  reset() {
    this.score = 0;
  }

  setHighScore() {
    const key = this.getHighScoreKey();
    const highScore = Number(localStorage.getItem(key));
    if (this.score > highScore) {
      localStorage.setItem(key, Math.floor(this.score));
    }
  }

  draw(blockchainStatus = null) {
    // Update blockchainStatus if provided
    if (blockchainStatus) {
      this.blockchainStatus = blockchainStatus;
    }
    const key = this.getHighScoreKey();
    const highScore = Number(localStorage.getItem(key));
    const y = 20 * this.scaleRatio;

    const fontSize = 20 * this.scaleRatio;
    this.ctx.font = `${fontSize}px serif`;
    this.ctx.fillStyle = "#6B8E6B";
    this.ctx.textAlign = "right";
    const scoreX = this.canvas.width - 10 * this.scaleRatio;
    const highScoreX = scoreX - 150 * this.scaleRatio;

    const scorePadded = Math.floor(this.score).toString().padStart(6, 0);
    const highScorePadded = highScore.toString().padStart(6, 0);

    this.ctx.fillText(scorePadded, scoreX, y);
    this.ctx.fillText(`HI ${highScorePadded}`, highScoreX, y);

    this.ctx.textAlign = "left"; // Reset for blockchain status text

    // Draw blockchain status if available (only for web3 mode)
    if (this.blockchainStatus && this.blockchainStatus.initialized) {
      const blockchainY = y + 30 * this.scaleRatio;
      const smallFontSize = 12 * this.scaleRatio;
      this.ctx.font = `${smallFontSize}px monospace`;

      // Network name
      this.ctx.fillStyle = this.blockchainStatus.contractAvailable ? "#7FBC7F" : "#FFA500";
      this.ctx.fillText(
        `⛓️ ${this.blockchainStatus.networkName}`,
        10 * this.scaleRatio,
        blockchainY
      );

      // On-chain movements
      this.ctx.fillStyle = "#4169E1";
      this.ctx.fillText(
        `Moves: ${this.blockchainStatus.totalMovements}`,
        10 * this.scaleRatio,
        blockchainY + 20 * this.scaleRatio
      );

      // Pending transactions
      if (this.blockchainStatus.pendingTransactions > 0) {
        this.ctx.fillStyle = "#FF6347";
        this.ctx.fillText(
          `Pending: ${this.blockchainStatus.pendingTransactions}`,
          10 * this.scaleRatio,
          blockchainY + 40 * this.scaleRatio
        );
      }

      // INFINITE PRE-SIGNED POOL status
      if (this.blockchainStatus.poolStatus) {
        const pool = this.blockchainStatus.poolStatus;
        const cyclesCompleted = Math.floor(pool.used / 5);
        const netGrowth = cyclesCompleted * 10;
        
        // Dynamic color based on infinite pool logic
        const poolColor = pool.remaining > 20 ? "#32CD32" : pool.remaining > 10 ? "#7FBC7F" : pool.remaining > 3 ? "#FFA500" : "#FF6347";
        this.ctx.fillStyle = poolColor;
        
        // Pool status with infinite indicator
        const infiniteIndicator = pool.total > 50 ? "∞" : "";
        this.ctx.fillText(
          `Pool: ${pool.remaining}/${pool.total}${infiniteIndicator}`,
          10 * this.scaleRatio,
          blockchainY + 40 * this.scaleRatio
        );
        
        // Growth statistics
        if (pool.used > 0) {
          this.ctx.fillStyle = "#4169E1";
          this.ctx.fillText(
            `Growth: +${netGrowth} (${cyclesCompleted} cycles)`,
            10 * this.scaleRatio,
            blockchainY + 60 * this.scaleRatio
          );
        }
        
        // Pool status indicator
        if (!pool.isReady) {
          this.ctx.fillStyle = "#FF6347";
          this.ctx.fillText(
            `⏳ Initializing...`,
            10 * this.scaleRatio,
            blockchainY + 80 * this.scaleRatio
          );
        } else if (pool.isRefilling) {
          this.ctx.fillStyle = "#32CD32";
          this.ctx.fillText(
            `🔄 Growing pool...`,
            10 * this.scaleRatio,
            blockchainY + 80 * this.scaleRatio
          );
        } else if (pool.total > 50) {
          this.ctx.fillStyle = "#7FBC7F";
          this.ctx.fillText(
            `♾️ Infinite mode`,
            10 * this.scaleRatio,
            blockchainY + 80 * this.scaleRatio
          );
        }
      }

      // On-chain score (if available)
      if (this.blockchainStatus.onChainScore > 0) {
        this.ctx.fillStyle = "#32CD32";
        this.ctx.fillText(
          `On-chain: ${this.blockchainStatus.onChainScore}`,
          10 * this.scaleRatio,
          blockchainY + 100 * this.scaleRatio
        );
      }
    }
  }
}
