// 1. استدعاء مكتبات الفايربيز الحديثة عبر الـ CDN بشكل صحيح
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


// 2. كود الـ Config الخاص بمشروعك (captin)
const firebaseConfig = {
  apiKey: "AIzaSyA_IHWz_OoJdtetz4wDiYd361xCUUO6dUE",
  authDomain: "captin-68ae1.firebaseapp.com",
  projectId: "captin-68ae1",
  storageBucket: "captin-68ae1.firebasestorage.app",
  messagingSenderId: "793474209266",
  appId: "1:793474209266:web:8290dfd5b4caec7621076b",
  measurementId: "G-V05LHKRNXY"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// البريد المخصص لصاحب المطعم لفتح لوحة التحكم المنفصلة
const ADMIN_EMAIL = "hamzatango922@gmail.com";

let cart = JSON.parse(localStorage.getItem('restaurant_cart')) || [];
let menuProducts = [];
let currentLang = localStorage.getItem('lang') || 'ar';
let isSignUpMode = false;

const translations = {
  ar: {
    logo: "🍔 Yummy Delights",
    menuTitle: "قائمة الطعام المميزة",
    cartText: "السلة",
    login: "دخول",
    logout: "خروج",
    welcome: "مرحباً، ",
    dashboard: "👑 لوحة التحكم",
    cash: "كاش عند الاستلام",
    vodafone: "فودافون كاش",
    confirmOrder: "تأكيد الطلب",
    emptyCart: "السلة فارغة حالياً، أضف بعض الوجبات اللذيذة!",
    orderSuccess: "شكراً لطلبك!"
  },
  en: {
    logo: "🍔 Yummy Delights",
    menuTitle: "Our Special Menu",
    cartText: "Cart",
    login: "Login",
    logout: "Logout",
    welcome: "Welcome, ",
    dashboard: "👑 Dashboard",
    cash: "Cash on Delivery",
    vodafone: "Vodafone Cash",
    confirmOrder: "Confirm Order",
    emptyCart: "Your cart is empty, add some yummy meals!",
    orderSuccess: "Thank you for your order!"
  }
};

// تشغيل الخدمات الأساسية
trackVisits();
fetchMenuFromFirebase();
fetchAdminStats();
updateCartUI();
setupLanguageUI();
setupEventListeners();
monitorAuthState();

async function trackVisits() {
  const visitDocRef = doc(db, "stats", "visits_counter");
  try {
    const docSnap = await getDoc(visitDocRef);
    if (!docSnap.exists()) {
      await setDoc(visitDocRef, { count: 1 });
    } else {
      await updateDoc(visitDocRef, { count: increment(1) });
    }
  } catch (e) {
    console.log("تنبيه الزيارات:", e);
  }
}

function fetchMenuFromFirebase() {
  onSnapshot(collection(db, "products"), (snapshot) => {
    menuProducts = [];
    snapshot.forEach((doc) => {
      menuProducts.push({ id: doc.id, ...doc.data() });
    });
    renderMenu();
    renderCartRecommendations(); 
  });
}

function fetchAdminStats() {
  onSnapshot(doc(db, "stats", "visits_counter"), (docSnap) => {
    const visitCountEl = document.getElementById("stat-visits-count");
    if (visitCountEl && docSnap.exists()) {
      visitCountEl.innerText = docSnap.data().count;
    }
  });

  onSnapshot(collection(db, "users"), (snapshot) => {
    const userCountEl = document.getElementById("stat-users-count");
    if (userCountEl) userCountEl.innerText = snapshot.size;
  });

  onSnapshot(collection(db, "orders"), (snapshot) => {
    const orderCountEl = document.getElementById("stat-orders-count");
    if (orderCountEl) orderCountEl.innerText = snapshot.size;
  });
}

function renderMenu() {
  const container = document.getElementById("menu-container");
  if(!container) return;
  container.innerHTML = menuProducts.map(prod => `
    <div class="card">
      <img src="${prod.image}" alt="${prod.name}" style="width:100%; height:180px; object-fit:cover; border-radius:8px;">
      <h3>${prod.name}</h3>
      <p class="price">${prod.price} جنيه</p>
      <button class="btn-primary" id="btn-${prod.id}">إضافة للسلة 🛒</button>
    </div>
  `).join('');

  menuProducts.forEach(prod => {
    const btn = document.getElementById(`btn-${prod.id}`);
    if(btn) btn.onclick = () => addToCart(prod.id);
  });
}

function monitorAuthState() {
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userWelcome = document.getElementById("user-welcome");
  const userNameEl = document.getElementById("user-name");
  const adminNavBtn = document.getElementById("admin-nav-btn");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (loginBtn) loginBtn.classList.add("hidden");
      if (logoutBtn) logoutBtn.classList.remove("hidden");
      if (userWelcome) userWelcome.classList.remove("hidden");
      if (userNameEl) userNameEl.innerText = user.email.split('@')[0];

      if (user.email === ADMIN_EMAIL) {
        if (adminNavBtn) adminNavBtn.classList.remove("hidden");
      } else {
        if (adminNavBtn) adminNavBtn.classList.add("hidden");
        showHomePage();
      }
    } else {
      if (loginBtn) loginBtn.classList.remove("hidden");
      if (logoutBtn) logoutBtn.classList.add("hidden");
      if (userWelcome) userWelcome.classList.add("hidden");
      if (adminNavBtn) adminNavBtn.classList.add("hidden");
      showHomePage();
    }
  });
}

