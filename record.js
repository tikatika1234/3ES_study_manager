document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('[record.js] START init');

        // 明示的に Render の API を既定にする（record.html で上書き可能）
        const API_BASE = (window.API_BASE_URL && window.API_BASE_URL.trim()) || 'https://threees-study-manager.onrender.com';
        console.log('[record.js] API_BASE:', API_BASE);

        // DOM要素取得
        const logoutBtn = document.getElementById('logoutBtn');
        const backToHomeBtn = document.getElementById('backToHomeBtn');
        const userNameElement = document.getElementById('userName');
        const recordForm = document.getElementById('recordForm');
        const recordsList = document.getElementById('recordsList');
        const dateInput = document.getElementById('date');
        const subjects = ['国語', '数学', '理科', '社会', 'その他'];

        const signatureSection = document.getElementById('signatureSection');
        const signatureCanvas = document.getElementById('signatureCanvas');
        const clearCanvasBtn = document.getElementById('clearCanvasBtn');

        // ヘッダー生成（Authorization は token があるときのみ追加）
        const getHeaders = () => {
            const token = localStorage.getItem('token');
            console.log('[record.js] getHeaders - token exists:', !!token);
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            return headers;
        };

        // JWT ペイロードを安全にデコード（署名検証は行わない）
        const decodeJwt = (token) => {
            try {
                const parts = token.split('.');
                if (parts.length < 2) return null;
                const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                const json = decodeURIComponent(atob(base64).split('').map(c => {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                return JSON.parse(json);
            } catch (e) {
                console.warn('[record.js] decodeJwt failed', e);
                return null;
            }
        };

        // グローバルエラーキャッチ
        window.addEventListener('error', (e) => {
            console.error('[record.js] Global Error:', e.message, e.filename, e.lineno);
        });
        window.addEventListener('unhandledrejection', (ev) => {
            console.error('[record.js] Unhandled Promise Rejection:', ev.reason);
        });

        // 認証チェック：/api/auth/me が無ければ JWT をデコードしてフォールバック
        const checkAuth = async () => {
            console.log('[record.js] checkAuth - start');
            const token = localStorage.getItem('token');
            console.log('[record.js] checkAuth - token exists:', !!token);

            if (!token) {
                console.warn('[record.js] checkAuth - no token, redirecting to login');
                window.location.href = 'login.html';
                return null;
            }

            const url = `${API_BASE}/api/auth/me`;
            console.log('[record.js] checkAuth - fetch url:', url);

            try {
                const res = await fetch(url, { headers: getHeaders() });
                console.log('[record.js] checkAuth - status:', res.status);
                const responseText = await res.text().catch(() => null);
                console.log('[record.js] checkAuth - body:', responseText);

                if (res.status === 401 || res.status === 403) {
                    console.error('[record.js] checkAuth - unauthorized, clearing token and redirecting');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = 'login.html';
                    return null;
                }

                if (res.status === 404) {
                    // API に /api/auth/me が無い場合はトークンからユーザー情報を復元して続行
                    console.warn('[record.js] checkAuth - /api/auth/me 404. Falling back to decode token.');
                    const payload = decodeJwt(token);
                    if (!payload) {
                        console.error('[record.js] checkAuth - token decode failed, redirecting to login');
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = 'login.html';
                        return null;
                    }
                    const user = {
                        id: payload.id || payload.sub || payload.userId || null,
                        email: payload.email || payload.username || null,
                        display_name: payload.display_name || payload.name || payload.email || '',
                        role: payload.role || (payload.roles && payload.roles[0]) || 'student'
                    };
                    console.log('[record.js] checkAuth - recovered user from token:', user);
                    localStorage.setItem('user', JSON.stringify(user));
                    return user;
                }

                if (!res.ok) {
                    console.error('[record.js] checkAuth - unexpected status:', res.status);
                    throw new Error(`Authentication check failed (${res.status})`);
                }

                const data = JSON.parse(responseText || '{}');
                if (!data.user) {
                    console.error('[record.js] checkAuth - no user in response');
                    throw new Error('No user data in response');
                }

                console.log('[record.js] checkAuth - success, user:', data.user);
                localStorage.setItem('user', JSON.stringify(data.user));
                return data.user;

            } catch (err) {
                console.error('[record.js] checkAuth error:', err);
                // ネットワーク等のエラー発生時はトークンデコードでフォールバックを試みる
                const payload = decodeJwt(token);
                if (payload) {
                    const user = {
                        id: payload.id || payload.sub || payload.userId || null,
                        email: payload.email || payload.username || null,
                        display_name: payload.display_name || payload.name || payload.email || '',
                        role: payload.role || (payload.roles && payload.roles[0]) || 'student'
                    };
                    console.log('[record.js] checkAuth - recovered user from token after error:', user);
                    localStorage.setItem('user', JSON.stringify(user));
                    return user;
                }
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return null;
            }
        };

        // Canvasセットアップ
        function setupCanvas(canvas) {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#111827';

            let drawing = false;
            let lastX = 0;
            let lastY = 0;

            function start(e) {
                drawing = true;
                const rect = canvas.getBoundingClientRect();
                const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
                lastX = x; lastY = y;
            }

            function move(e) {
                if (!drawing) return;
                const rect = canvas.getBoundingClientRect();
                const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
                const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(x, y);
                ctx.stroke();
                lastX = x; lastY = y;
                e.preventDefault();
            }

            function end() { drawing = false; }

            canvas.addEventListener('mousedown', start);
            canvas.addEventListener('touchstart', start, { passive: true });
            window.addEventListener('mousemove', move);
            canvas.addEventListener('touchmove', move, { passive: false });
            window.addEventListener('mouseup', end);
            canvas.addEventListener('touchend', end);

            return {
                clear: () => ctx.clearRect(0, 0, canvas.width, canvas.height)
            };
        }

        let canvasController = null;
        if (signatureCanvas) canvasController = setupCanvas(signatureCanvas);
        if (clearCanvasBtn) clearCanvasBtn.addEventListener('click', () => { if (canvasController) canvasController.clear(); });

        function toggleCommentSection() {
            const type = document.querySelector('input[name="commentType"]:checked')?.value;
            if (type === 'signature') {
                signatureSection?.classList.remove('hidden');
                document.getElementById('dailyCommentText')?.classList.add('hidden');
            } else {
                signatureSection?.classList.add('hidden');
                document.getElementById('dailyCommentText')?.classList.remove('hidden');
            }
        }
        const commentRadios = document.querySelectorAll('input[name="commentType"]');
        commentRadios.forEach(r => r.addEventListener('change', toggleCommentSection));

        // 初期化
        const init = async () => {
            try {
                console.log('[record.js] init - starting');
                const user = await checkAuth();
                console.log('[record.js] init - auth check completed, user:', user);

                if (!user) {
                    console.warn('[record.js] init - no user after auth check');
                    return;
                }

                userNameElement.textContent = user.display_name || user.email || '';
                const today = new Date().toISOString().split('T')[0];
                if (dateInput) { dateInput.value = today; dateInput.max = today; }

                toggleCommentSection();
                await loadRecords();
                console.log('[record.js] init - completed');
            } catch (e) {
                console.error('[record.js] init error:', e);
                alert('初期化中にエラーが発生しました。ページを更新してください。');
            }
        };

        // 記録保存
        if (recordForm) {
            recordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const date = dateInput?.value;
                    if (!date) { alert('日付を選択してください'); return; }

                    const subjectTimes = {};
                    subjects.forEach(sub => {
                        const el = document.getElementById(sub);
                        if (!el) return;
                        const v = parseInt(el.value, 10) || 0;
                        if (v > 0) subjectTimes[sub] = v;
                    });

                    const commentType = document.querySelector('input[name="commentType"]:checked')?.value || 'text';
                    let comment = null;
                    if (commentType === 'text') comment = document.getElementById('dailyCommentText')?.value || null;
                    else if (signatureCanvas) comment = signatureCanvas.toDataURL();

                    console.log('[record.js] Saving record...', { date, subjectCount: Object.keys(subjectTimes).length, commentType });

                    const url = `${API_BASE}/api/records`;
                    console.log('[record.js] POST url:', url, 'headers:', getHeaders());

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({ date, subjects: subjectTimes, comment, comment_type: commentType })
                    });

                    console.log('[record.js] Save response status:', res.status);
                    const dataText = await res.text().catch(()=>null);
                    console.log('[record.js] Save response body:', dataText);
                    let data = {};
                    try { data = dataText ? JSON.parse(dataText) : {}; } catch(e){ data = { raw: dataText }; }

                    if (!res.ok) {
                        console.error('[record.js] Save failed:', res.status, data);
                        alert(data.error || `保存に失敗しました（${res.status}）`);
                        return;
                    }

                    alert('記録を保存しました');
                    await loadRecords();
                } catch (err) {
                    console.error('[record.js] Save error:', err);
                    alert('エラーが発生しました。コンソールを確認してください。');
                }
            });
        } else {
            console.warn('[record.js] recordForm not found');
        }

        // 記録取得
        const loadRecords = async () => {
            try {
                const url = `${API_BASE}/api/records`;
                console.log('[record.js] GET url:', url);
                const res = await fetch(url, { headers: getHeaders() });
                console.log('[record.js] Load records status:', res.status);
                const text = await res.text().catch(()=>null);
                console.log('[record.js] Load records body:', text);
                if (res.status === 404) {
                    console.warn('[record.js] GET /api/records 404 - endpoint not found');
                    // /api/records が無い場合は空画面を許容（または別途サーバー実装を確認）
                    if (recordsList) recordsList.innerHTML = '<p class="text-red-500">記録取得 API が見つかりません (404)。</p>';
                    return;
                }
                if (!res.ok) throw new Error(`記録の取得に失敗: ${res.status}`);
                const json = JSON.parse(text || 'null');
                let records = [];
                if (Array.isArray(json)) records = json;
                else if (Array.isArray(json?.dailyRecords)) records = json.dailyRecords;
                else if (Array.isArray(json?.records)) records = json.records;
                console.log('[record.js] Loaded records count:', records.length);
                displayRecords(records);
            } catch (err) {
                console.error('[record.js] Load records error:', err);
                if (recordsList) recordsList.innerHTML = '<p class="text-red-500">記録の読み込みに失敗しました。</p>';
            }
        };

        // displayRecords / getMondayOfWeek など既存処理
        const displayRecords = (records) => {
            if (!recordsList) return;
            if (!records || records.length === 0) {
                recordsList.innerHTML = '<p class="text-gray-500">記録がありません。</p>';
                return;
            }
            const weekly = new Map();
            records.forEach(r => {
                const rec = r || {};
                const subs = (typeof rec.subjects === 'string') ? JSON.parse(rec.subjects || '{}') : (rec.subjects || {});
                const week = getMondayOfWeek(rec.date);
                if (!weekly.has(week)) weekly.set(week, []);
                weekly.get(week).push({ ...rec, subjects: subs });
            });
            recordsList.innerHTML = '';
            Array.from(weekly.entries()).sort((a,b) => b[0].localeCompare(a[0])).forEach(([weekStart, weekRecords]) => {
                const div = document.createElement('div');
                div.className = 'mb-6 bg-white p-4 rounded shadow';
                let html = `<h3 class="font-bold mb-2">${weekStart} の週</h3>`;
                weekRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
                weekRecords.forEach(rec => {
                    const total = Object.values(rec.subjects || {}).reduce((s,v) => s + (parseInt(v,10) || 0), 0);
                    html += `<div class="mb-3 p-3 bg-gray-50 rounded"><p class="font-semibold">${rec.date}</p><ul class="list-disc list-inside text-sm mb-2">`;
                    for (const [sub, t] of Object.entries(rec.subjects || {})) html += `<li>${sub}: ${t}分</li>`;
                    html += `</ul><p class="text-right font-semibold">合計: ${total}分</p>`;
                    if (rec.comment) {
                        if ((rec.comment_type || rec.commentType) === 'text') html += `<p class="mt-2 text-gray-700">${rec.comment}</p>`;
                        else html += `<img class="mt-2 max-w-full" src="${rec.comment}" alt="手書きコメント">`;
                    }
                    if (rec.teacher_comment) html += `<div class="mt-2 p-2 bg-white border rounded"><p class="font-semibold">先生のコメント</p><p>${rec.teacher_comment}</p></div>`;
                    html += '</div>';
                });
                div.innerHTML = html;
                recordsList.appendChild(div);
            });
        };

        const getMondayOfWeek = (dateString) => {
            if (!dateString) return '';
            const d = new Date(dateString);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(d.setDate(diff)).toISOString().split('T')[0];
        };

        if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'login.html'; });
        if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => window.location.href = 'index.html');

        console.log('[record.js] Starting initialization...');
        init().catch(err => { console.error('[record.js] Fatal initialization error:', err); alert('アプリケーションの初期化に失敗しました。'); });

    } catch (e) {
        console.error('[record.js] Fatal error:', e);
        alert('予期せぬエラーが発生しました。');
    }
});
