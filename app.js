const firebaseConfig = {
  apiKey: "AIzaSyCpJmhpPRxgTSTpZi38DHCaV8ZaLhuKKTc",
  authDomain: "rjpq-tool-2ee82.firebaseapp.com",
  databaseURL: "https://rjpq-tool-2ee82-default-rtdb.firebaseio.com", 
  projectId: "rjpq-tool-2ee82",
  storageBucket: "rjpq-tool-2ee82.firebasestorage.app",
  messagingSenderId: "349150642845",
  appId: "1:349150642845:web:14fe4a135278f82cc40a74"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let currentRoomId = null, myNickname = "", myColor = null;

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) { 
        currentRoomId = params.get('room'); 
        showView('nicknameView'); 
    }
};

function showView(viewId) {
    ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    
    if (currentRoomId) {
        document.getElementById('roomIdDisplay').innerText = currentRoomId;
        const activeIdEl = document.getElementById('activeRoomId');
        if (activeIdEl) activeIdEl.innerText = currentRoomId;
    }
}

function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length !== 4) return alert("請輸入 4 位數密碼");
    const id = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = id;
    // 創建房間時同時初始化 colors 與 grid 節點
    db.ref('rooms/' + id).set({ 
        password: pwd,
        colors: { init: "system" }, // 防止路徑不存在導致 transaction 失敗
        grid: { init: "system" }
    }).then(() => showView('nicknameView'));
}

function joinRoom() {
    const id = document.getElementById('joinId').value, pwd = document.getElementById('joinPwd').value;
    db.ref('rooms/' + id).once('value', snap => {
        if (snap.val() && snap.val().password === pwd) { 
            currentRoomId = id; 
            showView('nicknameView'); 
        } else {
            alert("房號或密碼錯誤");
        }
    });
}

function setNickname() {
    const nick = document.getElementById('nicknameInput').value;
    if (!nick) return alert("請輸入暱稱");
    myNickname = nick; 
    initGrid(); 
    listenToRoom(); 
    showView('mainGameView');
}

// 修正：增加錯誤捕捉與確保 currentRoomId 存在
function pickCustomColor() {
    if (!currentRoomId) return alert("房間資訊遺失，請重新加入");
    const color = document.getElementById('colorPicker').value.toUpperCase();
    const colorKey = color.replace('#', '');
    
    console.log("正在嘗試鎖定顏色:", color); // 除錯用

    db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).transaction((currentValue) => {
        if (currentValue === null) {
            return myNickname; 
        }
        return; // 已被占用則返回 undefined 終止 transaction
    }, (error, committed, snapshot) => {
        if (error) {
            console.error("Transaction failed:", error);
            alert("伺服器同步失敗，請稍後再試");
        } else if (!committed) {
            alert(`這個顏色已經被 ${snapshot.val()} 捷足先登了！`);
        } else {
            // 成功鎖定
            myColor = color;
            updateColorUI(true);
        }
    });
}

function updateColorUI(isLocked) {
    document.getElementById('colorPicker').disabled = isLocked;
    document.getElementById('confirmColorBtn').classList.toggle('hidden', isLocked);
    document.getElementById('resetColorBtn').classList.toggle('hidden', !isLocked);
    const statusTag = document.getElementById('myColorStatus');
    statusTag.classList.toggle('hidden', !isLocked);
    if (isLocked) statusTag.style.color = myColor;
}

function resetMyColor() {
    if (!myColor) return;
    if (confirm("更換顏色將清空你目前標記的所有格子，確定嗎？")) {
        db.ref(`rooms/${currentRoomId}/colors/${myColor.replace('#', '')}`).remove();
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) {
                Object.keys(data).forEach(k => { 
                    if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); 
                });
            }
        });
        myColor = null;
        updateColorUI(false);
    }
}

function leaveRoom() {
    if (myColor && currentRoomId) {
        db.ref(`rooms/${currentRoomId}/colors/${myColor.replace('#', '')}`).remove();
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) {
                Object.keys(data).forEach(k => { 
                    if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); 
                });
            }
        });
    }
    if (currentRoomId) db.ref(`rooms/${currentRoomId}/grid`).off();
    currentRoomId = null; myNickname = ""; myColor = null;
    updateColorUI(false);
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);
    showView('startView');
}

function togglePlatform(f, p) {
    if (!myColor) return alert("請先選好顏色並點擊「確認顏色」！");
    const path = `${f}_${p}`, ref = db.ref(`rooms/${currentRoomId}/grid/${path}`);
    
    ref.once('value', snap => {
        const val = snap.val();
        if (val && val.color === myColor) {
            ref.remove();
        } else if (!val) {
            // 確保同層樓自己只能點一個
            db.ref(`rooms/${currentRoomId}/grid`).once('value', gSnap => {
                const gData = gSnap.val() || {};
                Object.keys(gData).forEach(k => { 
                    if (k.startsWith(f + "_") && gData[k].color === myColor) {
                        db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); 
                    }
                });
                ref.set({ color: myColor, nickname: myNickname });
            });
        }
    });
}

function listenToRoom() {
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snap => {
        document.querySelectorAll('.p-btn').forEach(b => { 
            b.style.backgroundColor = ""; 
            b.innerHTML = b.id.split('-')[2]; 
        });
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(k => {
                if (k === "init") return;
                const btn = document.getElementById(`btn-${k.replace('_', '-')}`);
                if (btn) {
                    btn.style.backgroundColor = data[k].color;
                    btn.innerHTML += `<span class="user-tag">${data[k].nickname}</span>`;
                }
            });
        }
    });
}

function clearAllPlatforms() { if (confirm("確定清空嗎？")) db.ref(`rooms/${currentRoomId}/grid`).set({ init: "system" }); }

function copyShareLink() {
    const link = window.location.origin + window.location.pathname + "?room=" + currentRoomId;
    navigator.clipboard.writeText(link).then(() => alert("連結已複製，傳給隊友吧！"));
}

function initGrid() {
    const tbody = document.getElementById('gridBody'); 
    tbody.innerHTML = "";
    for (let f = 10; f >= 1; f--) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="floor-label">F${f}</td>` + 
            [1,2,3,4].map(p => `<td><button class="p-btn" id="btn-${f}-${p}" onclick="togglePlatform(${f},${p})">${p}</button></td>`).join('');
        tbody.appendChild(tr);
    }
}
