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

// ─── Popular Articles (Most Read) ─────────────────────────────
async function fsGetPopularArticles(limitCount = 8) {
  try {
    const snap = await db.collection('articles')
      .orderBy('views', 'desc')
      .limit(limitCount)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('Firestore popular articles read failed:', e);
    const all = JSON.parse(localStorage.getItem('mbire_articles') || '[]');
    return [...all].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, limitCount);
  }
}

// ─── Article Reactions (Like / Dislike) ───────────────────────
async function fsReactToArticle(articleId, userId, reactionType) {
  try {
    const docRef = db.collection('articles').doc(articleId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const likedBy = data.likedBy || [];
    const dislikedBy = data.dislikedBy || [];
    let likes = data.likes || 0;
    let dislikes = data.dislikes || 0;
    const alreadyLiked = likedBy.includes(userId);
    const alreadyDisliked = dislikedBy.includes(userId);

    if (reactionType === 'like') {
      if (alreadyLiked) {
        await docRef.update({ likes: firebase.firestore.FieldValue.increment(-1), likedBy: firebase.firestore.FieldValue.arrayRemove(userId) });
        return { likes: likes - 1, dislikes, userLiked: false, userDisliked: alreadyDisliked };
      } else {
        const updates = { likes: firebase.firestore.FieldValue.increment(1), likedBy: firebase.firestore.FieldValue.arrayUnion(userId) };
        if (alreadyDisliked) { updates.dislikes = firebase.firestore.FieldValue.increment(-1); updates.dislikedBy = firebase.firestore.FieldValue.arrayRemove(userId); dislikes--; }
        await docRef.update(updates);
        return { likes: likes + 1, dislikes, userLiked: true, userDisliked: false };
      }
    } else {
      if (alreadyDisliked) {
        await docRef.update({ dislikes: firebase.firestore.FieldValue.increment(-1), dislikedBy: firebase.firestore.FieldValue.arrayRemove(userId) });
        return { likes, dislikes: dislikes - 1, userLiked: alreadyLiked, userDisliked: false };
      } else {
        const updates = { dislikes: firebase.firestore.FieldValue.increment(1), dislikedBy: firebase.firestore.FieldValue.arrayUnion(userId) };
        if (alreadyLiked) { updates.likes = firebase.firestore.FieldValue.increment(-1); updates.likedBy = firebase.firestore.FieldValue.arrayRemove(userId); likes--; }
        await docRef.update(updates);
        return { likes, dislikes: dislikes + 1, userLiked: false, userDisliked: true };
      }
    }
  } catch(e) {
    console.warn('Error reacting to article:', e);
    return null;
  }
}

// ─── Increment Article View Count ─────────────────────────────
async function incrementArticleViews(articleId) {
  try {
    await db.collection('articles').doc(articleId).update({
      views: firebase.firestore.FieldValue.increment(1)
    });
  } catch(e) { /* silent */ }
}

// ─── Comment Likes ────────────────────────────────────────────
async function fsToggleCommentLike(commentId, userId) {
  try {
    const docRef = db.collection('comments').doc(commentId);
    const doc = await docRef.get();
    if (!doc.exists) return null;
    const data = doc.data();
    const likedBy = data.likedBy || [];
    const hasLiked = likedBy.includes(userId);
    if (hasLiked) {
      await docRef.update({ likes: firebase.firestore.FieldValue.increment(-1), likedBy: firebase.firestore.FieldValue.arrayRemove(userId) });
      return { likes: (data.likes || 1) - 1, userLiked: false };
    } else {
      await docRef.update({ likes: firebase.firestore.FieldValue.increment(1), likedBy: firebase.firestore.FieldValue.arrayUnion(userId) });
      return { likes: (data.likes || 0) + 1, userLiked: true };
    }
  } catch(e) {
    console.warn('Error toggling comment like:', e);
    return null;
  }
}

// ─── Comment Replies ──────────────────────────────────────────
async function fsAddCommentReply(commentId, replyObj) {
  try {
    await db.collection('comments').doc(commentId).update({
      replies: firebase.firestore.FieldValue.arrayUnion(replyObj)
    });
  } catch(e) {
    console.warn('Error adding reply:', e);
    throw e;
  }
}

// ─── Site Metrics (Page Visits & Views) ───────────────────────
async function recordPageVisit() {
  try {
    const statsRef = db.collection('stats').doc('visitors');
    await statsRef.set({
      count: firebase.firestore.FieldValue.increment(1)
    }, { merge: true });
  } catch (err) {
    console.warn('Error recording page visit:', err);
  }
}

async function fsGetStats() {
  try {
    const doc = await db.collection('stats').doc('visitors').get();
    if (doc.exists) {
      return doc.data();
    }
    return { count: 0 };
  } catch (err) {
    console.warn('Error fetching stats:', err);
    return { count: 0 };
  }
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

// ─── Database Seeding Logic ───────────────────────────────────
async function seedDatabaseIfEmpty() {
  try {
    const articlesSnap = await db.collection('articles').limit(1).get();
    if (articlesSnap.empty) {
      console.log('Seeding initial news database values...');
      
      const seedArticles = [
        {
          id: 'art_1',
          title: "Zimbabwe's New Economic Measures Set for Second Half of 2026",
          body: "The central government has officially released a new policy directive that aims to empower municipal authorities with more fiscal autonomy, allowing them to fund infrastructure projects directly from localized revenue collections.\n\nUnder the new blueprint, councils will be allowed to retain up to 60% of all localized business licenses and levy revenue. These funds will be earmarked specifically for improving municipal services, building roads, and securing clean water systems for local residents.\n\nLocal government representatives have welcomed this development, saying it will help resolve the ongoing service delivery challenges faced by councils across the country, especially in rural areas like Mbire.",
          cat: "business",
          image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=900&q=80",
          author: "MBIRE TV ZIMBABWE",
          date: new Date(Date.now() - 3600000 * 3).toISOString(),
          views: 145,
          status: 'published'
        },
        {
          id: 'art_2',
          title: "Trade Expansion: Focus Shifts To Cross-Border Agriculture Exports",
          body: "Agricultural analysts suggest that cross-border trade between Zimbabwe and its northern neighbors is set to triple as new import-export corridors open up.\n\nFarming syndicates in regions like Mbire are already preparing cooperative networks to export cotton, sorghum, and groundnuts directly to nearby border facilities, reducing transport overheads and increasing farmer profits.\n\nThe development follows regional discussions centered around simplifying agricultural customs clearance rates for smallholder cooperatives.",
          cat: "politics",
          image: "https://images.unsplash.com/photo-1595974482597-4b8da8879bc5?w=900&q=80",
          author: "MBIRE TV ZIMBABWE",
          date: new Date(Date.now() - 3600000 * 8).toISOString(),
          views: 92,
          status: 'published'
        },
        {
          id: 'art_3',
          title: "Local Infrastructure Project Revitalizes Key Transport Hubs",
          body: "Road rehabilitation work on major highways in Mashonaland Central has officially begun. The project aims to improve linkage roads between rural farming districts and national trunk roads, facilitating faster transport of cash crops.\n\nContractors confirmed that local labor from Mbire and neighboring villages represents over 70% of the active construction workforce.",
          cat: "general",
          image: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=900&q=80",
          author: "MBIRE TV ZIMBABWE",
          date: new Date(Date.now() - 86400000).toISOString(),
          views: 210,
          status: 'published'
        }
      ];

      for (const a of seedArticles) {
        await db.collection('articles').doc(a.id).set(a);
      }
    }

    const usersSnap = await db.collection('users').limit(1).get();
    if (usersSnap.empty) {
      console.log('Seeding initial users database values...');
      
      const seedUsers = [
        { id: 'usr_1', name: 'Kudakwashe Moyo', email: 'kudakwashe@example.com', phone: '+27780000001', password: 'password123', role: 'user', status: 'active', date: new Date(Date.now() - 86400000 * 2).toISOString() },
        { id: 'usr_2', name: 'Tinashe Nkomo', email: 'tinashe.nkomo@gmail.com', phone: '+27780000002', password: 'password123', role: 'user', status: 'active', date: new Date(Date.now() - 86400000 * 5).toISOString() },
        { id: 'usr_3', name: 'Guest User', email: 'googleuser@gmail.com', phone: '+27780000003', password: 'password123', role: 'user', status: 'banned', date: new Date(Date.now() - 86400000 * 7).toISOString() }
      ];

      for (const u of seedUsers) {
        await db.collection('users').doc(u.id).set(u);
      }
    }

    const commentsSnap = await db.collection('comments').limit(1).get();
    if (commentsSnap.empty) {
      console.log('Seeding initial comments database values...');
      
      const seedComments = [
        {
          id: 'cmt_1',
          articleId: 'art_1',
          articleTitle: "Zimbabwe's New Economic Measures Set for Second Half of 2026",
          authorName: 'Kudakwashe Moyo',
          authorEmail: 'kudakwashe@example.com',
          avatar: 'KM',
          text: 'This is a great move by the government. Mbire district really needs better roads so we can transport our cotton and produce easily.',
          date: new Date(Date.now() - 3600000 * 1).toISOString(),
          status: 'approved'
        },
        {
          id: 'cmt_2',
          articleId: 'art_1',
          articleTitle: "Zimbabwe's New Economic Measures Set for Second Half of 2026",
          authorName: 'Tinashe Nkomo',
          authorEmail: 'tinashe.nkomo@gmail.com',
          avatar: 'TN',
          text: 'I hope the councils manage these funds transparently. Service delivery is key!',
          date: new Date(Date.now() - 3600000 * 2).toISOString(),
          status: 'approved'
        }
      ];

      for (const c of seedComments) {
        await db.collection('comments').doc(c.id).set(c);
      }
    }
  } catch (err) {
    console.warn('Seeding failed:', err);
  }
}

// Execute seeding check asynchronously
seedDatabaseIfEmpty();