function addToCart(id) {
  const product = menuProducts.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  saveCart();
}

function saveCart() {
  localStorage.setItem('restaurant_cart', JSON.stringify(cart));
  updateCartUI();
  renderCartRecommendations();
}

function updateCartUI() {
  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountEl = document.getElementById("cart-count");
  if(cartCountEl) cartCountEl.innerText = totalCount;

  const cartItemsContainer = document.getElementById("cart-items");
  const totalAmountContainer = document.getElementById("cart-total");
  if(!cartItemsContainer || !totalAmountContainer) return;

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `<p class="empty-msg" style="text-align:center; color:#888;">${translations[currentLang].emptyCart}</p>`;
    totalAmountContainer.innerText = "0";
    return;
  }

  cartItemsContainer.innerHTML = cart.map(item => `
    <div class="cart-item" style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid #1a1a1a; padding-bottom:8px;">
      <span>${item.name} (×${item.quantity})</span>
      <span>${item.price * item.quantity} جنيه</span>
    </div>
  `).join('');

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  totalAmountContainer.innerText = totalAmount;
}

function renderCartRecommendations() {
  const container = document.getElementById("cart-recommendations");
  if (!container) return;

  const nonCartItems = menuProducts.filter(prod => !cart.some(cartItem => cartItem.id === prod.id));

  if (nonCartItems.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #888;">لقد أضفت كل الأطباق المميزة لسلتك! 😍</p>`;
    return;
  }

  const suggestions = nonCartItems.slice(0, 3);

  container.innerHTML = suggestions.map(prod => `
    <div class="card" style="border: 1px dashed #e74c3c;">
      <img src="${prod.image}" alt="${prod.name}" style="width:100%; height:130px; object-fit:cover; border-radius:5px;">
      <h3>${prod.name}</h3>
      <p class="price">${prod.price} جنيه</p>
      <button class="btn-primary" id="rec-btn-${prod.id}" style="background: #34495e; border-color: #34495e; width: 100%;">إضافة الاقتراح 🛒</button>
    </div>
  `).join('');

  suggestions.forEach(prod => {
    const btn = document.getElementById(`rec-btn-${prod.id}`);
    if (btn) {
      btn.onclick = () => {
        addToCart(prod.id);
        alert(`تم إضافة ${prod.name} إلى السلة!`);
      };
    }
  });
}

// دالة تحديث النصوص باللغة النشطة
function setupLanguageUI() {
  const logoEl = document.getElementById("logo-text");
  const menuTitleEl = document.getElementById("menu-title");
  const langToggleBtn = document.getElementById("lang-toggle");
  
  if (logoEl) logoEl.innerText = translations[currentLang].logo;
  if (menuTitleEl) menuTitleEl.innerText = translations[currentLang].menuTitle;
  if (langToggleBtn) langToggleBtn.innerText = currentLang === 'ar' ? 'English' : 'العربية';
  
  // تغيير اتجاه الموقع حسب اللغة
  document.documentElement.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', currentLang);
}

