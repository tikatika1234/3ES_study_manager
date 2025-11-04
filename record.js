const API_URL = 'https://threees-study-manager.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(localStorage.getItem('userData'));
    const token = localStorage.getItem('token');

    if (!userData || !token) {
        window.location.href = 'login.html';
        return;
    }

    const recordForm = document.getElementById('recordForm');
    const userNameElement = document.getElementById('userName');
    userNameElement.textContent = userData.displayName || userData.email;

    // 学習記録の送信
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            date: document.getElementById('date').value,
            subjects: {
                国語: document.getElementById('japanese').value,
                数学: document.getElementById('math').value,
                理科: document.getElementById('science').value,
                社会: document.getElementById('social').value,
                その他: document.getElementById('other').value
            },
            comment: document.getElementById('dailyCommentText').value,
            commentType: document.querySelector('input[name="commentType"]:checked').value
        };

        try {
            const response = await fetch(`${API_URL}/api/records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('記録の保存に失敗しました');

            alert('学習記録を保存しました');
            loadRecords();
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    });

    // 記録の読み込み
    const loadRecords = async () => {
        try {
            const response = await fetch(`${API_URL}/api/records/${userData.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('記録の取得に失敗しました');

            const records = await response.json();
            displayRecords(records);
        } catch (error) {
            alert(`エラー: ${error.message}`);
        }
    };

    // 初期読み込み
    loadRecords();
});