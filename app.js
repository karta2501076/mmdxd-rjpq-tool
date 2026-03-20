// app.js

// 🚨 ==========================================
// 🚨 在此處貼上你的 Firebase 配置 (SDK Config) 🚨
// 🚨 ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyCpJmhpPRxgTSTpZi38DHCaV8ZaLhuKKTc",
  authDomain: "rjpq-tool-2ee82.firebaseapp.com",
  databaseURL: "https://rjpq-tool-2ee82-default-rtdb.firebaseio.com/",
  projectId: "rjpq-tool-2ee82",
  storageBucket: "rjpq-tool-2ee82.firebasestorage.app",
  messagingSenderId: "349150642845",
  appId: "1:349150642845:web:14fe4a135278f82cc40a74",
  measurementId: "G-9FP8PMRQ5Q"
};
// 🚨 ==========================================

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 定義指定顏色
const PLAYER_COLORS = {
    '#FF7575': '紅色',
    '#FFC78E': '橘色',
    '#66B3FF': '藍色',
    '#FF79BC': '粉色'
};

// 本地狀態變數
let currentRoomId = null;
let currentNickname = null;
let currentMyColor = null; // 當前玩家選定的顏色 (hex)

// 初始化：檢查網址是否有房間號，並生成 10 層表格
window.onload = function() {
    // 1. 生成表格
    const tbody = document.getElementById('gridBody');
    tbody.innerHTML = '';
    for (let f = 9; f >= 0; f--) {
        let row = `<tr>
            <td class="floor-label">F${f+1}</td>
            ${[1,2,3,4].map(num => `
                <td><button class="p-btn" id="b-${f}-${num-1}" onclick="handleCellClick(${f}, ${num-1})">${num}</button></td>
            `).join('')}
        </tr>`;
        tbody.innerHTML += row;
    }

    // 2. 處理分享連結 (網址有 ?room=XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomIdFromUrl = urlParams.get('room');
    
    if (roomIdFromUrl) {
        currentRoomId = roomIdFromUrl;
        document.getElementById('roomIdDisplay').innerText = `房間：${currentRoomId}`;
        // 隱承建立/加入介面，顯示暱稱設定
        showView('nicknameView');
    }
};

// ===========================
// 第一階段：房間系統
// ===========================

// A. 建立房間
function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length < 4) { alert('密碼至少需要4碼！'); return; }
    
    currentRoomId = Math.floor(100000 + Math.random() * 900000).toString(); // 生成6位數房號
    
    // 將房間資訊寫入 Firebase
    database.ref(`rooms/${currentRoomId}`).set({
        pwd: pwd,
        state: { /* 存放遊戲平台資料 */ },
        players: { /* 存放玩家暱稱與顏色資料 */ }
    }).then(() => {
        setupRoomView();
    });
}

// B. 加入房間
function joinRoom() {
    currentRoomId = document.getElementById('joinId').value;
    const pwd = document.getElementById('joinPwd').value;
    
    if (!currentRoomId || pwd.length < 4) { alert('請填寫完整資訊！'); return; }

    // 驗證房間與密碼
    database.ref(`rooms/${currentRoomId}/pwd`).once('value', (snapshot) => {
        if (!snapshot.exists()) { alert('房間號不存在！'); return; }
        if (snapshot.val() !== pwd) { alert('密碼錯誤！'); return; }
        
        setupRoomView();
    });
}

// 共通：設定房間介面
function setupRoomView() {
    document.getElementById('roomIdDisplay').innerText = `房間：${currentRoomId}`;
    showView('nicknameView');
    // 更新分享連結
    const shareUrl = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    document.getElementById('shareLink').innerText = shareUrl;
}

// C. 設定暱稱
function setNickname() {
    currentNickname = document.getElementById('nicknameInput').value;
    if (!currentNickname || currentNickname.length < 2) { alert('暱稱至少需2個字！'); return; }

    showView('mainGameView');
    startRoomListening(); // 開始監聽房間所有變動
}

// D. 複製分享連結
function copyShareLink() {
    const link = document.getElementById('shareLink').innerText;
    navigator.clipboard.writeText(link);
    alert('連結已複製！貼給隊友直接進入。');
}

// ===========================
// 第二階段：遊戲邏輯 (核心)
// ===========================

// 開始監聽房間的實時變動 (核心)
function startRoomListening() {
    const roomRef = database.ref(`rooms/${currentRoomId}`);

    // 1. 監聽「玩家顏色佔用」
    roomRef.child('players').on('value', (snapshot) => {
        const playersData = snapshot.val() || {};
        updateColorSelectionUI(playersData);
    });

    // 2. 監聽「平台狀態變動」 (核心邏輯：排除法)
    roomRef.child('state').on('value', (snapshot) => {
        const stateData = snapshot.val() || {};
        renderGameGrid(stateData);
    });
}

// ---------------------------
// 2.1 顏色互斥邏輯
// ---------------------------

// 更新顏色選單 UI：如果別的玩家選了某個顏色，我不能選
function updateColorSelectionUI(playersData) {
    // 先重置所有顏色按鈕
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('selected', 'taken');
        btn.style.opacity = 1;
        btn.onclick = (e) => selectColor(e.target.dataset.color);
    });

    // 儲存所有已佔用顏色 (hex -> name)
    const takenColors = {}; 
    for (let pId in playersData) {
        if (playersData[pId].color) {
            takenColors[playersData[pId].color] = playersData[pId].name;
        }
    }

    // 套用狀態
    for (let hex in takenColors) {
        const btn = document.querySelector(`.color-btn[data-color="${hex}"]`);
        if (!btn) continue;

        if (hex === currentMyColor) {
            // 我選定的顏色
            btn.classList.add('selected');
        } else {
            // 被別人佔用的顏色
            btn.classList.add('taken');
            btn.onclick = null; // 不能點擊
        }
    }
}

