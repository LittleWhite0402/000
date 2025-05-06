// 初始化 GUN，添加多個備用節點
const gun = Gun({
    peers: [
        'https://gun-manhattan.herokuapp.com/gun',
        'https://gun-us.herokuapp.com/gun',
        'https://gun-eu.herokuapp.com/gun'
    ],
    localStorage: false, // 避免本地儲存衝突
    retry: 999999 // 持續嘗試重新連線
});

// 遊戲狀態
const gameState = gun.get('go-game-' + Math.random().toString(36).substring(7)); // 隨機遊戲房間
const BOARD_SIZE = 19;
const CELL_SIZE = 30;
const STONE_RADIUS = 13;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
canvas.width = BOARD_SIZE * CELL_SIZE;
canvas.height = BOARD_SIZE * CELL_SIZE;

let currentPlayer = 'black';
let board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
let lastMove = null;
let players = {
    black: null,
    white: null
};
let passCount = 0;

// 初始化棋盤
function initBoard() {
    board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
    drawBoard();
    updateScore();
}

// 繪製棋盤
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 繪製棋盤背景
    ctx.fillStyle = '#DCB35C';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 繪製網格線
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < BOARD_SIZE; i++) {
        // 橫線
        ctx.beginPath();
        ctx.moveTo(CELL_SIZE/2, i * CELL_SIZE + CELL_SIZE/2);
        ctx.lineTo(canvas.width - CELL_SIZE/2, i * CELL_SIZE + CELL_SIZE/2);
        ctx.stroke();
        
        // 直線
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE + CELL_SIZE/2, CELL_SIZE/2);
        ctx.lineTo(i * CELL_SIZE + CELL_SIZE/2, canvas.height - CELL_SIZE/2);
        ctx.stroke();
    }
    
    // 繪製星位
    const starPoints = [
        {x: 3, y: 3}, {x: 9, y: 3}, {x: 15, y: 3},
        {x: 3, y: 9}, {x: 9, y: 9}, {x: 15, y: 9},
        {x: 3, y: 15}, {x: 9, y: 15}, {x: 15, y: 15}
    ];
    
    ctx.fillStyle = '#000000';
    starPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point.x * CELL_SIZE + CELL_SIZE/2, 
                point.y * CELL_SIZE + CELL_SIZE/2, 
                3, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // 繪製棋子
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col]) {
                drawStone(col, row, board[row][col]);
            }
        }
    }
}

// 繪製棋子
function drawStone(x, y, color) {
    ctx.beginPath();
    ctx.arc(x * CELL_SIZE + CELL_SIZE/2, 
            y * CELL_SIZE + CELL_SIZE/2, 
            STONE_RADIUS, 0, Math.PI * 2);
    
    // 漸層效果
    const gradient = ctx.createRadialGradient(
        x * CELL_SIZE + CELL_SIZE/2 - 3, 
        y * CELL_SIZE + CELL_SIZE/2 - 3,
        1,
        x * CELL_SIZE + CELL_SIZE/2,
        y * CELL_SIZE + CELL_SIZE/2,
        STONE_RADIUS
    );
    
    if (color === 'black') {
        gradient.addColorStop(0, '#666');
        gradient.addColorStop(1, '#000');
    } else {
        gradient.addColorStop(0, '#fff');
        gradient.addColorStop(1, '#ccc');
    }
    
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = color === 'black' ? '#000' : '#ccc';
    ctx.stroke();
}

// 取得棋子的氣
function getLiberties(row, col, checked = new Set()) {
    if (!board[row][col]) return 0;
    const key = `${row},${col}`;
    if (checked.has(key)) return 0;
    checked.add(key);
    
    let liberties = 0;
    const color = board[row][col];
    const directions = [[1,0], [-1,0], [0,1], [0,-1]];
    
    for (let [dx, dy] of directions) {
        const newRow = row + dx;
        const newCol = col + dy;
        
        if (newRow >= 0 && newRow < BOARD_SIZE && 
            newCol >= 0 && newCol < BOARD_SIZE) {
            if (!board[newRow][newCol]) {
                liberties++;
            } else if (board[newRow][newCol] === color) {
                liberties += getLiberties(newRow, newCol, checked);
            }
        }
    }
    
    return liberties;
}

// 移除死子
function removeDeadStones(color) {
    let removed = false;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col] && board[row][col] !== color) {
                if (getLiberties(row, col) === 0) {
                    board[row][col] = null;
                    removed = true;
                }
            }
        }
    }
    return removed;
}

// 檢查是否為合法落子
function isValidMove(row, col) {
    if (board[row][col]) return false;
    
    // 模擬落子
    board[row][col] = currentPlayer;
    
    // 檢查是否有提子
    const hasCaptures = removeDeadStones(currentPlayer);
    
    // 如果沒有提子，檢查自殺手
    if (!hasCaptures && getLiberties(row, col) === 0) {
        board[row][col] = null;
        return false;
    }
    
    // 還原棋盤
    board[row][col] = null;
    return true;
}

