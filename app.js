<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>超讚RJPQ小工具</title>
    <style>
        body { font-family: 'Segoe UI', sans-serif; background: #1a1a21; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 0; overflow: hidden; font-size: 1.2rem; }
        .container { background: #2d2d37; padding: 20px; border-radius: 18px; width: 440px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); display: flex; flex-direction: column; align-items: center; }
        h2 { margin: 0 0 10px 0; color: #fff; font-size: 1.6rem; }
        .hint-text { font-size: 0.75rem; color: #888; margin-bottom: 10px; }
        
        #startView, #createView, #joinView, #nicknameView { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
        #mainGameView { width: 100%; display: flex; flex-direction: column; align-items: center; }

        input { width: 90%; padding: 10px; border-radius: 10px; border: 1px solid #444; background: #1a1a21; color: #fff; font-size: 1.2rem; }
        button { border-radius: 10px; border: none; cursor: pointer; font-weight: bold; transition: 0.2s; }
        
        .primary-btn { background: #007bff; color: white; width: 100%; padding: 12px; font-size: 1.2rem; }
        .secondary-btn { background: #444; color: white; padding: 6px 10px; font-size: 0.85rem; }
        .exit-btn { background: #6c757d; color: white; padding: 6px 10px; font-size: 0.85rem; }
        
        .promo-btn { color: white; padding: 6px 12px; font-size: 0.85rem; text-decoration: none; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; }
        .yt-btn { background: #ff0000; }
        .yt-btn:hover { background: #cc0000; transform: scale(1.05); }
        .tw-btn { background: #9146ff; } 
        .tw-btn:hover { background: #772ce8; transform: scale(1.05); }

        .header-info { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
        .info-row { display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 8px; }
        .room-code span { color: #f1c40f; font-weight: bold; }
        .credit-info { font-size: 0.85rem; color: #aaa; background: rgba(0,0,0,0.3); padding: 5px 12px; border-radius: 8px; border: 1px solid #444; text-align: center; flex-grow: 1; line-height: 1.3; }
        .action-group { display: flex; gap: 5px; }

        .picker-bar { width: 100%; display: flex; gap: 10px; justify-content: center; align-items: center; background: #1a1a21; padding: 10px; border-radius: 12px; margin-bottom: 10px; }
        #colorPicker { width: 45px; height: 45px; border: none; background: none; cursor: pointer; padding: 0; }
        .status-tag { font-size: 0.85rem; padding: 4px 8px; border-radius: 6px; background: #444; font-weight: bold; }

        table { width: 100%; border-spacing: 4px; table-layout: fixed; }
        .floor-label { width: 45px; text-align: center; font-weight: bold; font-size: 1.1rem; color: #888; }
        .p-btn { width: 100%; height: 48px; background: #3c3c46; border: none; border-radius: 10px; color: #fff !important; font-weight: bold; cursor: pointer; font-size: 1.4rem; position: relative; overflow: hidden; }
        .user-tag { position: absolute; bottom: 2px; right: 2px; background: rgba(0, 0, 0, 0.75); color: white; font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; pointer-events: none; font-weight: normal; }
        .hidden { display: none !important; }
    </style>
</head>
<body>

<div class="container">
    <h2>超讚RJPQ小工具</h2>
    <div class="hint-text">按數字鍵 1-4 可由下往上自動填色</div>

    <div id="startView">
        <button class="primary-btn" onclick="showView('createView')">創建房間</button>
        <button class="primary-btn" onclick="showView('joinView')">加入房間</button>
    </div>

    <div id="createView" class="hidden">
        <input type="password" id="createPwd" placeholder="設定 4 碼密碼" maxlength="4">
        <button class="primary-btn" onclick="createRoom()">確認創建</button>
        <button class="secondary-btn" onclick="showView('startView')">返回</button>
    </div>

    <div id="joinView" class="hidden">
        <input type="text" id="joinId" placeholder="房間號碼">
        <input type="password" id="joinPwd" placeholder="密碼">
        <button class="primary-btn" onclick="joinRoom()">加入</button>
        <button class="secondary-btn" onclick="showView('startView')">返回</button>
    </div>

    <div id="nicknameView" class="hidden">
        <p>準備加入房間：<span id="roomIdDisplay" style="color:#f1c40f">------</span></p>
        <input type="text" id="nicknameInput" placeholder="輸入你的暱稱" maxlength="6">
        <button class="primary-btn" onclick="setNickname()">開始同步</button>
        <button class="secondary-btn" onclick="leaveRoom()">取消</button>
    </div>

    <div id="mainGameView" class="hidden">
        <div class="header-info">
            <div class="info-row">
                <div class="room-code">房間：<span id="activeRoomId">------</span></div>
                <a href="https://www.youtube.com/@yulihong22" target="_blank" class="promo-btn yt-btn">咪咪蛋YT頻道</a>
                <a href="https://www.twitch.tv/yulihong22" target="_blank" class="promo-btn tw-btn">咪咪蛋Twitch頻道</a>
            </div>
            <div class="info-row">
                <div class="credit-info">公會: MMDxD | 製作: 咖塔</div>
                <div class="action-group">
                    <button class="secondary-btn" style="background:#28a745;" onclick="copyShareLink()">分享</button>
                    <button class="secondary-btn" onclick="clearAllPlatforms()">清空</button>
                    <button class="exit-btn" onclick="leaveRoom()">離開</button>
                </div>
            </div>
        </div>

        <div class="picker-bar">
            <span>選色：</span>
            <input type="color" id="colorPicker" value="#00EC00">
            <button id="confirmColorBtn" class="secondary-btn" style="background:#007bff;" onclick="pickCustomColor()">確認</button>
            <button id="resetColorBtn" class="hidden secondary-btn" onclick="resetMyColor()">重選</button>
            <div id="myColorStatus" class="hidden status-tag">已鎖定顏色</div>
        </div>

        <table>
            <tbody id="gridBody"></tbody>
        </table>
    </div>
</div>

<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-database-compat.js"></script>
<script src="app.js"></script>
</body>
</html>