// 選擇/切換顏色
function selectColor(hex) {
    if (currentMyColor === hex) return; // 重複點擊
    currentMyColor = hex;
    
    // **將我的顏色選擇更新到 Firebase**
    // 路徑: rooms/房號/players/暱稱 = { color: 'hex' }
    database.ref(`rooms/${currentRoomId}/players/${currentNickname}`).set({
        name: currentNickname,
        color: hex
    });
}

// 重置我的顏色選擇 (玩家有機會想換顏色)
function resetMyColor() {
    if (!currentMyColor) return;
    currentMyColor = null;
    database.ref(`rooms/${currentRoomId}/players/${currentNickname}/color`).remove();
}

// ---------------------------
// 2.2 平台排除邏輯 (核心)
// ---------------------------

// 處理平台點擊
function handleCellClick(f, p) {
    if (!currentMyColor) { alert('請先選擇一個顏色！'); return; }
    const pRef = database.ref(`rooms/${currentRoomId}/state/f${f}`);

    // **執行排除法：檢查這層樓是否已經有人點了**
    pRef.once('value', (snapshot) => {
        const floorData = snapshot.val() || {}; // { p0: '暱稱1', p1: '暱稱2' }
        const nicknameInThisPlatform = floorData[`p${p}`];

        // 1. 如果我點的是自己已經佔用的格子 -> 清空
        if (nicknameInThisPlatform === currentNickname) {
            pRef.child(`p${p}`).remove();
        } 
        // 2. 如果這格是空的
        else if (!nicknameInThisPlatform) {
            // **再檢查我自己這層是否有選別格** (一個人每層只能選一格)
            for (let existingP in floorData) {
                if (floorData[existingP] === currentNickname) {
                    // 清空我舊的格子
                    pRef.child(existingP).remove();
                }
            }
            // **佔用新的格子**
            pRef.child(`p${p}`).set(currentNickname);
        }
        // 3. 如果這格被別人佔用了 -> 依照您的需求：其他玩家無法點選，只能點2,3,4
        else {
            // 由於別的玩家無法選擇此格，這裡什麼都不做 (UI 會呈現灰色不可點擊)
        }
    });
}

// 根據 Firebase 資料渲染平台 UI
function renderGameGrid(stateData) {
    // 先清空所有暱稱顯示和顏色狀態
    document.querySelectorAll('.nickname-tag').forEach(tag => tag.remove());
    document.querySelectorAll('.p-btn').forEach(btn => {
        btn.classList.remove('taken', 'selected');
        btn.style.backgroundColor = '#333'; // 重置為灰黑色
        btn.onclick = null; // 重新綁定 onclick
    });

    // 從資料庫重新讀取所有暱稱對應的顏色
    database.ref(`rooms/${currentRoomId}/players`).once('value', (playersSnapshot) => {
        const playersInfo = playersSnapshot.val() || {};

        // 遍歷所有層數 (0-9)
        for (let f = 0; f < 10; f++) {
            const floorData = stateData[`f${f}`]; // { p0: '暱稱1', p2: '暱稱2' }
            if (!floorData) {
                // 如果這層是空的，所有格子都可以點擊
                for (let p = 0; p < 4; p++) {
                    const btn = document.getElementById(`b-${f}-${p}`);
                    if (btn) btn.onclick = () => handleCellClick(f, p);
                }
                continue;
            }

            // 找出這層樓哪些格子被點了
            for (let p = 0; p < 4; p++) {
                const btn = document.getElementById(`b-${f}-${p}`);
                if (!btn) continue;
                
                const nickname = floorData[`p${p}`];

                if (nickname) {
                    // 有人點了這格：顯示成該玩家選的顏色，並在中間下方顯示他的暱稱
                    const pColor = playersInfo[nickname] ? playersInfo[nickname].color : '#777';
                    
                    btn.style.backgroundColor = pColor;
                    btn.style.color = (pColor === '#FFC78E' || pColor === '#FF79BC') ? '#000' : '#fff'; // 調整字體顏色
                    
                    // 顯示暱稱 (中間下方)
                    if (nickname === currentNickname) { btn.classList.add('selected'); } // 突出我自己選的

                    const nickTag = document.createElement('div');
                    nickTag.className = `nickname-tag ${nickname === currentNickname ? 'my-nick' : ''}`;
                    nickTag.innerText = nickname;
                    nickTag.style.color = pColor;
                    btn.parentElement.appendChild(nickTag);
                    
                    // 這格已被點選，綁定 onclick (為了我點同一個格能清空)
                    btn.onclick = () => handleCellClick(f, p);
                } else {
                    // 空格子：可以被點擊
                    btn.onclick = () => handleCellClick(f, p);
                }
            }
        }
    });
}

// 清空平台上已經填過的顏色 (完成重置)
function clearAllPlatforms() {
    if (!currentMyColor) return;
    if(confirm('確定要清空這間房間「所有層數」的平台顏色嗎？')) {
        database.ref(`rooms/${currentRoomId}/state`).remove();
    }
}

// ===========================
// 第三階段：介面工具
// ===========================

function showView(viewId) {
    const views = ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'];
    views.forEach(v => {
        document.getElementById(v).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}
