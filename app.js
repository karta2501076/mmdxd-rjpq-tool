// Firebase 配置
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

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

let currentRoomId = null;
let myNickname = "";
let myColor = null;

window.onload = function() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) { currentRoomId = room; showView('nicknameView'); }
};

function showView(viewId) {
    const views = ['startView', 'createView', 'joinView', 'nicknameView', 'mainGameView'];
    views.forEach(id => document.getElementById(id).classList.add('hidden'));
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
    const id = document.getElementById('joinId').value;
    const pwd = document.getElementById('joinPwd').value;
    db.ref('rooms/' + id).once('value', snap => {
        if (snap.val() && snap.val().password === pwd) {
            currentRoomId = id;
            showView('nicknameView');
        } else alert("房號或密碼錯誤");
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

// 顏色占用：使用 transaction 確保絕對唯一
function selectColor(color) {
    if (myColor) return alert("你已經有顏色了！更換前請先點擊重選。");

    const colorKey = color.replace('#', '');
    const colorRef = db.ref(`rooms/${currentRoomId}/colors/${colorKey}`);

    colorRef.transaction((currentValue) => {
        if (currentValue === null) {
            return myNickname; // 沒人佔用，寫入我的名字
        } else {
            return; // 已經有人了，取消交易
        }
    }, (error, committed, snapshot) => {
        if (committed) {
            myColor = color;
            console.log("成功取得顏色:", color);
        } else {
            alert(`已被搶走！選取者: ${snapshot.val()}`);
        }
    });
}

function resetMyColor() {
    if (!myColor) return;
    if (confirm("更換顏色將清空你目前填寫的所有格子，確定嗎？")) {
        const colorKey = myColor.replace('#', '');
        db.ref(`rooms/${currentRoomId}/colors/${colorKey}`).remove();
        
        db.ref(`rooms/${currentRoomId}/grid`).once('value', snap => {
            const data = snap.val();
            if (data) {
                Object.keys(data).forEach(key => {
                    if (data[key].color === myColor) {
                        db.ref(`rooms/${currentRoomId}/grid/${key}`).remove();
                    }
                });
            }
        });
        myColor = null;
    }
}

function listenToColors() {
    db.ref(`rooms/${currentRoomId}/colors`).on('value', snap => {
        const takenData = snap.val() || {};
        document.querySelectorAll('.color-btn').forEach(btn => {
            const btnColor = btn.getAttribute('data-color');
            const btnColorKey = btnColor.replace('#', '');
            const owner = takenData[btnColorKey];

            btn.classList.remove('taken', 'selected');
            if (owner) {
                if (owner === myNickname) {
                    btn.classList.add('selected');
                    myColor = btnColor;
                } else {
                    btn.classList.add('taken');
                }
            }
        });
    });
}

function togglePlatform(f, p) {
    if (!myColor) return alert("請先選顏色！");
    const gridRef = db.ref(`rooms/${currentRoomId}/grid`);
    gridRef.once('value', snap => {
        const gridData = snap.val() || {};
        const target = gridData[`${f}_${p}`];

        if (target && target.color === myColor) {
            db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`).remove();
            return;
        }
        if (target && target.color !== myColor) return; 

        for (let key in gridData) {
            if (key.startsWith(`${f}_`) && gridData[key].color === myColor) {
                db.ref(`rooms/${currentRoomId}/grid/${key}`).remove();
            }
        }
        db.ref(`rooms/${currentRoomId}/grid/${f}_${p}`).set({ color: myColor, nickname: myNickname });
    });
}

function listenToRoom() {
    db.ref(`rooms/${currentRoomId}/grid`).on('value', snapshot => {
        document.querySelectorAll('.p-btn').forEach(btn => {
            btn.style.backgroundColor = ""; 
            btn.classList.remove('disabled');
            const oldTag = btn.querySelector('.user-tag');
            if (oldTag) oldTag.remove();
        });
        const data = snapshot.val();
        if (data) {
            Object.keys(data).forEach(key => {
                const btn = document.getElementById(`btn-${key.replace('_', '-')}`);
                if (btn) {
                    btn.style.backgroundColor = data[key].color;
                    const tag = document.createElement('span');
                    tag.className = 'user-tag'; tag.innerText = data[key].nickname;
                    btn.appendChild(tag);
                    if (data[key].color !== myColor) btn.classList.add('disabled');
                }
            });
        }
    });
}

function clearAllPlatforms() {
    if (confirm("確定清空嗎？")) db.ref(`rooms/${currentRoomId}/grid`).remove();
}

function copyShareLink() {
    const url = window.location.origin + window.location.pathname + "?room=" + currentRoomId;
    navigator.clipboard.writeText(url).then(() => alert("連結已複製！"));
}

function initGrid() {
    const tbody = document.getElementById('gridBody');
    tbody.innerHTML = "";
    for (let f = 10; f >= 1; f--) {
        const tr = document.createElement('tr');
        const label = document.createElement('td');
        label.className = "floor-label"; label.innerText = "F" + f;
        tr.appendChild(label);
        for (let p = 1; p <= 4; p++) {
            const td = document.createElement('td');
            const btn = document.createElement('button');
            btn.className = "p-btn"; btn.innerText = p; btn.id = `btn-${f}-${p}`;
            btn.onclick = () => togglePlatform(f, p);
            td.appendChild(btn); tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}
