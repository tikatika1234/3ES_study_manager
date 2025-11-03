// ...existing code...
async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.warn('[record.js] no token, redirect to login');
        window.location.href = 'login.html';
        return null;
    }
    try {
        const res = await fetch(`${API_BASE}/api/auth/me`, { headers: getHeaders() });
        console.log('[record.js] /api/auth/me status', res.status);
        const body = await res.text().catch(()=>null);
        console.log('[record.js] /api/auth/me body:', body);
        if (!res.ok) {
            // 詳細を見せてからリダイレクト
            console.error('[record.js] auth failed, will redirect', res.status, body);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return null;
        }
        const data = JSON.parse(body);
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
    } catch (err) {
        console.error('[record.js] auth check failed', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        return null;
    }
}
// ...existing code...
