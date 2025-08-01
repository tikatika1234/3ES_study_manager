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

// Firebaseサービスの初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const authUI = document.getElementById('auth-ui');
    const appContent = document.getElementById('app-content');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameElement = document.getElementById('userName');
    const recordForm = document.getElementById('recordForm');
    const recordsList = document.getElementById('recordsList');
    
    // 認証プロバイダの準備
    const provider = new firebase.auth.GoogleAuthProvider();

    // 認証状態の監視
    auth.onAuthStateChanged(user => {
        if (user) {
            // ログイン中のユーザーがいる場合
            authUI.classList.add('hidden');
            appContent.classList.remove('hidden');
            userNameElement.textContent = user.displayName;
            loadRecords(user.uid);
        } else {
            // ログイン中のユーザーがいない場合
            authUI.classList.remove('hidden');
            appContent.classList.add('hidden');
            recordsList.innerHTML = ''; // 記録リストをクリア
        }
    });

    // ログインボタンのクリックイベント
    loginBtn.addEventListener('click', () => {
        auth.signInWithPopup(provider);
    });

    // ログアウトボタンのクリックイベント
    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    // フォーム送信時の処理（Firestoreへの書き込み）
    recordForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const user = auth.currentUser;
        if (!user) return; // ユーザーがログインしていなければ何もしない

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
                timestamp: firebase.firestore.FieldValue.serverTimestamp() // 記録日時をサーバー側で自動生成
            });
            recordForm.reset();
            loadRecords(user.uid); // 記録リストを再読み込み
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("データの記録中にエラーが発生しました。");
        }
    });

    // 記録をFirestoreから読み込み、表示する関数
    const loadRecords = async (uid) => {
        try {
            recordsList.innerHTML = '読み込み中...';
            const querySnapshot = await db.collection('users').doc(uid).collection('records')
                                        .orderBy('date', 'desc')
                                        .get();
            
            recordsList.innerHTML = ''; // リストをクリア
            querySnapshot.forEach((doc) => {
                const record = doc.data();
                const div = document.createElement('div');
                div.className = 'record-item p-3 border border-gray-200 rounded-md shadow-sm';
                div.innerHTML = `<p class="text-gray-800"><strong>${record.date}</strong>: ${record.subject} - ${record.time}分</p>`;
                recordsList.appendChild(div);
            });
        } catch (error) {
            console.error("Error fetching documents: ", error);
            recordsList.innerHTML = 'データの読み込み中にエラーが発生しました。';
        }
    };
});
