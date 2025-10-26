// ...existing code...
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('[record.js] loaded');
        const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
        console.log('[record.js] API_BASE:', API_BASE);

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

        const getHeaders = () => {
            const headers = { 'Content-Type': 'application/json' };
            const token = localStorage.getItem('token');
            console.log('[record.js] token present:', !!token);
            if (token) headers['Authorization'] = `Bearer ${token}`;
            return headers;
        };

        window.addEventListener('error', (e) => {
            console.error('[record.js] window error', e.message, e.filename, e.lineno);
        });
        window.addEventListener('unhandledrejection', (ev) => {
            console.error('[record.js] unhandledrejection', ev.reason);
        });

        // 認証チェック（サーバー確認）
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                console.warn('[record.js] no token, redirect to login');
                window.location.href = 'login.html';
                return null;
            }
            try {
                const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
                console.log('[record.js] /api/auth/me status', res.status);
                if (!res.ok) throw new Error(`not authenticated (${res.status})`);
                const data = await res.json();
                localStorage.setItem('user', JSON.stringify(data.user));
                return data.user;
            } catch (err) {
                console.error('auth check failed', err);
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
                return null;
            }
        };

        // canvas setup unchanged (keeps same behavior)
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
                clear: () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
            };
        }

        let canvasController = null;
        if (signatureCanvas) {
            canvasController = setupCanvas(signatureCanvas);
        }
        if (clearCanvasBtn) {
            clearCanvasBtn.addEventListener('click', () => {
                if (canvasController) canvasController.clear();
            });
        }

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
        const commentRadios = document.querySelectorAll('input[name="commentType"]') || [];
        commentRadios.forEach(r => r.addEventListener('change', toggleCommentSection));

        const init = async () => {
            try {
                const user = await checkAuth();
                if (!user) return;
                userNameElement.textContent = user.display_name || user.email || '';
                const today = new Date().toISOString().split('T')[0];
                if (dateInput) { dateInput.value = today; dateInput.max = today; }
                toggleCommentSection();
                await loadRecords();
            } catch (e) {
                console.error('[record.js] init error', e);
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
                    if (commentType === 'text') {
                        comment = document.getElementById('dailyCommentText')?.value || null;
                    } else {
                        if (signatureCanvas) {
                            comment = signatureCanvas.toDataURL();
                        }
                    }

                    console.log('[record.js] submit payload', { date, subjectTimes, commentType, commentPreview: comment ? comment.slice(0,50) : null });

                    const res = await fetch(`${API_BASE}/api/records`, {
                        method: 'POST',
                        headers: getHeaders(),
                        body: JSON.stringify({
                            date,
                            subjects: subjectTimes,
                            comment,
                            comment_type: commentType
                        })
                    });

                    console.log('[record.js] POST /api/records status', res.status);
                    const data = await res.json().catch(()=>({}));
                    if (!res.ok) {
                        console.error('[record.js] save failed', res.status, data);
                        alert(data.error || `保存に失敗しました（${res.status}）`);
                        return;
                    }
                    alert('記録を保存しました');
                    await loadRecords();
                } catch (err) {
                    console.error('[record.js] submit error', err);
                    alert('ネットワークエラーが発生しました。コンソールを確認してください。');
                }
            });
        } else {
            console.warn('[record.js] recordForm not found in DOM');
        }

        const loadRecords = async () => {
            try {
                const res = await fetch(`${API_BASE}/api/records`, { headers: getHeaders() });
                console.log('[record.js] GET /api/records status', res.status);
                if (!res.ok) throw new Error(`fetch records failed ${res.status}`);
                const json = await res.json();
                let records = [];
                if (Array.isArray(json)) records = json;
                else if (Array.isArray(json.dailyRecords)) records = json.dailyRecords;
                else if (Array.isArray(json.records)) records = json.records;
                console.log('[record.js] loaded records count', records.length);
                displayRecords(records);
            } catch (err) {
                console.error('loadRecords error', err);
                if (recordsList) recordsList.innerHTML = '<p class="text-red-500">記録の読み込みに失敗しました。</p>';
            }
        };

        const displayRecords = (records) => {
            if (!records || records.length === 0) {
                if (recordsList) recordsList.innerHTML = '<p class="text-gray-500">記録がありません。</p>';
                return;
            }
            const weekly = new Map();
            records.forEach(r => {
                const rec = r || {};
                const subs = (typeof rec.subjects === 'string') ? JSON.parse(rec.subjects || '{}') : (rec.subjects || {});
                const week = getMondayOfWeek(rec.date);
                if (!weekly.has(week)) weekly.set(week, []);
                weekly.get(week).push(Object.assign({}, rec, { subjects: subs }));
            });

            recordsList.innerHTML = '';
            Array.from(weekly.entries()).sort((a,b)=>b[0].localeCompare(a[0])).forEach(([weekStart, weekRecords])=>{
                const div = document.createElement('div');
                div.className = 'mb-6 bg-white p-4 rounded shadow';
                let html = `<h3 class="font-bold mb-2">${weekStart} の週</h3>`;
                weekRecords.sort((a,b)=> new Date(b.date) - new Date(a.date));
                weekRecords.forEach(rec=>{
                    const total = Object.values(rec.subjects || {}).reduce((s,v)=>s+(parseInt(v,10)||0),0);
                    html += `<div class="mb-3 p-3 bg-gray-50 rounded">
                        <p class="font-semibold">${rec.date}</p>
                        <ul class="list-disc list-inside text-sm mb-2">`;
                    for (const [sub, t] of Object.entries(rec.subjects || {})) {
                        html += `<li>${sub}: ${t}分</li>`;
                    }
                    html += `</ul><p class="text-right font-semibold">合計: ${total}分</p>`;
                    if (rec.comment) {
                        if ((rec.comment_type || rec.commentType) === 'text') {
                            html += `<p class="mt-2 text-gray-700">${rec.comment}</p>`;
                        } else {
                            html += `<img class="mt-2 max-w-full" src="${rec.comment}" alt="手書きコメント">`;
                        }
                    }
                    if (rec.teacher_comment) {
                        html += `<div class="mt-2 p-2 bg-white border rounded"><p class="font-semibold">先生のコメント</p><p>${rec.teacher_comment}</p></div>`;
                    }
                    html += `</div>`;
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

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            });
        }
        if (backToHomeBtn) backToHomeBtn.addEventListener('click', ()=> window.location.href = 'index.html');

        init();
    } catch (e) {
        console.error('[record.js] top-level error', e);
    }
});
// ...existing code...
