document.addEventListener('DOMContentLoaded', () => {
    // API設定（本番URLをデフォルトに）
    const API_BASE = 'https://threees-study-manager.onrender.com';
    
    // DOM要素取得
    const logoutBtn = document.getElementById('logoutBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn');
    const userNameElement = document.getElementById('userName');
    const recordForm = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');
    const dateInput = document.getElementById('date');
    const subjects = ['国語', '数学', '理科', '社会', 'その他'];
    
    // 共通ヘッダー
    const getHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    // 認証チェック
    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        const savedUser = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (!token || !savedUser) {
            window.location.href = 'login.html';
            return null;
        }
        return savedUser;
    };

    // Canvas機能
    const setupCanvas = (canvas) => {
        if (!canvas) return null;
        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#111827';
        
        let drawing = false;
        let lastX = 0, lastY = 0;
        
        const draw = (e, start) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            
            if (start) {
                drawing = true;
                [lastX, lastY] = [x, y];
                return;
            }
            
            if (!drawing) return;
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            [lastX, lastY] = [x, y];
        };
        
        canvas.addEventListener('mousedown', e => draw(e, true));
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', () => drawing = false);
        canvas.addEventListener('mouseleave', () => drawing = false);
        
        return {
            clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height)
        };
    };

    // 記録の保存
    const saveRecord = async (data) => {
        const res = await fetch(`${API_BASE}/api/records`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: '保存に失敗しました' }));
            throw new Error(error.error || `保存に失敗しました (${res.status})`);
        }
        
        return await res.json();
    };

    // 記録の取得
    const loadRecords = async () => {
        const res = await fetch(`${API_BASE}/api/records`, {
            headers: getHeaders()
        });
        
        if (!res.ok) {
            throw new Error(`記録の取得に失敗しました (${res.status})`);
        }
        
        const data = await res.json();
        return Array.isArray(data) ? data : 
               Array.isArray(data?.dailyRecords) ? data.dailyRecords :
               Array.isArray(data?.records) ? data.records : [];
    };

    // 記録の表示
    const displayRecords = (records) => {
        if (!recordsList) return;
        
        if (!records?.length) {
            recordsList.innerHTML = '<p class="text-gray-500">記録がありません</p>';
            return;
        }
        
        const weekly = new Map();
        records.forEach(rec => {
            const subs = typeof rec.subjects === 'string' ? JSON.parse(rec.subjects) : rec.subjects;
            const week = getWeekStart(rec.date);
            if (!weekly.has(week)) weekly.set(week, []);
            weekly.get(week).push({ ...rec, subjects: subs });
        });
        
        recordsList.innerHTML = Array.from(weekly.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([week, weekRecords]) => `
                <div class="mb-6 bg-white p-4 rounded shadow">
                    <h3 class="font-bold mb-2">${week} の週</h3>
                    ${weekRecords.sort((a, b) => new Date(b.date) - new Date(a.date))
                        .map(rec => `
                            <div class="mb-3 p-3 bg-gray-50 rounded">
                                <p class="font-semibold">${rec.date}</p>
                                <ul class="list-disc list-inside text-sm mb-2">
                                    ${Object.entries(rec.subjects || {})
                                        .map(([sub, time]) => `<li>${sub}: ${time}分</li>`)
                                        .join('')}
                                </ul>
                                <p class="text-right font-semibold">
                                    合計: ${Object.values(rec.subjects || {})
                                        .reduce((sum, time) => sum + (parseInt(time, 10) || 0), 0)}分
                                </p>
                                ${rec.comment ? `
                                    <div class="mt-2">
                                        ${(rec.comment_type || rec.commentType) === 'text' 
                                            ? `<p class="text-gray-700">${rec.comment}</p>`
                                            : `<img src="${rec.comment}" alt="手書き" class="max-w-full">`}
                                    </div>
                                ` : ''}
                                ${rec.teacher_comment ? `
                                    <div class="mt-2 p-2 bg-white border rounded">
                                        <p class="font-semibold">先生のコメント</p>
                                        <p>${rec.teacher_comment}</p>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                </div>
            `).join('');
    };

    // 週初めの日付を取得
    const getWeekStart = (dateString) => {
        const date = new Date(dateString);
        const day = date.getDay();
        date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
        return date.toISOString().split('T')[0];
    };

    // 初期化
    const init = async () => {
        try {
            const user = await checkAuth();
            if (!user) return;

            // ユーザー名表示
            userNameElement.textContent = user.display_name || user.email;

            // 今日の日付をセット
            const today = new Date().toISOString().split('T')[0];
            if (dateInput) {
                dateInput.value = today;
                dateInput.max = today;
            }

            // 記録を読み込んで表示
            const records = await loadRecords();
            displayRecords(records);

        } catch (error) {
            console.error('初期化エラー:', error);
            alert(error.message);
        }
    };

    // イベントリスナー設定
    if (recordForm) {
        recordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                // 科目ごとの学習時間を収集
                const subjects = {};
                ['国語', '数学', '理科', '社会', 'その他'].forEach(subject => {
                    const time = parseInt(document.getElementById(subject)?.value || '0', 10);
                    if (time > 0) subjects[subject] = time;
                });

                // コメント取得
                const commentType = document.querySelector('input[name="commentType"]:checked')?.value || 'text';
                let comment = null;
                
                if (commentType === 'text') {
                    comment = document.getElementById('dailyCommentText')?.value || null;
                } else {
                    const canvas = document.getElementById('signatureCanvas');
                    if (canvas) comment = canvas.toDataURL();
                }

                // 保存実行
                await saveRecord({
                    date: dateInput.value,
                    subjects,
                    comment,
                    comment_type: commentType
                });

                alert('記録を保存しました');
                
                // 再読み込み
                const records = await loadRecords();
                displayRecords(records);

            } catch (error) {
                console.error('保存エラー:', error);
                alert(error.message);
            }
        });
    }

    // キャンバス初期化
    const canvas = document.getElementById('signatureCanvas');
    const canvasCtrl = canvas ? setupCanvas(canvas) : null;
    
    if (canvasCtrl) {
        document.getElementById('clearCanvasBtn')?.addEventListener('click', () => {
            canvasCtrl.clear();
        });
    }

    // コメント入力方法の切り替え
    document.querySelectorAll('input[name="commentType"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const isSignature = radio.value === 'signature';
            document.getElementById('signatureSection')?.classList.toggle('hidden', !isSignature);
            document.getElementById('dailyCommentText')?.classList.toggle('hidden', isSignature);
        });
    });

    // ログアウト処理
    logoutBtn?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // ホームに戻る
    backToHomeBtn?.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // 初期化実行
    init();
});