// ترجمة أخطاء Authentication من الفايربيز للغة العربية لمساعدتك
function translateError(code) {
  if (code.includes("auth/weak-password")) return "كلمة المرور ضعيفة جداً (يجب ألا تقل عن 6 أحرف)";
  if (code.includes("auth/email-already-in-use")) return "هذا البريد الإلكتروني مستخدم بالفعل بحساب آخر";
  if (code.includes("auth/invalid-email")) return "صيغة البريد الإلكتروني غير صحيحة";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password") || code.includes("auth/user-not-found")) {
    return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  }
  return code;
}

function setupEventListeners() {
  // 1. التحكم بنوافذ السلة وتسجيل الدخول
  const cartIconBtn = document.getElementById("cart-toggle"); 
  const closeCartBtn = document.getElementById("close-cart-page"); 
  const cartModal = document.getElementById("cart-page"); 

  const loginBtn = document.getElementById("login-btn");
  const closeAuthBtn = document.getElementById("close-auth") || document.getElementById("close-auth-btn");
  const authModal = document.getElementById("auth-modal");
  const logoutBtn = document.getElementById("logout-btn");
  const adminNavBtn = document.getElementById("admin-nav-btn");
  const adminSection = document.getElementById("admin-section");

  if (cartIconBtn && cartModal) {
    cartIconBtn.onclick = () => {
      cartModal.classList.remove("hidden");
      document.querySelector(".menu-section").classList.add("hidden");
      if (adminSection) adminSection.classList.add("hidden");
    };
  }

  if (closeCartBtn && cartModal) {
    closeCartBtn.onclick = () => {
      cartModal.classList.add("hidden");
      document.querySelector(".menu-section").classList.remove("hidden");
    };
  }

  if (loginBtn && authModal) loginBtn.onclick = () => authModal.classList.remove("hidden");
  if (closeAuthBtn && authModal) closeAuthBtn.onclick = () => authModal.classList.add("hidden");

  if (adminNavBtn && adminSection) {
    adminNavBtn.onclick = () => {
      adminSection.classList.remove("hidden");
      document.querySelector(".menu-section").classList.add("hidden");
      if (cartModal) cartModal.classList.add("hidden");
    };
  }

  // 2. مستمع تغيير اللغة الفوري
  const langToggleBtn = document.getElementById("lang-toggle");
  if (langToggleBtn) {
    langToggleBtn.onclick = () => {
      currentLang = currentLang === 'ar' ? 'en' : 'ar';
      localStorage.setItem('lang', currentLang);
      setupLanguageUI();
      updateCartUI(); // تحديث رسالة السلة الفارغة حسب اللغة الجديدة
    };
  }

  // 3. معالجة تبديل نمط تسجيل الدخول / حساب جديد
  const authToggleBtn = document.getElementById("auth-mode-toggle") || document.getElementById("auth-toggle-btn");
  const authTitle = document.getElementById("modal-title") || document.getElementById("auth-title");
  const authSubmitBtn = document.getElementById("submit-auth-btn") || document.getElementById("auth-submit-btn");

  if (authToggleBtn) {
    authToggleBtn.onclick = () => {
      isSignUpMode = !isSignUpMode;
      if (authTitle) authTitle.innerText = isSignUpMode ? "إنشاء حساب جديد" : "تسجيل الدخول";
      if (authSubmitBtn) authSubmitBtn.innerText = isSignUpMode ? "إنشاء حساب" : "تأكيد";
      authToggleBtn.innerText = isSignUpMode ? "لديك حساب بالفعل؟ سجل دخولك" : "ليس لديك حساب؟ إنشاء حساب جديد";
    };
  }

  // 4. معالجة النقر المباشر على زر "تأكيد" للتوثيق (يدعم الأشكال المختلفة للـ HTML)
  if (authSubmitBtn) {
    authSubmitBtn.onclick = async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById("auth-email");
      const passwordInput = document.getElementById("auth-password");

      if (!emailInput || !passwordInput) return;
      const email = emailInput.value.trim();
      const password = passwordInput.value;

      if (!email || !password) {
        alert("برجاء إدخال البريد الإلكتروني وكلمة المرور");
        return;
      }

      try {
        if (isSignUpMode) {
          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, "users", userCred.user.uid), {
            email: email,
            createdAt: new Date()
          });
          alert("تم إنشاء الحساب بنجاح!");
        } else {
          await signInWithEmailAndPassword(auth, email, password);
          alert("تم تسجيل الدخول بنجاح!");
        }
        if (authModal) authModal.classList.add("hidden");
        emailInput.value = "";
        passwordInput.value = "";
      } catch (error) {
        alert("حدث خطأ: " + translateError(error.code || error.message));
      }
    };
  }

  if (logoutBtn) {
    logoutBtn.onclick = () => {
      signOut(auth).then(() => {
        alert("تم تسجيل الخروج بنجاح");
      }).catch((error) => console.error("خطأ تسجيل الخروج:", error));
    };
  }

  const addProductForm = document.getElementById("add-product-form");
  if (addProductForm) {
    addProductForm.onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById("prod-name").value;
      const price = parseFloat(document.getElementById("prod-price").value);
      const image = document.getElementById("prod-image").value;

      try {
        await addDoc(collection(db, "products"), {
          name: name,
          price: price,
          image: image,
          createdAt: new Date()
        });
        alert("تم إضافة الصنف بنجاح للمنيو! ✨");
        addProductForm.reset();
      } catch (error) {
        alert("حدث خطأ أثناء إضافة الصنف: " + error.message);
      }
    };
  }

  const checkoutBtn = document.getElementById("checkout-btn");
  if (checkoutBtn) {
    checkoutBtn.onclick = async () => {
      if (cart.length === 0) {
        alert("السلة فارغة حالياً! أضف بعض الوجبات أولاً.");
        return;
      }

      const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
      const paymentText = paymentMethod === 'cash' ? "كاش عند الاستلام (دفع جدية حجز 25% فودافون كاش)" : "فودافون كاش (كامل القيمة)";

      let message = `*طلب جديد من Yummy Delights* 🍔\n\n`;
      cart.forEach((item, index) => {
        message += `${index + 1}. *${item.name}* (×${item.quantity}) - ${item.price * item.quantity} جنيه\n`;
      });
      
      const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      message += `\n💰 *الإجمالي:* ${totalAmount} جنيه`;
      message += `\n💳 *طريقة الدفع:* ${paymentText}`;
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        message += `\n👤 *حساب العميل:* ${currentUser.email}`;
      }

      try {
        await addDoc(collection(db, "orders"), {
          items: cart,
          total: totalAmount,
          paymentMethod: paymentMethod,
          userEmail: currentUser ? currentUser.email : "زائر",
          createdAt: new Date()
        });
      } catch (e) {
        console.error("فشل حفظ الطلب إحصائياً ولكن سيتم التوجيه للواتساب:", e);
      }

      cart = [];
      saveCart();
      if (cartModal) cartModal.classList.add("hidden");
      document.querySelector(".menu-section").classList.remove("hidden");

      const phoneNumber = "201100527732"; // استبدله برقم هاتفك بصيغة دولية
      const encodedMessage = encodeURIComponent(message);
      const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      
      window.open(whatsappUrl, '_blank');
    };
  }

  const togglePasswordEye = document.getElementById("toggle-password-eye");
  const passwordInput = document.getElementById("auth-password");
  if (togglePasswordEye && passwordInput) {
    togglePasswordEye.onclick = () => {
      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
      passwordInput.setAttribute("type", type);
      togglePasswordEye.innerText = type === "password" ? "👁️" : "🙈";
    };
  }
}

function showHomePage() {
  const adminSection = document.getElementById("admin-section");
  const menuSection = document.querySelector(".menu-section");
  if (adminSection) adminSection.classList.add("hidden");
  if (menuSection) menuSection.classList.remove("hidden");
}
