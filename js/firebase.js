/**
 * MBIRE TV ZIMBABWE — Firebase Configuration & Firestore CRUD Helpers
 * Project: mbire-tv-news-a71c2
 */

// ─── Firebase Config ──────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDmFL7PLrzu5VCNNLZHY7Ph4Csiy9ks9CI",
  authDomain:        "mbire-tv-news-a71c2.firebaseapp.com",
  projectId:         "mbire-tv-news-a71c2",
  storageBucket:     "mbire-tv-news-a71c2.firebasestorage.app",
  messagingSenderId: "182700731739",
  appId:             "1:182700731739:web:3d927a981f761cfb9bbe7e"
};

// Initialize Firebase (Compat SDK Wrapper)
if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const db = firebase.firestore();
let storage;
try {
  storage = firebase.storage();
} catch (e) {
  console.warn('Firebase Storage not loaded or initialized:', e);
}

// Upload file helper
async function fsUploadImage(file) {
  if (storage) {
    try {
      const uploadPromise = (async () => {
        const ref = storage.ref().child('uploads/' + Date.now() + '_' + file.name);
        const snap = await ref.put(file);
        return await snap.ref.getDownloadURL();
      })();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase Storage upload timed out after 3s')), 3000)
      );

      return await Promise.race([uploadPromise, timeoutPromise]);
    } catch (e) {
      console.warn('Firebase Storage upload failed or timed out, falling back to Base64 conversion:', e);
      // Fall through to Base64 fallback below
    }
  }
  
  // Base64 fallback (max size 1MB for Firestore compatibility)
  return new Promise((resolve, reject) => {
    if (file.size > 800000) {
      reject(new Error('Image is too large. Please select a photo under 800KB.'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

// ─── Articles ─────────────────────────────────────────────────
async function fsGetArticles(limitCount = 30) {
  try {
    const snap = await db.collection('articles')
      .orderBy('date', 'desc')
      .limit(limitCount)
      .get();
    const articles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem('mbire_articles', JSON.stringify(articles));
    return articles;
  } catch (e) {
    console.warn('Firestore articles read failed, using local fallback:', e);
    return JSON.parse(localStorage.getItem('mbire_articles') || '[]');
  }
}

async function fsGetArticleById(id) {
  try {
    const doc = await db.collection('articles').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } catch (e) {
    console.warn('Firestore single article read failed:', e);
    const all = JSON.parse(localStorage.getItem('mbire_articles') || '[]');
    return all.find(a => a.id === id) || null;
  }
}

async function fsSaveArticle(article) {
  // merge:true preserves existing date & views when editing
  await db.collection('articles').doc(article.id).set(article, { merge: true });
  // Sync to local
  const all = JSON.parse(localStorage.getItem('mbire_articles') || '[]');
  const idx = all.findIndex(a => a.id === article.id);
  if (idx > -1) all[idx] = { ...all[idx], ...article }; else all.unshift(article);
  localStorage.setItem('mbire_articles', JSON.stringify(all));
}

async function fsDeleteArticle(id) {
  await db.collection('articles').doc(id).delete();
  const all = JSON.parse(localStorage.getItem('mbire_articles') || '[]');
  localStorage.setItem('mbire_articles', JSON.stringify(all.filter(a => a.id !== id)));
}

// ─── Comments ─────────────────────────────────────────────────
async function fsGetComments() {
  try {
    const snap = await db.collection('comments')
      .orderBy('date', 'desc')
      .get();
    const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem('mbire_comments', JSON.stringify(comments));
    return comments;
  } catch (e) {
    console.warn('Firestore comments read failed, using local fallback:', e);
    return JSON.parse(localStorage.getItem('mbire_comments') || '[]');
  }
}

async function fsGetCommentsByArticle(articleId) {
  try {
    const snap = await db.collection('comments')
      .where('articleId', '==', articleId)
      .orderBy('date', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Firestore article comments read failed, using local fallback:', e);
    const all = JSON.parse(localStorage.getItem('mbire_comments') || '[]');
    return all.filter(c => c.articleId === articleId);
  }
}

async function fsSaveComment(comment) {
  await db.collection('comments').doc(comment.id).set(comment);
  const all = JSON.parse(localStorage.getItem('mbire_comments') || '[]');
  const idx = all.findIndex(c => c.id === comment.id);
  if (idx > -1) all[idx] = comment; else all.unshift(comment);
  localStorage.setItem('mbire_comments', JSON.stringify(all));
}

async function fsDeleteComment(id) {
  await db.collection('comments').doc(id).delete();
  const all = JSON.parse(localStorage.getItem('mbire_comments') || '[]');
  localStorage.setItem('mbire_comments', JSON.stringify(all.filter(c => c.id !== id)));
}

// ─── Users ────────────────────────────────────────────────────
async function fsGetUsers() {
  try {
    const snap = await db.collection('users').get();
    const usersList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem('mbire_users', JSON.stringify(usersList));
    return usersList;
  } catch (e) {
    console.warn('Firestore users read failed, using local fallback:', e);
    return JSON.parse(localStorage.getItem('mbire_users') || '[]');
  }
}

async function fsSaveUser(u) {
  await db.collection('users').doc(u.id).set(u);
  const all = JSON.parse(localStorage.getItem('mbire_users') || '[]');
  const idx = all.findIndex(item => item.id === u.id);
  if (idx > -1) all[idx] = u; else all.unshift(u);
  localStorage.setItem('mbire_users', JSON.stringify(all));
}

async function fsDeleteUser(id) {
  await db.collection('users').doc(id).delete();
  const all = JSON.parse(localStorage.getItem('mbire_users') || '[]');
  localStorage.setItem('mbire_users', JSON.stringify(all.filter(u => u.id !== id)));
}

async function fsUpdateUserStatus(id, newStatus) {
  await db.collection('users').doc(id).update({ status: newStatus });
  const all = JSON.parse(localStorage.getItem('mbire_users') || '[]');
  const idx = all.findIndex(u => u.id === id);
  if (idx > -1) { all[idx].status = newStatus; localStorage.setItem('mbire_users', JSON.stringify(all)); }
}

// ─── Submissions (User Submitted News) ─────────────────────────
async function fsGetSubmissions() {
  try {
    const snap = await db.collection('submissions')
      .orderBy('date', 'desc')
      .get();
    const submissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem('mbire_submissions', JSON.stringify(submissions));
    return submissions;
  } catch (e) {
    console.warn('Firestore submissions read failed:', e);
    return JSON.parse(localStorage.getItem('mbire_submissions') || '[]');
  }
}

async function fsSaveSubmission(sub) {
  await db.collection('submissions').doc(sub.id).set(sub);
  const all = JSON.parse(localStorage.getItem('mbire_submissions') || '[]');
  all.unshift(sub);
  localStorage.setItem('mbire_submissions', JSON.stringify(all));
}

async function fsDeleteSubmission(id) {
  await db.collection('submissions').doc(id).delete();
  const all = JSON.parse(localStorage.getItem('mbire_submissions') || '[]');
  localStorage.setItem('mbire_submissions', JSON.stringify(all.filter(s => s.id !== id)));
}

