/* TechPro AI — app.js v5 */

// Firebase config is injected from .env via Flask backend
const FIREBASE_CONFIG = window.FIREBASE_CONFIG || {};
const API_URL = "http://localhost:5000/api";

firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db   = firebase.firestore();

/* ── State ── */
let currentUser  = null;
let chats        = [];      // full chat objects from Firestore
let acid         = null;    // active chat id
let groqHist     = [];      // [{role,content}] — sent to backend
let busy         = false;
let serverOnline = false;
let uInit        = "U";
let sidebarCollapsed = true;  // hidden by default
let activeTab    = "login";

/* ── Helpers ── */
const $   = id  => document.getElementById(id);
const esc = t   => String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function grow(el){ el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,140)+"px"; }

function toast(msg, type=""){
  const el=$("toast-el");
  el.textContent=msg;
  el.className="toast show"+(type?" "+type:"");
  clearTimeout(window._tt);
  window._tt=setTimeout(()=>el.classList.remove("show"),3200);
}

function aiIcon(){
  return `<svg viewBox="0 0 24 24" fill="none" width="15" height="15">
    <polygon points="12,2 22,8 12,14 2,8" fill="rgba(255,255,255,.9)"/>
    <polyline points="2,12 12,18 22,12" stroke="rgba(248,131,121,.9)" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

function mdRender(t){
  return t
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_,l,c)=>`<pre><code>${esc(c.trim())}</code></pre>`)
    .replace(/`([^`\n]+)`/g, (_,c)=>`<code>${esc(c)}</code>`)
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,"<em>$1</em>")
    .replace(/^### (.+)$/gm,'<strong style="font-size:.9rem;display:block;margin:8px 0 3px">$1</strong>')
    .replace(/^## (.+)$/gm,'<strong style="font-size:.95rem;display:block;margin:10px 0 3px">$1</strong>')
    .replace(/^# (.+)$/gm,'<strong style="font-size:1.05rem;display:block;margin:10px 0 4px">$1</strong>')
    .replace(/^[-*] (.+)$/gm,"• $1")
    .replace(/\n/g,"<br>");
}

/* ════════════════════════════
   SERVER HEALTH
════════════════════════════ */
async function checkServer(){
  try{
    const r=await fetch(`${API_URL}/health`,{signal:AbortSignal.timeout(4000)});
    const d=await r.json();
    serverOnline=d.status==="online";
  }catch{ serverOnline=false; }
  updateStatusUI();
}
function updateStatusUI(){
  const on=serverOnline;
  ["sdot"].forEach(id=>{ const el=$(id); if(el){ el.className="sdot "+(on?"on":"off"); } });
  const t=$("stxt"); if(t) t.textContent=on?"Server online":"Server offline";
  const sd=$("st-dot"); if(sd){ sd.className="st-dot "+(on?"green":"red"); sd.style.animation="none"; }
  const st=$("st-txt"); if(st) st.textContent=on?"Connected":"Offline";
}

/* ════════════════════════════
   AUTH STATE
════════════════════════════ */
auth.onAuthStateChanged(async user=>{
  hideLoader();
  if(user){
    currentUser=user;
    const name=user.displayName||user.email?.split("@")[0]||"User";
    uInit=name[0].toUpperCase();
    setUserUI(name, user.email||"");
    await loadChats();
    showWelcome(name, true);
  }else{
    currentUser=null; chats=[]; acid=null; groqHist=[];
    setGuestUI();
    renderList([]);
    showWelcome(null, false);
  }
  checkServer();
});

function hideLoader(){
  const l=$("app-loader");
  l.classList.add("hide");
  setTimeout(()=>l.style.display="none",500);
}
function setUserUI(name, email){
  $("u-av").textContent=name[0].toUpperCase();
  $("u-nm").textContent=name;
  $("u-em").textContent=email;
  $("sb-auth-row").style.display="none";
  $("sb-user-tile").style.display="flex";
  $("sb-guest-tile").style.display="none";
  const mab=$("mob-auth-btns"); if(mab) mab.style.display="none";
  APP.closeModal("auth-modal");
  toast("Welcome back, "+name+"! 👋","ok");
}
function setGuestUI(){
  $("sb-auth-row").style.display="flex";
  $("sb-user-tile").style.display="none";
  $("sb-guest-tile").style.display="flex";
  const mab=$("mob-auth-btns"); if(mab) mab.style.display="";
}

/* ════════════════════════════
   WELCOME SCREEN
════════════════════════════ */
function showWelcome(name, isLoggedIn){
  $("msgs").classList.remove("has-msgs");
  if($("topbar-title")) $("topbar-title").textContent="TechPro AI";

  // Build greeting
  let greetingHTML, subHTML;
  if(isLoggedIn && name){
    greetingHTML=`Welcome, <span class="w-name">${esc(name)}</span>`;
    subHTML=`What can I help you today?`;
  }else{
    greetingHTML=`Welcome!`;
    subHTML=`What can I help you today?`;
  }

  $("msgs").innerHTML=`
  <div class="welcome" id="ws">
    <div class="w-icon-wrap">
      <div class="w-ring"></div><div class="w-ring2"></div>
      <div class="w-icon">
        <svg viewBox="0 0 24 24" fill="none" width="42" height="42">
          <polygon points="12,2 22,8 12,14 2,8" fill="rgba(255,255,255,.92)"/>
          <polyline points="2,12 12,18 22,12" stroke="rgba(248,131,121,.85)" stroke-width="2" fill="none" stroke-linecap="round"/>
          <polyline points="2,16 12,22 22,16" stroke="rgba(248,131,121,.45)" stroke-width="2" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
    </div>
    <h1 class="w-greeting">${greetingHTML}</h1>
    <p class="w-sub">${esc(subHTML)}</p>
    <div class="st-pill">
      <span class="sdot ${serverOnline?"on":"chk"}" id="sdot"></span>
      <span id="stxt">${serverOnline?"Server online":"Checking server…"}</span>
    </div>
    <div class="w-cards">
      <div class="w-card" onclick="APP.useCard(this)">
        <div class="w-card-ic">✍️</div>
        <div class="w-card-title">Write something</div>
        <div class="w-card-desc">Help me draft a professional email</div>
      </div>
      <div class="w-card" onclick="APP.useCard(this)">
        <div class="w-card-ic">💡</div>
        <div class="w-card-title">Explain a concept</div>
        <div class="w-card-desc">Explain quantum computing simply</div>
      </div>
      <div class="w-card" onclick="APP.useCard(this)">
        <div class="w-card-ic">💻</div>
        <div class="w-card-title">Write code</div>
        <div class="w-card-desc">Build a React login component</div>
      </div>
      <div class="w-card" onclick="APP.useCard(this)">
        <div class="w-card-ic">🌍</div>
        <div class="w-card-title">Translate text</div>
        <div class="w-card-desc">Translate "Hello" to 5 languages</div>
      </div>
    </div>
  </div>`;
}

/* ════════════════════════════
   FIRESTORE
════════════════════════════ */
async function loadChats(){
  if(!currentUser) return;
  try{
    let snap;
    try{
      snap=await db.collection("users").doc(currentUser.uid)
        .collection("chats").orderBy("updatedAt","desc").get();
    }catch{
      snap=await db.collection("users").doc(currentUser.uid)
        .collection("chats").get();
    }
    chats=snap.docs.map(d=>({id:d.id,...d.data()}));
    chats.sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));
    renderList(chats);
  }catch(e){ console.error("loadChats:",e); }
}

async function saveOrCreateChat(chat){
  if(!currentUser) return chat.id;
  const isTemp=chat.id.startsWith("tmp_");
  try{
    if(isTemp){
      const ref=await db.collection("users").doc(currentUser.uid)
        .collection("chats").add({
          title:chat.title,
          ms:chat.ms||[],
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        });
      return ref.id;
    }else{
      await db.collection("users").doc(currentUser.uid)
        .collection("chats").doc(chat.id).set({
          title:chat.title,
          ms:chat.ms||[],
          updatedAt:firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
      return chat.id;
    }
  }catch(e){ console.warn("saveChat:",e); return chat.id; }
}

async function deleteChatFS(id){
  if(!currentUser) return;
  try{
    await db.collection("users").doc(currentUser.uid)
      .collection("chats").doc(id).delete();
  }catch(e){ console.warn("deleteChat:",e); }
}

/* ════════════════════════════
   CHAT LIST
════════════════════════════ */
function renderList(list){
  const el=$("chat-list"); el.innerHTML="";
  if(!list.length){
    el.innerHTML=`<div style="padding:20px 12px;font-size:.74rem;color:var(--text3);text-align:center;line-height:1.8">No chats yet.<br/>Start a conversation!</div>`;
    return;
  }
  list.forEach(c=>{
    const d=document.createElement("div");
    d.className="chat-item"+(c.id===acid?" active":"");
    d.innerHTML=`
      <svg class="ci-icon" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      <span class="ci-txt">${esc(c.title)}</span>
      <button class="ci-del" onclick="event.stopPropagation();APP.delChat('${c.id}')">✕</button>`;
    d.onclick=()=>APP.ldChat(c.id);
    el.appendChild(d);
  });
}

/* ════════════════════════════
   SEND MESSAGE — FIXED
════════════════════════════ */
async function sendMsg(){
  if(busy) return;
  const inp=$("cinp");
  const text=inp.value.trim();
  if(!text) return;

  inp.value=""; grow(inp);

  // remove welcome, switch to message view
  $("ws")?.remove();
  $("msgs").classList.add("has-msgs");

  // ensure wrap
  let w=$("mw");
  if(!w){
    w=document.createElement("div");
    w.className="mwrap"; w.id="mw";
    $("msgs").appendChild(w);
  }

  // add user bubble immediately
  appendBubble("u", text);

  // add to groq history BEFORE the API call
  groqHist.push({role:"user", content:text});

  // find or create local chat object
  let chat;
  if(!acid){
    const tmpId="tmp_"+Date.now();
    chat={id:tmpId, title:text.slice(0,50)+(text.length>50?"…":""), ms:[], gh:[]};
    chats.unshift(chat);
    acid=tmpId;
    if($("topbar-title")) $("topbar-title").textContent=chat.title;
  }else{
    chat=chats.find(c=>c.id===acid);
    if(!chat){
      // fallback: recreate
      chat={id:acid, title:text.slice(0,50), ms:[], gh:[]};
      chats.unshift(chat);
    }
  }
  chat.ms.push({r:"u", t:text});
  renderList(chats);

  // show typing indicator
  const typId="ty_"+Date.now();
  const tr=document.createElement("div");
  tr.className="mrow"; tr.id=typId;
  tr.innerHTML=`<div class="mav ai">${aiIcon()}</div><div class="bub ai"><div class="tydots"><span></span><span></span><span></span></div></div>`;
  w.appendChild(tr);
  tr.scrollIntoView({behavior:"smooth"});

  busy=true;
  $("sbtn").disabled=true;

  try{
    // Send FULL history to backend (fixes multi-message bug)
    const res=await fetch(`${API_URL}/chat`,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:[...groqHist]}) // spread to avoid mutation
    });

    if(!res.ok){
      throw new Error(`Server error: ${res.status}`);
    }

    const data=await res.json();

    if(data.error){
      $(typId)?.remove();
      appendBubble("ai","⚠️ "+data.error);
      groqHist.pop(); // remove the failed user message
    }else{
      const reply=data.reply||"No response received.";

      // Add assistant reply to history IMMEDIATELY (fixes second message bug)
      groqHist.push({role:"assistant", content:reply});

      // Update local chat
      chat.ms.push({r:"ai", t:reply});

      $(typId)?.remove();
      appendBubble("ai", reply);

      // Save to Firestore
      if(currentUser){
        const savedId=await saveOrCreateChat(chat);
        if(savedId && savedId!==chat.id){
          const old=chat.id;
          chat.id=savedId;
          acid=savedId;
          const i=chats.findIndex(c=>c.id===old);
          if(i!==-1) chats[i]=chat;
        }
        renderList(chats);
      }
    }

  }catch(e){
    console.error("sendMsg error:",e);
    $(typId)?.remove();
    groqHist.pop(); // remove failed message from history
    const msg=e.message.includes("fetch")||e.message.includes("Failed")
      ? "⚠️ Cannot connect to server. Make sure Python backend is running on port 5000."
      : "⚠️ "+e.message;
    appendBubble("ai", msg);
  }finally{
    // ALWAYS reset busy — this was the multi-message bug cause
    busy=false;
    $("sbtn").disabled=false;
  }
}