// 處理點擊事件
canvas.addEventListener('click', handleClick);

function handleClick(e) {
    if (!players[currentPlayer]) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.round((x - CELL_SIZE/2) / CELL_SIZE);
    const row = Math.round((y - CELL_SIZE/2) / CELL_SIZE);
    
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
        if (isValidMove(row, col)) {
            makeMove(row, col);
        }
    }
}

// 落子
function makeMove(row, col) {
    board[row][col] = currentPlayer;
    removeDeadStones(currentPlayer);
    passCount = 0;
    
    lastMove = { row, col };
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    
    updateGameState();
    updateTurnDisplay();
    updateScore();
}

// 計算得分
function calculateScore() {
    let scores = { black: 0, white: 0 };
    let territory = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
    
    // 計算領地
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (board[row][col]) {
                scores[board[row][col]]++;
            } else if (!territory[row][col]) {
                let area = new Set();
                let color = null;
                let queue = [[row, col]];
                let visited = new Set();
                
                while (queue.length > 0) {
                    const [r, c] = queue.shift();
                    const key = `${r},${c}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    
                    if (!board[r][c]) {
                        area.add(key);
                        [[1,0], [-1,0], [0,1], [0,-1]].forEach(([dx, dy]) => {
                            const newRow = r + dx;
                            const newCol = c + dy;
                            if (newRow >= 0 && newRow < BOARD_SIZE && 
                                newCol >= 0 && newCol < BOARD_SIZE) {
                                if (board[newRow][newCol]) {
                                    if (color === null) {
                                        color = board[newRow][newCol];
                                    } else if (color !== board[newRow][newCol]) {
                                        color = 'neutral';
                                    }
                                } else {
                                    queue.push([newRow, newCol]);
                                }
                            }
                        });
                    }
                }
                
                if (color && color !== 'neutral') {
                    scores[color] += area.size;
                    area.forEach(key => {
                        const [r, c] = key.split(',').map(Number);
                        territory[r][c] = color;
                    });
                }
            }
        }
    }
    
    return scores;
}

// 更新分數顯示
function updateScore() {
    const scores = calculateScore();
    document.getElementById('score').textContent = 
        `黑：${scores.black} 白：${scores.white}`;
}

// 修改 updateGameState 函數，添加錯誤處理
function updateGameState() {
    try {
        gameState.put({
            board: board,
            currentPlayer: currentPlayer,
            players: players,
            lastMove: lastMove,
            passCount: passCount
        });
    } catch (error) {
        console.error('更新遊戲狀態失敗：', error);
        alert('連線出現問題，請重新整理頁面');
    }
}

// 修改監聽函數，添加錯誤處理
gameState.on(function(data) {
    try {
        if (data && data.board) {
            board = data.board;
            currentPlayer = data.currentPlayer;
            players = data.players;
            lastMove = data.lastMove;
            passCount = data.passCount;
            drawBoard();
            updateTurnDisplay();
            updateScore();
            
            // 顯示最後一手的位置
            if (lastMove) {
                highlightLastMove(lastMove.row, lastMove.col);
            }
        }
    } catch (error) {
        console.error('處理遊戲狀態更新失敗：', error);
    }
}, true); // 添加 true 參數來確保不會遺漏更新

// 新增函數：標示最後一手
function highlightLastMove(row, col) {
    if (lastMove) {
        ctx.beginPath();
        ctx.arc(col * CELL_SIZE + CELL_SIZE/2, 
                row * CELL_SIZE + CELL_SIZE/2, 
                5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
    }
}

// 更新回合顯示
function updateTurnDisplay() {
    const turnDiv = document.getElementById('player-turn');
    if (!players.black || !players.white) {
        turnDiv.textContent = '等待玩家加入...';
    } else {
        turnDiv.textContent = `當前回合: ${currentPlayer === 'black' ? '黑方' : '白方'}`;
    }
}

// 加入遊戲按鈕事件
document.getElementById('join-game').addEventListener('click', function() {
    if (!players.black) {
        players.black = true;
        currentPlayer = 'black';
    } else if (!players.white) {
        players.white = true;
    }
    updateGameState();
    this.disabled = true;
});

// 虛手按鈕事件
document.getElementById('pass').addEventListener('click', function() {
    if (!players[currentPlayer]) return;
    
    passCount++;
    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    
    if (passCount >= 2) {
        alert('遊戲結束！\n' + document.getElementById('score').textContent);
    }
    
    updateGameState();
    updateTurnDisplay();
});

// 重新開始按鈕事件
document.getElementById('reset-game').addEventListener('click', function() {
    initBoard();
    currentPlayer = 'black';
    players = { black: null, white: null };
    lastMove = null;
    passCount = 0;
    updateGameState();
    document.getElementById('join-game').disabled = false;
});

// 初始化遊戲
initBoard();