document.addEventListener('DOMContentLoaded', () => {
    // ログインチェック
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');

    if (!token || !user) {
        // 未ログインならログイン画面へ
        window.location.href = 'login.html';
        return;
    }

    if (user.role !== 'student') {
        // 生徒以外は別画面へ
        window.location.href = 'teacher.html';
        return;
    }

    // ボタンイベント設定
    document.querySelector('.record-button')?.addEventListener('click', () => {
        window.location.href = 'record.html';
    });

    // ログアウトボタンがあれば設定
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // 日付表示は既存のまま
    const months = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
    const weekdays = ["日曜日","月曜日","火曜日","水曜日","木曜日","金曜日","土曜日"];
    const dayNumbers = [
        "一日","二日","三日","四日","五日","六日","七日","八日","九日","十日",
        "十一日","十二日","十三日","十四日","十五日","十六日","十七日","十八日","十九日","二十日",
        "二十一日","二十二日","二十三日","二十四日","二十五日","二十六日","二十七日","二十八日","二十九日","三十日",
        "三十一日"
    ];

    const today = new Date();
    document.querySelector('.month').textContent = months[today.getMonth()];
    document.querySelector('.day').textContent = dayNumbers[today.getDate() - 1];
    document.querySelector('.weekday').textContent = weekdays[today.getDay()];
});