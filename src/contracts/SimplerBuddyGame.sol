// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BuddyGame {
    struct GameSession {
        address player;
        uint256 score;
        uint256 movements;
        uint256 startTime;
        bool isActive;
    }
    
    mapping(address => GameSession) public playerSessions;
    mapping(address => uint256) public playerHighScores;
    
    event GameStarted(address indexed player, uint256 timestamp);
    event MovementMade(address indexed player, uint256 movementCount, uint256 score);
    event GameEnded(address indexed player, uint256 finalScore, uint256 totalMovements);
    
    function startGame() external {
        playerSessions[msg.sender] = GameSession({
            player: msg.sender,
            score: 0,
            movements: 0,
            startTime: block.timestamp,
            isActive: true
        });
        
        emit GameStarted(msg.sender, block.timestamp);
    }
    
    function makeMovement() external {
        require(playerSessions[msg.sender].isActive, "No active game session");
        
        GameSession storage session = playerSessions[msg.sender];
        session.movements++;
        
        // Award points based on time survived (simple scoring mechanism)
        uint256 timeAlive = block.timestamp - session.startTime;
        session.score = timeAlive + session.movements * 10;
        
        emit MovementMade(msg.sender, session.movements, session.score);
    }
    
    function endGame() external {
        require(playerSessions[msg.sender].isActive, "No active game session");
        
        GameSession storage session = playerSessions[msg.sender];
        session.isActive = false;
        
        // Update high score if this session's score is higher
        if (session.score > playerHighScores[msg.sender]) {
            playerHighScores[msg.sender] = session.score;
        }
        
        emit GameEnded(msg.sender, session.score, session.movements);
    }
    
    function getPlayerSession(address player) external view returns (GameSession memory) {
        return playerSessions[player];
    }
    
    function getPlayerHighScore(address player) external view returns (uint256) {
        return playerHighScores[player];
    }
}