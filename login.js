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

document.addEventListener('DOMContentLoaded', () => {
    // DOM要素を取得
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const registerBtn = document.getElementById('registerBtn');
    const emailLoginBtn = document.getElementById('emailLoginBtn');
    const googleLoginBtn = document.getElementById('googleLoginBtn');

    // 認証状態の監視
    auth.onAuthStateChanged(user => {
        if (user) {
            // ログイン済みの場合、ホーム画面にリダイレクト
            window.location.href = 'index.html';
        }
    });

    // 新規登録ボタンのイベントリスナー
    registerBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await auth.createUserWithEmailAndPassword(email, password);
            alert('新規登録が完了しました！');
        } catch (error) {
            console.error("新規登録エラー: ", error);
            alert("新規登録中にエラーが発生しました: " + error.message);
        }
    });

    // メールアドレスログインボタンのイベントリスナー
    emailLoginBtn.addEventListener('click', async () => {
        const email = emailInput.value;
        const password = passwordInput.value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
            alert('ログインに成功しました！');
        } catch (error) {
            console.error("ログインエラー: ", error);
            alert("ログイン中にエラーが発生しました: " + error.message);
        }
    });

    // Googleログインボタンのイベントリスナー
    googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithRedirect(provider);
    });

    // リダイレクト結果の処理
    auth.getRedirectResult().then((result) => {
        if (result.credential) {
            console.log('Googleログインに成功しました！');
        }
    }).catch((error) => {
        console.error("Googleログインエラー: ", error);
        // エラーをユーザーに表示しない
    });
});
