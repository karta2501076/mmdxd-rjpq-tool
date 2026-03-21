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
    listenToColors(); 
    showView('mainGameView');
}

// 離開房間功能
function leaveRoom() {
    // 如果在遊戲中，先嘗試清除自己的顏色占用
    if (myColor && currentRoomId) {
        const colorKey = myColor.replace('#', '');
        db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).remove();
        // 清除自己畫的格子
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) Object.keys(data).forEach(k => { 
                if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); 
            });
        });
    }

    // 關閉 Firebase 監聽器，避免浪費連線資源
    if (currentRoomId) {
        db.ref(`rooms/${currentRoomId}/grid`).off();
        db.ref(`rooms/${currentRoomId}/colors`).off();
    }

    // 重設本地變數
    currentRoomId = null;
    myNickname = "";
    myColor = null;
    
    // 清除網址參數並回到起始畫面
    const url = new URL(window.location);
    url.searchParams.delete('room');
    window.history.pushState({}, '', url);
    
    showView('startView');
}

function selectColor(color) {
    if (myColor) return alert("請先重選釋放原顏色");
    const colorKey = color.replace('#', '');
    db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).transaction(val => val === null ? myNickname : undefined, (err, committed, snap) => {
        if (committed) { myColor = color; }
        else alert("已被搶走: " + snap.val());
    });
}

function resetMyColor() {
    if (!myColor) return;
    if (confirm("更換顏色將清空格子，確定嗎？")) {
        db.ref(`rooms/${currentRoomId}/colors/${myColor.replace('#', '')}`).remove();
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) Object.keys(data).forEach(k => { if (data[k].color === myColor) db.ref(`rooms/${currentRoomId}/grid/${k}`).remove(); });
        });
        myColor = null;
    }
}

function listenToColors() {
    db.ref(`rooms/${currentRoomId}/colors`).on('value', snap => {
        const taken = snap.val() || {};
        document.querySelectorAll('.color-btn').forEach(btn => {
            const c = btn.getAttribute('data-color'), owner = taken[c.replace('#','')];
            btn.classList.remove('taken', 'selected');
            if (owner === myNickname) { btn.classList.add('selected'); myColor = c; }
            else if (owner) btn.classList.add('taken');
        });
    });
}

function togglePlatform(f, p) {
    if (!myColor) return alert("請先選顏色");
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
