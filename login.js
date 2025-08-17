// Firebaseの初期化設定
// ⭐︎この部分を、あなたのFirebaseプロジェクトの設定に必ず置き換えてください。
const firebaseConfig = {
  apiKey: "AIzaSyAP2qW_nwiBbmrBQvjP6i69udDqpP8tbfM",
  authDomain: "esstudymanager.firebaseapp.com",
  projectId: "esstudymanager",
  storageBucket: "esstudymanager.firebasestorage.app",
  messagingSenderId: "9424358863",
  appId: "1:9424358863:web:b1e87b6aad908ed12596ba",
  measurementId: "G-4QGE07EM22"
};

// Firebaseのサービスを初期化
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

console.log("login.js: スクリプトが読み込まれました。");

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded: DOMの読み込みが完了しました。");

    // 必要なDOM要素を取得
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');
    
    // ログインフォームの入力要素もIDで取得
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');

    // 新規登録フォームの入力要素もIDで取得
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupDisplayNameInput = document.getElementById('signup-displayName');


    // 認証状態の変更を監視するリスナー
    auth.onAuthStateChanged(async user => {
        if (user) {
            console.log("onAuthStateChanged: ユーザーがログインしています。UID:", user.uid);
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.role === 'teacher') {
                        console.log("onAuthStateChanged: 役割は'teacher'です。teacher.htmlにリダイレクトします。");
                        window.location.href = 'teacher.html';
                    } else {
                        console.log("onAuthStateChanged: 役割は'student'です。record.htmlにリダイレクトします。");
                        window.location.href = 'record.html';
                    }
                } else {
                    console.warn("onAuthStateChanged: Firestoreにユーザーデータが見つかりませんでした。生徒として扱います。");
                    window.location.href = 'record.html';
                }
            } catch (error) {
                console.error("onAuthStateChanged: ユーザー役割のチェック中にエラーが発生しました:", error);
                window.location.href = 'record.html';
            }
        } else {
            console.log("onAuthStateChanged: ユーザーはログアウトしています。");
        }
    });

    // ログインフォームと新規登録フォームの表示を切り替える
    if (showSignupBtn && showLoginBtn && loginForm && signupForm) {
        showSignupBtn.addEventListener('click', () => {
            console.log("showSignupボタンがクリックされました。新規登録フォームを表示します。");
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
        showLoginBtn.addEventListener('click', () => {
            console.log("showLoginボタンがクリックされました。ログインフォームを表示します。");
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // ログインフォームの送信処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            console.log("loginForm: フォームが送信されました。");
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            try {
                console.log("ログイン処理を開始します...");
                await auth.signInWithEmailAndPassword(email, password);
                console.log("ログイン成功！onAuthStateChangedリスナーがリダイレクトを処理します。");
            } catch (error) {
                alert(`ログインエラー: ${error.message}`);
                console.error("ログインエラー:", error);
            }
        });
    }

    // 新規登録フォームの送信処理
    if (signupForm) {
        console.log("signupForm: イベントリスナーをセットアップします。");
        signupForm.addEventListener('submit', async (e) => {
            console.log("signupForm: フォームが送信されました。");
            e.preventDefault();
            
            const email = signupEmailInput.value;
            const password = signupPasswordInput.value;
            const displayName = signupDisplayNameInput.value;

            try {
                console.log("新規ユーザー作成処理を開始します...");
                // パスワードの最低文字数チェック
                if (password.length < 6) {
                    alert('パスワードは6文字以上で設定してください。');
                    return;
                }
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                console.log("Firebase Authenticationでユーザーを作成しました。UID:", user.uid);
                
                // 表示名を更新
                await user.updateProfile({ displayName: displayName });
                console.log("ユーザーの表示名を更新しました:", displayName);
                
                // Firestoreへのデータ書き込みを開始
                console.log("Firestoreへのデータ書き込みを開始します。");
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: displayName,
                    role: 'student', // 新規登録時はデフォルトで生徒
                });
                console.log("Firestoreへの書き込みが成功しました。");
                
                alert('登録が完了しました。ログインしてください。');
                
                // 登録後にログインフォームに戻す
                if (loginForm && signupForm) {
                     signupForm.classList.add('hidden');
                     loginForm.classList.remove('hidden');
                     console.log("新規登録後にログインフォームに戻りました。");
                }
            } catch (error) {
                // エラーの原因をより詳しく出力
                alert(`登録エラー: ${error.message}`);
                console.error("新規登録エラー:", error);
            }
        });
    }
});
