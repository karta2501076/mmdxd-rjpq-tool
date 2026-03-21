// Firebase 配置 (請確保與你的 Firebase Console 資訊一致)
const firebaseConfig = {
  apiKey: "AIzaSyCpJmhpPRxgTSTpZi38DHCaV8ZaLhuKKTc",
  authDomain: "rjpq-tool-2ee82.firebaseapp.com",
  databaseURL: "https://rjpq-tool-2ee82-default-rtdb.firebaseio.com",
  projectId: "rjpq-tool-2ee82",
  storageBucket: "rjpq-tool-2ee82.firebasestorage.app",
  messagingSenderId: "349150642845",
  appId: "1:349150642845:web:14fe4a135278f82cc40a74",
  measurementId: "G-9FP8PMRQ5Q"
};

// 初始化 Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// 全域變數
let currentRoomId = null;
let myNickname = "";
let myColor = "";
let isLocked = false;

// 初始化表格
const gridBody = document.getElementById('gridBody');
for (let f = 10; f >= 1; f--) {
    let row = document.createElement('tr');
    row.innerHTML = `<td class="floor-label">F${f}</td>` + 
        [1, 2, 3, 4].map(p => `<td><button id="btn_${f}_${p}" class="p-btn" onclick="togglePlatform(${f},${p})">${p}</button></td>`).join('');
    gridBody.appendChild(row);
}

// 介面切換
function showView(viewId) {
    ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
}

// 創建房間
function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length !== 4) return alert("請設定 4 碼密碼");
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    db.ref(`rooms/${newRoomId}`).set({
        password: pwd,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        currentRoomId = newRoomId;
        document.getElementById('roomIdDisplay').innerText = newRoomId;
        showView('nicknameView');
    });
}

// 加入房間
function joinRoom() {
    const id = document.getElementById('joinId').value;
    const pwd = document.getElementById('joinPwd').value;
    db.ref(`rooms/${id}`).once('value', snap => {
        const data = snap.val();
        if (data && data.password === pwd) {
            currentRoomId = id;
            document.getElementById('roomIdDisplay').innerText = id;
            showView('nicknameView');
        } else {
            alert("房號或密碼錯誤");
        }
    });
}

// 設定暱稱並進入
function setNickname() {
    const nick = document.getElementById('nicknameInput').value.trim();
    if (!nick) return alert("請輸入暱稱");
    myNickname = nick;
    document.getElementById('activeRoomId').innerText = currentRoomId;
    showView('mainGameView');
    listenToRoom();
}

// 監聽房間動態
function listenToRoom() {
    // 監聽格子
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snap => {
        const gridData = snap.val() || {};
        // 先重置所有按鈕
        document.querySelectorAll('.p-btn').forEach(btn => {
            btn.style.backgroundColor = "";
            const tag = btn.querySelector('.user-tag');
            if (tag) tag.remove();
        });
        // 渲染新資料
        Object.keys(gridData).forEach(key => {
            const [f, p] = key.split('_');
            const btn = document.getElementById(`btn_${f}_${p}`);
            if (btn) {
                btn.style.backgroundColor = gridData[key].color;
                btn.innerHTML = `${p}<div class="user-tag">${gridData[key].user}</div>`;
            }
        });
    });

    // 監聽在線成員
    const presenceRef = db.ref(`rooms/${currentRoomId}/users/${myNickname}`);
    presenceRef.set({ color: myColor || "#555" });
    presenceRef.onDisconnect().remove();

    db.ref(`rooms/${currentRoomId}/users`).on('value', snap => {
        const users = snap.val() || {};
        const listDiv = document.getElementById('userList');
        listDiv.innerHTML = "";
        Object.keys(users).forEach(u => {
            const badge = document.createElement('div');
            badge.className = 'user-badge';
            badge.style.backgroundColor = users[u].color;
            badge.innerText = u;
            listDiv.appendChild(badge);
        });
    });
}

// 選色邏輯
function pickCustomColor() {
    myColor = document.getElementById('colorPicker').value;
    isLocked = true;
    document.getElementById('myColorStatus').classList.remove('hidden');
    document.getElementById('confirmColorBtn').classList.add('hidden');
    document.getElementById('resetColorBtn').classList.remove('hidden');
    // 更新在線列表顏色
    db.ref(`rooms/${currentRoomId}/users/${myNickname}`).update({ color: myColor });
}

function resetMyColor() {
    isLocked = false;
    document.getElementById('myColorStatus').classList.add('hidden');
    document.getElementById('confirmColorBtn').classList.remove('hidden');
    document.getElementById('resetColorBtn').classList.add('hidden');
}

// 點擊格子填色
function togglePlatform(f, p) {
    if (!isLocked) return alert("請先選定顏色並點擊確認");
    const targetRef = db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`);
    targetRef.once('value', snap => {
        if (snap.exists()) {
            targetRef.remove(); // 點擊已填色的格子則取消
        } else {
            targetRef.set({ user: myNickname, color: myColor });
        }
    });
}

// 快捷鍵 1~4 填色
function autoFillNextFloor(platform) {
    if (!isLocked) return;
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const gridData = snap.val() || {};
        // 由下往上找第一個空的
        for (let f = 1; f <= 10; f++) {
            if (!gridData[`${f}_${platform}`]) {
                db.ref(`rooms/${currentRoomId}/grid/${f}_${platform}`).set({
                    user: myNickname,
                    color: myColor
                });
                break;
            }
        }
    });
}

// 快捷鍵 0 取消上一層 (核心更新)
function undoLastFill() {
    if (!currentRoomId || !myNickname) return;
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const gridData = snap.val() || {};
        // 從頂樓 10 往底樓 1 找
        for (let f = 10; f >= 1; f--) {
            for (let p = 1; p <= 4; p++) {
                const targetKey = `${f}_${p}`;
                // 檢查這格是不是自己填的 (比對暱稱或顏色)
                if (gridData[targetKey] && gridData[targetKey].user === myNickname) {
                    db.ref(`rooms/${currentRoomId}/grid/${targetKey}`).remove();
                    return; // 只刪除一格後立即跳出
                }
            }
        }
    });
}

// 鍵盤監聽
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const key = e.key;
    if (['1', '2', '3', '4'].includes(key)) {
        autoFillNextFloor(parseInt(key));
    } else if (key === '0') {
        undoLastFill();
    }
});

// 清空全部
function clearAllPlatforms() {
    if (confirm("確定要清空所有樓層嗎？")) {
        db.ref(`rooms/${currentRoomId}/grid`).remove();
    }
}

// 離開房間
function leaveRoom() {
    location.reload();
}

// 分享連結
function copyShareLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    navigator.clipboard.writeText(link).then(() => alert("房間連結已複製！"));
}
