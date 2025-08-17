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
    
    // ログインフォームの入力要素
    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');

    // 新規登録フォームの入力要素
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
                    console.log("ユーザーデータ:", userData);
                    if (userData.role === 'teacher') {
                        window.location.href = 'teacher.html';
                    } else {
                        window.location.href = 'record.html';
                    }
                } else {
                    console.warn("Firestoreにユーザーデータが存在しません。生徒扱いでrecord.htmlへ遷移します。");
                    window.location.href = 'record.html';
                }
            } catch (error) {
                console.error("ユーザー役割のチェック中にエラー:", error);
                window.location.href = 'record.html';
            }
        } else {
            console.log("onAuthStateChanged: ユーザーはログアウトしています。");
        }
    });

    // ログインフォームと新規登録フォームの表示を切り替え
    if (showSignupBtn && showLoginBtn && loginForm && signupForm) {
        showSignupBtn.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
        });
        showLoginBtn.addEventListener('click', () => {
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
    }

    // ログイン処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value;
            const password = loginPasswordInput.value;
            try {
                console.log("ログイン処理開始...");
                await auth.signInWithEmailAndPassword(email, password);
                console.log("ログイン成功！onAuthStateChangedで遷移処理されます。");
            } catch (error) {
                alert(`ログインエラー: ${error.message}`);
                console.error("ログインエラー:", error);
            }
        });
    }

    // 新規登録処理
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = signupEmailInput.value;
            const password = signupPasswordInput.value;
            const displayName = signupDisplayNameInput.value;

            try {
                console.log("新規ユーザー作成処理開始...");
                if (password.length < 6) {
                    alert('パスワードは6文字以上で設定してください。');
                    return;
                }

                // Firebase Authにユーザー作成
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                console.log("Firebase Authenticationでユーザー作成:", user.uid);

                // 表示名を設定
                await user.updateProfile({ displayName: displayName });

                // Firestoreに保存（ここで必ずエラーハンドリング）
                try {
                    await db.collection('users').doc(user.uid).set({
                        email: user.email,
                        displayName: displayName,
                        role: 'student'
                    });
                    console.log("Firestoreにユーザーデータを保存しました。");
                } catch (fireErr) {
                    console.error("Firestore書き込み失敗:", fireErr);
                    alert(`Firestoreエラー: ${fireErr.message}`);
                    return; // 保存できなければ遷移しない
                }

                alert('登録が完了しました。ログインしてください。');

                // 登録後にログインフォームへ戻す
                signupForm.classList.add('hidden');
                loginForm.classList.remove('hidden');

            } catch (error) {
                alert(`登録エラー: ${error.message}`);
                console.error("新規登録エラー:", error);
            }
        });
    }
});
