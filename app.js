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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoomId = null, myNickname = "", myColor = "", isLocked = false;

const gridBody = document.getElementById('gridBody');
for (let f = 10; f >= 1; f--) {
    let row = document.createElement('tr');
    row.innerHTML = `<td class="floor-label">F${f}</td>` + 
        [1, 2, 3, 4].map(p => `<td><button id="btn_${f}_${p}" class="p-btn" onclick="togglePlatform(${f},${p})">${p}</button></td>`).join('');
    gridBody.appendChild(row);
}

function showView(viewId) {
    ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'].forEach(id => document.getElementById(id).classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length !== 4) return alert("請設定 4 碼密碼");
    const newRoomId = Math.floor(1000 + Math.random() * 9000).toString();
    db.ref(`rooms/${newRoomId}`).set({ password: pwd, createdAt: firebase.database.ServerValue.TIMESTAMP })
        .then(() => { currentRoomId = newRoomId; document.getElementById('roomIdDisplay').innerText = newRoomId; showView('nicknameView'); })
        .catch(() => alert("創建失敗"));
}

function joinRoom() {
    const id = document.getElementById('joinId').value, pwd = document.getElementById('joinPwd').value;
    db.ref(`rooms/${id}`).once('value', snap => {
        const data = snap.val();
        if (data && data.password === pwd) { currentRoomId = id; document.getElementById('roomIdDisplay').innerText = id; showView('nicknameView'); }
        else alert("房號或密碼錯誤");
    });
}

function setNickname() {
    const nick = document.getElementById('nicknameInput').value.trim();
    if (!nick) return alert("請輸入暱稱");
    myNickname = nick; document.getElementById('activeRoomId').innerText = currentRoomId; showView('mainGameView'); listenToRoom();
}

function listenToRoom() {
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snap => {
        const data = snap.val() || {};
        document.querySelectorAll('.p-btn').forEach(btn => { btn.style.backgroundColor = ""; const tag = btn.querySelector('.user-tag'); if (tag) tag.remove(); });
        Object.keys(data).forEach(key => {
            const [f, p] = key.split('_'), btn = document.getElementById(`btn_${f}_${p}`);
            if (btn) { btn.style.backgroundColor = data[key].color; btn.innerHTML = `${p}<div class="user-tag">${data[key].user}</div>`; }
        });
    });
    const pRef = db.ref(`rooms/${currentRoomId}/users/${myNickname}`);
    pRef.set({ color: myColor || "#555" }); pRef.onDisconnect().remove();
    db.ref(`rooms/${currentRoomId}/users`).on('value', snap => {
        const users = snap.val() || {}, list = document.getElementById('userList');
        list.innerHTML = ""; Object.keys(users).forEach(u => {
            const b = document.createElement('div'); b.className = 'user-badge'; b.style.backgroundColor = users[u].color; b.innerText = u; list.appendChild(b);
        });
    });
}

function pickCustomColor() {
    myColor = document.getElementById('colorPicker').value; isLocked = true;
    document.getElementById('myColorStatus').classList.remove('hidden');
    document.getElementById('confirmColorBtn').classList.add('hidden');
    document.getElementById('resetColorBtn').classList.remove('hidden');
    if (currentRoomId) db.ref(`rooms/${currentRoomId}/users/${myNickname}`).update({ color: myColor });
}

function resetMyColor() {
    isLocked = false; document.getElementById('myColorStatus').classList.add('hidden');
    document.getElementById('confirmColorBtn').classList.remove('hidden');
    document.getElementById('resetColorBtn').classList.add('hidden');
}

// 修改：手動填色增加「同層唯一顏色」檢查
function togglePlatform(f, p) {
    if (!isLocked) return alert("請先選定顏色並點擊確認");
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const gridData = snap.val() || {};
        const targetKey = `${f}_${p}`;
        
        // 如果該格已經是你填的，點擊則取消
        if (gridData[targetKey] && gridData[targetKey].user === myNickname) {
            db.ref(`rooms/${currentRoomId}/grid/${targetKey}`).remove();
            return;
        }

        // 檢查該層是否有其他人已使用你的顏色
        for (let i = 1; i <= 4; i++) {
            const checkKey = `${f}_${i}`;
            if (gridData[checkKey] && gridData[checkKey].color === myColor) {
                return; // 同層已有此顏色，禁止填入
            }
        }
        db.ref(`rooms/${currentRoomId}/grid/${targetKey}`).set({ user: myNickname, color: myColor });
    });
}

// 修改：快捷鍵填色增加「同層唯一顏色」檢查
function autoFillNextFloor(p) {
    if (!isLocked) return;
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const gridData = snap.val() || {};
        for (let f = 1; f <= 10; f++) {
            // 檢查該層四個平台是否已有我的顏色
            let colorExistsInFloor = false;
            for (let i = 1; i <= 4; i++) {
                if (gridData[`${f}_${i}`] && gridData[`${f}_${i}`].color === myColor) {
                    colorExistsInFloor = true; break;
                }
            }
            // 如果該平台沒人填，且該層還沒出現過我的顏色
            if (!gridData[`${f}_${p}`] && !colorExistsInFloor) {
                db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`).set({ user: myNickname, color: myColor });
                break;
            }
        }
    });
}

function undoLastFill() {
    if (!currentRoomId || !myNickname) return;
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const data = snap.val() || {};
        for (let f = 10; f >= 1; f--) {
            for (let p = 1; p <= 4; p++) {
                if (data[`${f}_${p}`] && data[`${f}_${p}`].user === myNickname) {
                    db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`).remove(); return;
                }
            }
        }
    });
}

window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    if (['1', '2', '3', '4'].includes(e.key)) autoFillNextFloor(parseInt(e.key));
    else if (e.key === '0') undoLastFill();
});

function clearAllPlatforms() { if (confirm("確定要清空所有樓層嗎？")) db.ref(`rooms/${currentRoomId}/grid`).remove(); }
function leaveRoom() { location.reload(); }
function copyShareLink() {
    const link = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
    navigator.clipboard.writeText(link).then(() => alert("連結已複製"));
}
