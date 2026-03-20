// 1. Firebase 配置 (已根據你的截圖填寫最新資訊)
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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// 全域變數
let currentRoomId = null;
let myNickname = "";
let myColor = null;

// --- 介面切換邏輯 ---
function showView(viewId) {
    const views = ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'];
    views.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');

    // 關鍵修正：切換到暱稱或遊戲畫面時，立即強制更新房號文字顯示
    if (currentRoomId) {
        if (document.getElementById('roomIdDisplay')) {
            document.getElementById('roomIdDisplay').innerText = currentRoomId;
        }
        if (document.getElementById('activeRoomId')) {
            document.getElementById('activeRoomId').innerText = currentRoomId;
        }
    }
}

// --- 房間邏輯 ---

// 創建房間
function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length !== 4) return alert("請輸入 4 位數密碼");

    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = newRoomId;

    db.ref('rooms/' + newRoomId).set({
        password: pwd,
        createdAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        showView('nicknameView');
    });
}

// 加入房間
function joinRoom() {
    const id = document.getElementById('joinId').value;
    const pwd = document.getElementById('joinPwd').value;

    db.ref('rooms/' + id).once('value', snapshot => {
        const data = snapshot.val();
        if (data && data.password === pwd) {
            currentRoomId = id;
            showView('nicknameView');
        } else {
            alert("房間號碼或密碼錯誤");
        }
    });
}

// 設定暱稱並進入遊戲
function setNickname() {
    const nick = document.getElementById('nicknameInput').value;
    if (!nick) return alert("請輸入暱稱");
    myNickname = nick;
    
    // 初始化遊戲表格並開始監聽同步
    initGrid();
    listenToRoom();
    showView('mainGameView');
}

// --- 遊戲同步邏輯 ---

// 選擇顏色
function selectColor(color) {
    myColor = color;
    // 更新 UI 顯示已選顏色
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.getAttribute('data-color') === color) btn.classList.add('selected');
    });
}

// 重置顏色
function resetMyColor() {
    myColor = null;
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('selected'));
}

// 生成 10 層樓的表格 (F10 到 F1)
function initGrid() {
    const tbody = document.getElementById('gridBody');
    tbody.innerHTML = "";
    for (let f = 10; f >= 1; f--) {
        const tr = document.createElement('tr');
        const label = document.createElement('td');
        label.className = "floor-label";
        label.innerText = "F" + f;
        tr.appendChild(label);

        for (let p = 1; p <= 4; p++) {
            const td = document.createElement('td');
            const btn = document.createElement('button');
            btn.className = "p-btn";
            btn.innerText = p;
            btn.id = `btn-${f}-${p}`;
            btn.onclick = () => togglePlatform(f, p);
            td.appendChild(btn);
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

// 點擊平台同步到 Firebase
function togglePlatform(f, p) {
    if (!myColor) return alert("請先選擇上方顏色！");
    
    const pRef = db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`);
    pRef.once('value', snap => {
        if (snap.exists() && snap.val().color === myColor) {
            pRef.remove(); // 如果點自己填過的顏色，就取消填色
        } else {
            pRef.set({ color: myColor });
        }
    });
}

// 監聽房間數據變化
function listenToRoom() {
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snapshot => {
        // 先重置所有按鈕背景
        document.querySelectorAll('.p-btn').forEach(btn => {
            btn.style.backgroundColor = "";
            btn.style.color = "#ffffff"; // 確保數字始終為白色
        });

        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                const [f, p] = key.split('_');
                const btn = document.getElementById(`btn-${f}-${p}`);
                if (btn) {
                    btn.style.backgroundColor = data[key].color;
                    btn.style.color = "#ffffff"; // 填色後數字依然維持白色
                }
            });
        }
    });
}

// 清空所有平台
function clearAllPlatforms() {
    if (confirm("確定要清空所有已填的平台嗎？")) {
        db.ref(`rooms/${currentRoomId}/grid`).remove();
    }
}

// 複製分享連結
function copyShareLink() {
    const url = window.location.href.split('?')[0] + "?room=" + currentRoomId;
    navigator.clipboard.writeText(url).then(() => alert("連結已複製！"));
}
