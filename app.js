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
    if (params.get('room')) { currentRoomId = params.get('room'); showView('nicknameView'); }
};

function showView(viewId) {
    ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');
    if (currentRoomId) {
        document.getElementById('roomIdDisplay').innerText = currentRoomId;
        document.getElementById('activeRoomId').innerText = currentRoomId;
    }
}

function createRoom() {
    const pwd = document.getElementById('createPwd').value;
    if (pwd.length !== 4) return alert("請輸入 4 位數密碼");
    const id = Math.floor(1000 + Math.random() * 9000).toString();
    currentRoomId = id;
    db.ref('rooms/' + id).set({ password: pwd }).then(() => showView('nicknameView'));
}

function joinRoom() {
    const id = document.getElementById('joinId').value, pwd = document.getElementById('joinPwd').value;
    db.ref('rooms/' + id).once('value', snap => {
        if (snap.val() && snap.val().password === pwd) { currentRoomId = id; showView('nicknameView'); }
        else alert("房號或密碼錯誤");
    });
}

function setNickname() {
    const nick = document.getElementById('nicknameInput').value;
    if (!nick) return alert("請輸入暱稱");
    myNickname = nick; 
    initGrid(); 
    listenToRoom(); 
    // 調色盤模式下，不需要持續監聽所有顏色占用，改為點擊確認時檢查
    showView('mainGameView');
}

// 選擇自定義顏色
function pickCustomColor() {
    const color = document.getElementById('colorPicker').value.toUpperCase();
    const colorKey = color.replace('#', '');
    
    // 使用 transaction 檢查這個 HEX 色碼是否被別人用了
    db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).transaction(val => {
        if (val === null) return myNickname; // 沒人選，我要了
        return; // 已經有人選了，取消交易
    }, (err, committed, snap) => {
        if (committed) {
            myColor = color;
            updateColorUI(true);
        } else {
            alert(`這個顏色已經被 ${snap.val()} 捷足先登了！換一個吧。`);
        }
    });
}

// 更新顏色選取介面狀態
function updateColorUI(isLocked) {
    document.getElementById('colorPicker').disabled = isLocked;
    document.getElementById('confirmColorBtn').classList.toggle('hidden', isLocked);
    document.getElementById('resetColorBtn').classList.toggle('hidden', !isLocked);
    document.getElementById('myColorStatus').classList.toggle('hidden', !isLocked);
    if (isLocked) document.getElementById('myColorStatus').style.color = myColor;
}

function resetMyColor() {
    if (!myColor) return;
    if (confirm("更換顏色將清空你目前標記的所有格子，確定嗎？")) {
        // 釋放顏色占用
        db.ref(`rooms/${currentRoomId}/colors/${myColor.replace('#', '')}`).remove();
        // 清空格子
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) Object.keys(data).forEach(k => { if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); });
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
            if (data) Object.keys(data).forEach(k => { if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); });
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
        if (val && val.color === myColor) ref.remove();
        else if (!val) {
            db.ref(`rooms/${currentRoomId}/grid`).once('value', gSnap => {
                const gData = gSnap.val() || {};
                Object.keys(gData).forEach(k => { if (k.startsWith(f + "_") && gData[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); });
                ref.set({ color: myColor, nickname: myNickname });
            });
        }
    });
}

function listenToRoom() {
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snap => {
        document.querySelectorAll('.p-btn').forEach(b => { b.style.backgroundColor = ""; b.innerHTML = b.id.split('-')[2]; });
        const data = snap.val();
        if (data) Object.keys(data).forEach(k => {
            const btn = document.getElementById(`btn-${k.replace('_', '-')}`);
            if (btn) {
                btn.style.backgroundColor = data[k].color;
                btn.innerHTML += `<span class="user-tag">${data[k].nickname}</span>`;
            }
        });
    });
}

function clearAllPlatforms() { if (confirm("確定清空嗎？")) db.ref(`rooms/${currentRoomId}/grid`).remove(); }
function copyShareLink() { navigator.clipboard.writeText(window.location.origin + window.location.pathname + "?room=" + currentRoomId).then(() => alert("連結已複製")); }

function initGrid() {
    const tbody = document.getElementById('gridBody'); tbody.innerHTML = "";
    for (let f = 10; f >= 1; f--) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="floor-label">F${f}</td>` + [1,2,3,4].map(p => `<td><button class="p-btn" id="btn-${f}-${p}" onclick="togglePlatform(${f},${p})">${p}</button></td>`).join('');
        tbody.appendChild(tr);
    }
}
