const firebaseConfig = {
  apiKey: "AIzaSyCpJmhpPRxgTSTpZi38DHCaV8ZaLhuKKTc",
  authDomain: "rjpq-tool-2ee82.firebaseapp.com",
  databaseURL: "https://rjpq-tool-2ee82-default-rtdb.firebaseio.com", 
  projectId: "rjpq-tool-2ee82",
  storageBucket: "rjpq-tool-2ee82.firebasestorage.app",
  messagingSenderId: "349150642845",
  appId: "1:349150642845:web:14fe4a135278f82cc40a74"
};

// 初始化 Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
let currentRoomId = null, myNickname = "", myColor = null;

window.onload = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('room')) { 
        currentRoomId = params.get('room'); 
        showView('nicknameView'); 
    }

    // 鍵盤快捷鍵監聽器
    window.addEventListener('keydown', (e) => {
        // 只有在遊戲畫面、已選色、且沒在輸入文字時才觸發
        if (currentRoomId && myColor && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
            if (['1', '2', '3', '4'].includes(e.key)) {
                autoFillNextFloor(parseInt(e.key));
            }
        }
    });
};

function showView(viewId) {
    ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    
    if (currentRoomId) {
        const roomIdDisplay = document.getElementById('roomIdDisplay');
        const activeRoomId = document.getElementById('activeRoomId');
        if (roomIdDisplay) roomIdDisplay.innerText = currentRoomId;
        if (activeRoomId) activeRoomId.innerText = currentRoomId;
    }
}

function createRoom() {
    const pwdInput = document.getElementById('createPwd');
    const pwd = pwdInput ? pwdInput.value : "";
    if (pwd.length !== 4) return alert("請輸入 4 位數密碼");
    
    const id = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = id;
    
    // 初始化房間節點以確保 Transaction 正常運作
    db.ref('rooms/' + id).set({ 
        password: pwd,
        colors: { init: "system" },
        grid: { init: "system" }
    }).then(() => {
        showView('nicknameView');
    }).catch(err => {
        console.error("創建失敗:", err);
        alert("創建房間失敗，請檢查網路或 Firebase 設定");
    });
}

function joinRoom() {
    const id = document.getElementById('joinId').value;
    const pwd = document.getElementById('joinPwd').value;
    db.ref('rooms/' + id).once('value', snap => {
        const data = snap.val();
        if (data && data.password === pwd) { 
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

function pickCustomColor() {
    if (!currentRoomId) return alert("房間遺失，請重新進入");
    const color = document.getElementById('colorPicker').value.toUpperCase();
    const colorKey = color.replace('#', '');
    
    // 檢查顏色是否被占用
    db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).transaction((val) => {
        if (val === null) return myNickname; 
        return; 
    }, (err, committed, snap) => {
        if (err) alert("選色失敗，請重試");
        else if (!committed) alert(`這個顏色已被 ${snap.val()} 使用囉！`);
        else {
            myColor = color;
            updateColorUI(true);
        }
    });
}

function updateColorUI(isLocked) {
    document.getElementById('colorPicker').disabled = isLocked;
    document.getElementById('confirmColorBtn').classList.toggle('hidden', isLocked);
    document.getElementById('resetColorBtn').classList.toggle('hidden', !isLocked);
    const status = document.getElementById('myColorStatus');
    status.classList.toggle('hidden', !isLocked);
    if (isLocked) status.style.color = myColor;
}

function resetMyColor() {
    if (!myColor) return;
    if (confirm("更換顏色將清空你目前的所有標記，確定嗎？")) {
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
    if (currentRoomId && !confirm("確定要離開房間嗎？這會清除你的所有標記。")) return;

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

// 依序填色邏輯 (從 F1 往上找第一個空位)
function autoFillNextFloor(platformNum) {
    db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
        const gridData = snap.val() || {};
        let targetFloor = null;
        for (let f = 1; f <= 10; f++) {
            let alreadyFilled = false;
            for (let p = 1; p <= 4; p++) {
                if (gridData[`${f}_${p}`] && gridData[`${f}_${p}`].color === myColor) {
                    alreadyFilled = true;
                    break;
                }
            }
            if (!alreadyFilled) {
                targetFloor = f;
                break;
            }
        }
        if (targetFloor) togglePlatform(targetFloor, platformNum);
        else console.log("所有樓層皆已填色");
    });
}

function togglePlatform(f, p) {
    if (!myColor) return alert("請先選好顏色並點擊「確認顏色」！");
    const path = `${f}_${p}`, ref = db.ref(`rooms/${currentRoomId}/grid/${path}`);
    
    ref.once('value', snap => {
        const val = snap.val();
        if (val && val.color === myColor) {
            ref.remove();
        } else if (!val) {
            // 同樓層取代邏輯
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

function clearAllPlatforms() { if (confirm("確定清空所有人的標記嗎？")) db.ref(`rooms/${currentRoomId}/grid`).set({ init: "system" }); }

function copyShareLink() {
    const link = window.location.origin + window.location.pathname + "?room=" + currentRoomId;
    navigator.clipboard.writeText(link).then(() => alert("連結已複製"));
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