function appendBubble(role, text, scroll=true){
  const w=$("mw"); if(!w) return;
  const row=document.createElement("div");
  row.className="mrow"+(role==="u"?" usr":"");
  const fmt=role==="ai"?mdRender(text):esc(text).replace(/\n/g,"<br>");
  const aiAv=`<div class="mav ai">${aiIcon()}</div>`;
  const uAv=`<div class="mav us">${uInit}</div>`;
  row.innerHTML=role==="u"
    ?`<div class="bub user">${fmt}</div>${uAv}`
    :`${aiAv}<div class="bub ai">${fmt}</div>`;
  w.appendChild(row);
  if(scroll) row.scrollIntoView({behavior:"smooth"});
}

/* ════════════════════════════
   SIDEBAR COLLAPSE
════════════════════════════ */
function toggleCollapse(){
  sidebarCollapsed=!sidebarCollapsed;
  const sb=$("sidebar");
  sb.classList.toggle("collapsed", sidebarCollapsed);
  // Update expand button visibility
  const exp=$("sb-expand-btn");
  if(exp) exp.style.display=sidebarCollapsed?"flex":"none";
}

/* ════════════════════════════
   APP OBJECT
════════════════════════════ */
const APP={
  sendMsg,
  hk(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(); } },
  grow,

  /* Sidebar */
  toggleSB(){
    if(window.innerWidth<=768){
      $("sidebar").classList.toggle("open");
      $("sb-ov").classList.toggle("open");
    }else{
      toggleCollapse();
    }
  },
  collapseSB(){ toggleCollapse(); },

  /* New chat */
  newChat(){
    acid=null; groqHist=[];
    const name=currentUser?(currentUser.displayName||currentUser.email?.split("@")[0]||"there"):null;
    showWelcome(name, !!currentUser);
    renderList(chats);
    if(window.innerWidth<=768){
      $("sidebar").classList.remove("open");
      $("sb-ov").classList.remove("open");
    }
  },

  useCard(el){
    const text=el.querySelector(".w-card-desc").textContent;
    $("cinp").value=text; grow($("cinp")); sendMsg();
  },

  ldChat(id){
    const c=chats.find(x=>x.id===id); if(!c) return;
    acid=id;
    // Rebuild groqHist from saved messages
    groqHist=(c.ms||[]).map(m=>({
      role:m.r==="u"?"user":"assistant",
      content:m.t
    }));
    $("msgs").innerHTML='<div class="mwrap" id="mw"></div>';
    $("msgs").classList.add("has-msgs");
    (c.ms||[]).forEach(x=>appendBubble(x.r,x.t,false));
    $("msgs").scrollTop=$("msgs").scrollHeight;
    if($("topbar-title")) $("topbar-title").textContent=c.title;
    renderList(chats);
    if(window.innerWidth<=768){
      $("sidebar").classList.remove("open");
      $("sb-ov").classList.remove("open");
    }
  },

  async delChat(id){
    chats=chats.filter(c=>c.id!==id);
    await deleteChatFS(id);
    if(acid===id){ acid=null; groqHist=[]; APP.newChat(); }
    else renderList(chats);
    toast("Chat deleted");
  },

  searchChats(q){
    renderList(q?chats.filter(c=>c.title.toLowerCase().includes(q.toLowerCase())):chats);
  },

  /* Auth */
  openAuth(tab){
    $("auth-modal").classList.add("open");
    APP.switchTab(tab);
  },

  switchTab(tab){
    activeTab=tab;
    $("tab-login").classList.toggle("active",  tab==="login");
    $("tab-signup").classList.toggle("active", tab==="signup");
    $("panel-login").classList.toggle("active",  tab==="login");
    $("panel-signup").classList.toggle("active", tab==="signup");
    ["err-login","err-signup"].forEach(id=>{ const el=$(id); if(el) el.textContent=""; });
  },

  /* Email login */
  async doEmailLogin(){
    const email=$("login-email").value.trim();
    const pass=$("login-pass").value;
    if(!email||!pass){ APP.setErr("err-login","Please fill in all fields."); return; }
    APP.setBtnLoad("btn-email-login",true,"Signing in…");
    try{
      await auth.signInWithEmailAndPassword(email,pass);
    }catch(e){
      APP.setErr("err-login",APP.ferr(e.code));
      APP.setBtnLoad("btn-email-login",false,"Sign In");
    }
  },

  /* Email signup */
  async doEmailSignup(){
    const name=$("signup-name").value.trim();
    const email=$("signup-email").value.trim();
    const pass=$("signup-pass").value;
    const pass2=$("signup-pass2").value;
    if(!name||!email||!pass||!pass2){ APP.setErr("err-signup","Please fill in all fields."); return; }
    if(pass!==pass2){ APP.setErr("err-signup","Passwords do not match."); return; }
    if(pass.length<6){ APP.setErr("err-signup","Password must be at least 6 characters."); return; }
    APP.setBtnLoad("btn-email-signup",true,"Creating account…");
    try{
      const cred=await auth.createUserWithEmailAndPassword(email,pass);
      await cred.user.updateProfile({displayName:name});
      await cred.user.reload();
    }catch(e){
      APP.setErr("err-signup",APP.ferr(e.code));
      APP.setBtnLoad("btn-email-signup",false,"Create Account");
    }
  },

  /* Google */
  async doGoogle(){
    try{
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    }catch(e){
      const errId=activeTab==="login"?"err-login":"err-signup";
      APP.setErr(errId,APP.ferr(e.code));
    }
  },

  /* Forgot password */
  async doForgot(){
    const email=$("login-email").value.trim();
    if(!email){ APP.setErr("err-login","Enter your email address first."); return; }
    try{
      await auth.sendPasswordResetEmail(email);
      toast("Password reset email sent!","ok");
    }catch(e){ APP.setErr("err-login",APP.ferr(e.code)); }
  },

  /* Sign out */
  async signOut(){
    $("u-menu").classList.remove("open");
    await auth.signOut();
    toast("Signed out","ok");
  },

  /* Helpers */
  setErr(id,msg){ const el=$(id); if(el) el.textContent=msg; },
  setBtnLoad(id,on,label){
    const el=$(id); if(!el) return;
    el.disabled=on;
    el.innerHTML=on?`<span class="spin"></span>${label}`:label;
  },
  ferr(code){
    const m={
      "auth/user-not-found":       "No account found with this email.",
      "auth/wrong-password":       "Incorrect password.",
      "auth/invalid-credential":   "Incorrect email or password.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/invalid-email":        "Invalid email address.",
      "auth/weak-password":        "Password must be at least 6 characters.",
      "auth/too-many-requests":    "Too many attempts. Try again later.",
      "auth/popup-closed-by-user": "Sign in was cancelled.",
      "auth/unauthorized-domain":  "Open the app via http://localhost:5000",
      "auth/network-request-failed":"Network error. Check your connection.",
    };
    return m[code]||"Something went wrong. Please try again.";
  },

  toggleUMenu(){ $("u-menu").classList.toggle("open"); },
  openModal(id){ $(id).classList.add("open"); },
  closeModal(id){ $(id).classList.remove("open"); },
  toast,
};

/* ── Global listeners ── */
document.querySelectorAll(".modal-bg").forEach(m=>
  m.addEventListener("click",e=>{ if(e.target===m) m.classList.remove("open"); })
);
document.addEventListener("click",e=>{
  if(!e.target.closest(".user-tile")) $("u-menu")?.classList.remove("open");
});
window.addEventListener("load",()=>{
  checkServer();
  // sidebar hidden by default on desktop
  if(window.innerWidth > 768){
    $("sidebar").classList.add("collapsed");
    const exp=$("sb-expand-btn");
    if(exp) exp.style.display="flex";
  }
});
setInterval(checkServer, 30000);
