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

document.addEventListener('DOMContentLoaded', () => {
    // 必要なDOM要素を取得
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupBtn = document.getElementById('showSignup');
    const showLoginBtn = document.getElementById('showLogin');

    // 認証状態の変更を監視するリスナー
    // ログイン状態が変わるたびに、この関数が実行されます
    auth.onAuthStateChanged(async user => {
        if (user) {
            // ユーザーがログイン済みの場合、役割をチェックしてリダイレクト
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    if (userData.role === 'teacher') {
                        // 役割が'teacher'なら教師用ページへ
                        window.location.href = 'teacher.html';
                    } else {
                        // それ以外（'student'）なら生徒用ページへ
                        window.location.href = 'record.html';
                    }
                } else {
                    // Firestoreにドキュメントが存在しない場合は、念のため生徒として扱う
                    console.warn("Firestoreのユーザーデータが見つかりませんでした。生徒としてリダイレクトします。");
                    window.location.href = 'record.html';
                }
            } catch (error) {
                console.error("ユーザー役割のチェック中にエラーが発生しました:", error);
                // エラーが発生しても、生徒用ページにリダイレクトしてアプリの継続を試みる
                window.location.href = 'record.html';
            }
        }
        // ユーザーがログアウト済みの場合は何もしません
    });

    // ログインフォームと新規登録フォームの表示を切り替える
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

    // ログインフォームの送信処理
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.email.value;
            const password = loginForm.password.value;
            try {
                // メールアドレスとパスワードでログインを試みる
                await auth.signInWithEmailAndPassword(email, password);
                // 成功すると、上記の onAuthStateChanged リスナーが自動的にリダイレクト処理を実行します
                console.log("ログイン成功");
            } catch (error) {
                // ログイン失敗時にエラーメッセージを表示
                alert(`ログインエラー: ${error.message}`);
                console.error("ログインエラー:", error);
            }
        });
    }

    // 新規登録フォームの送信処理
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = signupForm.email.value;
            const password = signupForm.password.value;
            const displayName = signupForm.displayName.value;
            try {
                // 新しいユーザーを認証システムに作成
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // ユーザーの表示名を設定
                await user.updateProfile({ displayName: displayName });
                
                // Firestoreにユーザーのドキュメントを作成し、役割を'student'に設定
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: displayName,
                    role: 'student', // 新規登録時はデフォルトで生徒
                });
                
                alert('登録が完了しました。ログインしてください。');
                
                // 登録後にログインフォームに戻す
                if (loginForm && signupForm) {
                     signupForm.classList.add('hidden');
                     loginForm.classList.remove('hidden');
                }
            } catch (error) {
                alert(`登録エラー: ${error.message}`);
                console.error("新規登録エラー:", error);
            }
        });
    }
});
