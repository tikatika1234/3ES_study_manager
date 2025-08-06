// Firebaseの初期化設定（あなたのFirebaseコンソールの設定に置き換えてください）
const firebaseConfig = {
  apiKey: "AIzaSyAP2qW_nwiBbmrBQvjP6i69udDqpP8tbfM",
  authDomain: "esstudymanager.firebaseapp.com",
  projectId: "esstudymanager",
  storageBucket: "esstudymanager.firebasestorage.app",
  messagingSenderId: "9424358863",
  appId: "1:9424358863:web:b1e87b6aad908ed12596ba",
  measurementId: "G-4QGE07EM22"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素を取得
    const logoutBtn = document.getElementById('logoutBtn');
    const backToHomeBtn = document.getElementById('backToHomeBtn'); // 追加
    const userNameElement = document.getElementById('userName');
    const recordForm = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');

    // 認証状態の監視
    auth.onAuthStateChanged(user => {
        if (user) {
            // ログイン済みの場合
            userNameElement.textContent = user.displayName || user.email;
            loadRecords(user.uid);
        } else {
            // 未ログインの場合、ログインページにリダイレクト
            window.location.href = 'login.html';
        }
    });

    // フォーム送信時の処理（Firestoreへの書き込み）
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const date = document.getElementById('date').value;
        const subject = document.getElementById('subject').value;
        const time = parseInt(document.getElementById('time').value, 10);

        if (!date || !subject || isNaN(time) || time <= 0) {
            alert('すべての項目を正しく入力してください。');
            return;
        }

        try {
            await db.collection('users').doc(user.uid).collection('records').add({
                date,
                subject,
                time,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            recordForm.reset();
            loadRecords(user.uid);
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("データの記録中にエラーが発生しました。");
        }
    });

    // Firestoreから記録を読み込み、表示する関数
    const loadRecords = async (uid) => {
        try {
            recordsList.innerHTML = '<p class="text-gray-500 text-center">記録を読み込み中...</p>';
            const querySnapshot = await db.collection('users').doc(uid).collection('records')
                                        .orderBy('timestamp', 'desc')
                                        .get();
            
            recordsList.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const div = document.createElement('div');
                div.className = 'record-item p-3 border border-gray-200 rounded-md shadow-sm';
                div.innerHTML = `<p class="text-gray-800"><strong>${record.date}</strong>: ${record.subject} - ${record.time}分</p>`;
                recordsList.appendChild(div);
            });
        } catch (error) {
            console.error("Error fetching documents: ", error);
            recordsList.innerHTML = '<p class="text-red-500 text-center">データの読み込み中にエラーが発生しました。</p>';
        }
    };

    // ログアウトボタンのイベントリスナー
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            // ログアウト成功後、ログインページに遷移
            window.location.href = 'login.html';
        });
    });

    // ホームに戻るボタンのイベントリスナーを追加
    backToHomeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // 現在の日付をフォームに自動入力
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
});
