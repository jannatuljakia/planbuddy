import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const TYPES = [
  { id: 'quiz', label: 'Quiz', ic: '📖', color: 'var(--quiz)', bg: 'var(--quiz-bg)' },
  { id: 'assignment', label: 'Assignment', ic: '✏️', color: 'var(--assignment)', bg: 'var(--assignment-bg)' },
  { id: 'presentation', label: 'Presentation', ic: '📊', color: 'var(--presentation)', bg: 'var(--presentation-bg)' },
  { id: 'task', label: 'Task', ic: '📋', color: 'var(--task)', bg: 'var(--task-bg)' },
];

const NAV = [
  { id: 'dashboard', ic: '🏠', label: 'Dashboard' },
  { id: 'calendar', ic: '📅', label: 'Calendar' },
  { id: 'completed', ic: '✅', label: 'Completed' },
  { id: 'stats', ic: '📈', label: 'Statistics' },
  { id: 'subjects', ic: '📚', label: 'Subjects' },
  { id: 'settings', ic: '⚙️', label: 'Settings' },
];

function typeInfo(id) { return TYPES.find((t) => t.id === id) || TYPES[3]; }
function isDone(item) { return (item.completedBy || []).length >= 2; }
function hoursLeft(deadline) { return (new Date(deadline) - new Date()) / 36e5; }

function statusOf(item) {
  if (isDone(item)) return { key: 'COMPLETED', color: 'var(--done)', bg: 'var(--done-bg)' };
  const h = hoursLeft(item.deadline);
  if (h < 0) return { key: 'OVERDUE', color: 'var(--overdue)', bg: 'var(--overdue-bg)' };
  if (h <= 24) return { key: 'DUE SOON', color: 'var(--soon)', bg: 'var(--soon-bg)' };
  return { key: 'UPCOMING', color: 'var(--calm)', bg: 'var(--calm-bg)' };
}

function fmtTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function daysBetween(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

function remainingTimeLabel(h) {
  const past = h < 0;
  const absHours = Math.abs(h);

  if (absHours >= 24) {
    const days = Math.round(absHours / 24);
    return past ? `${days} দিন আগে পার হয়েছে` : `${days} দিন বাকি`;
  }

  const totalMinutes = Math.round(absHours * 60);

  if (totalMinutes < 60) {
    return past ? `${totalMinutes} মিনিট আগে পার হয়েছে` : `${totalMinutes} মিনিট বাকি`;
  }

  if (absHours < 2) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const hrPart = `${hrs} ঘণ্টা`;
    const minPart = mins > 0 ? ` ${mins} মিনিট` : '';
    return past ? `${hrPart}${minPart} আগে পার হয়েছে` : `${hrPart}${minPart} বাকি`;
  }

  const hrs = Math.round(totalMinutes / 60);
  return past ? `${hrs} ঘণ্টা আগে পার হয়েছে` : `${hrs} ঘণ্টা বাকি`;
}

function whenLabel(deadline) {
  const due = new Date(deadline);
  const now = new Date();
  const diffDays = daysBetween(now, due);
  const t = fmtTime(due);
  const h = hoursLeft(deadline);
  let l1;
  if (diffDays === 0) l1 = `Today, ${t}`;
  else if (diffDays === 1) l1 = `Tomorrow, ${t}`;
  else if (diffDays === -1) l1 = `Yesterday, ${t}`;
  else l1 = `${due.toLocaleString('en-US', { month: 'short' })} ${due.getDate()}, ${t}`;
  const l2 = remainingTimeLabel(h);
  return { l1, l2 };
}

function toLocalInputValue(isoStr) {
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function initialOf(name) { return (name || '?').trim().charAt(0).toUpperCase() || '?'; }

function normalizeLink(url) {
  const trimmed = (url || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function PlanBuddyApp() {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nav, setNav] = useState('dashboard');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notifState, setNotifState] = useState('off');
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ type: 'task', title: '', subject: '', deadline: '', description: '', link: '' });
  const [myName, setMyName] = useState('');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [calCursor, setCalCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [bellOpen, setBellOpen] = useState(false);
  const toastTimer = useRef(null);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('planner_dark_mode', next ? '1' : '0');
  }

  function saveName(n) {
    const trimmed = n.trim();
    if (!trimmed) return;
    localStorage.setItem('planner_my_name', trimmed);
    setMyName(trimmed);
    setNameModalOpen(false);
  }

  async function toggleComplete(item) {
    if (!myName) { setNameInput(''); setNameModalOpen(true); return; }
    try {
      const res = await fetch(`/api/items/${item.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: myName }),
      });
      if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
      const updated = await res.json();
      setItemsState((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      showToast(isDone(updated) ? 'দুজনেই সম্পন্ন করেছ! 🎉' : (updated.completedBy || []).includes(myName) ? 'সম্পন্ন হিসেবে চিহ্নিত হলো' : 'পুনরায় চালু করা হয়েছে');
    } catch (e) {
      console.error('Toggle error:', e);
      showToast('আপডেট করতে সমস্যা হয়েছে');
    }
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }

  async function fetchItems() {
    try {
      const res = await fetch('/api/items');
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      setItemsState(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch items error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();
    const poll = setInterval(fetchItems, 30000);

    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifState('on');
    } else if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotifState('unsupported');
    }

    const savedName = localStorage.getItem('planner_my_name');
    if (savedName) { setMyName(savedName); } else { setNameModalOpen(true); }

    const savedDark = localStorage.getItem('planner_dark_mode');
    if (savedDark === '1') { setDarkMode(true); document.documentElement.classList.add('dark'); }

    return () => clearInterval(poll);
  }, []);

  async function enableNotifications() {
    if (notifState === 'unsupported') { showToast('তোমার ব্রাউজার পুশ নোটিফিকেশন সাপোর্ট করে না'); return; }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { showToast('নোটিফিকেশন পারমিশন দাওনি'); return; }
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) { showToast('সার্ভারে VAPID কী সেট করা নেই'); return; }
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) await existingSub.unsubscribe();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
      const res = await fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);
      setNotifState('on');
      showToast('রিমাইন্ডার অন হয়েছে 🔔');
    } catch (e) {
      console.error('Notification error:', e);
      showToast('নোটিফিকেশন চালু করতে সমস্যা হয়েছে: ' + e.message);
    }
  }

  function openAddModal() {
    setEditing(null);
    setForm({ type: 'task', title: '', subject: '', deadline: '', description: '', link: '' });
    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditing(item);
    setForm({ type: item.type, title: item.title, subject: item.subject || '', deadline: toLocalInputValue(item.deadline), description: item.description || '', link: item.link || '' });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return showToast('শিরোনাম দিতে হবে');
    if (!form.deadline) return showToast('ডেডলাইন দিতে হবে');
    const payload = {
      type: form.type, title: form.title.trim(), subject: form.subject.trim(),
      deadline: new Date(form.deadline).toISOString(), description: form.description.trim(), link: normalizeLink(form.link),
    };
    try {
      const res = editing
        ? await fetch(`/api/items/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/items', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error || `Error ${res.status}`); }
      await fetchItems();
      setModalOpen(false);
      setEditing(null);
      setForm({ type: 'task', title: '', subject: '', deadline: '', description: '', link: '' });
      showToast(editing ? 'আপডেট হয়েছে' : 'নতুন টাস্ক যোগ হয়েছে 🎉');
    } catch (e) {
      console.error('Save error:', e);
      showToast('সেভ করতে সমস্যা হয়েছে');
    }
  }

  async function handleDelete(id) {
    if (!confirm('এই টাস্কটা মুছে ফেলতে চাও?')) return;
    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await fetchItems();
      showToast('টাস্ক ডিলিট হয়েছে');
    } catch (e) {
      console.error('Delete error:', e);
      showToast('মুছতে সমস্যা হয়েছে');
    }
  }

  const allNames = Array.from(new Set([...(myName ? [myName] : []), ...items.flatMap((i) => i.completedBy || [])])).slice(0, 4);

  function passesCommonFilters(item) {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      const hay = `${item.title} ${item.subject || ''} ${item.description || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  let list = items.filter(passesCommonFilters);
  if (nav === 'completed') list = list.filter(isDone);
  if (nav === 'calendar' && selectedDay) list = list.filter((i) => sameDay(new Date(i.deadline), selectedDay));
  if (nav === 'completed') {
  list = list.slice().sort((a, b) => (b.lastCompletedAt || 0) - (a.lastCompletedAt || 0));
} else {
  list = list.slice().sort((a, b) => {
    const doneA = isDone(a) ? 1 : 0;
    const doneB = isDone(b) ? 1 : 0;
    if (doneA !== doneB) return doneA - doneB;
    return new Date(a.deadline) - new Date(b.deadline);
  });
}

  const pending = items.filter((i) => !isDone(i));
  const counts = {
    total: items.length,
    completed: items.filter(isDone).length,
    dueSoon: pending.filter((i) => { const h = hoursLeft(i.deadline); return h >= 0 && h <= 24; }).length,
    overdue: pending.filter((i) => hoursLeft(i.deadline) < 0).length,
    upcoming: pending.filter((i) => hoursLeft(i.deadline) > 24).length,
  };

  const greetHour = new Date().getHours();
  const greetWord = greetHour < 12 ? 'সুপ্রভাত' : greetHour < 17 ? 'Good afternoon' : 'Good evening';
  const greetEmoji = greetHour < 12 ? '🌅' : greetHour < 17 ? '☀️' : '🌙';
  const upcomingForBell = pending.slice().sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 5);

  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  const first = new Date(y, m, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysInPrev = new Date(y, m, 0).getDate();
  const today = new Date();
  const taskDaySet = new Set(items.map((i) => { const d = new Date(i.deadline); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }));
  const calCells = [];
  for (let i = startDow - 1; i >= 0; i--) calCells.push({ n: daysInPrev - i, mute: true });
  for (let d = 1; d <= daysInMonth; d++) calCells.push({ n: d, date: new Date(y, m, d), isToday: sameDay(new Date(y, m, d), today), isSel: selectedDay && sameDay(new Date(y, m, d), selectedDay), has: taskDaySet.has(`${y}-${m}-${d}`) });
  const trailing = (7 - (calCells.length % 7)) % 7;
  for (let d = 1; d <= trailing; d++) calCells.push({ n: d, mute: true });

  const rate = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;
  const byCat = {};
  TYPES.forEach((t) => (byCat[t.id] = items.filter((i) => i.type === t.id).length));
  const maxCat = Math.max(1, ...Object.values(byCat));
  const subjectMap = {};
  items.forEach((i) => {
    const key = i.subject && i.subject.trim() ? i.subject.trim() : 'বিষয় নেই';
    subjectMap[key] = subjectMap[key] || { total: 0, done: 0 };
    subjectMap[key].total++;
    if (isDone(i)) subjectMap[key].done++;
  });

  function TaskCard(item) {
    const t = typeInfo(item.type);
    const st = statusOf(item);
    const when = whenLabel(item.deadline);
    const completedBy = item.completedBy || [];
    const iAmDone = myName && completedBy.includes(myName);
    return (
      <div className={`task-card ${isDone(item) ? 'done' : ''}`} style={{ borderLeftColor: t.color }} key={item.id}>
        <div className="t-ic" style={{ background: t.bg, color: t.color }}>{t.ic}</div>
        <div className="t-body">
          <div className="t-title">{item.title}</div>
          <div className="t-subject" style={{ color: t.color }}>{t.label}{item.subject ? ` · ${item.subject}` : ''}</div>
          {item.description ? <div className="t-meta">📄 {item.description}</div> : null}
          {item.link ? <a className="t-link" href={normalizeLink(item.link)} target="_blank" rel="noopener noreferrer">🔗 লিংক দেখো</a> : null}
        </div>
        <div className="t-when">
          <div className="l1">📅 {when.l1}</div>
          <div className="l2">{when.l2}</div>
          <span className="badge" style={{ color: st.color, background: st.bg }}>{st.key}</span>
        </div>
        <div className="doneby">
          <div className="avs">
            {allNames.length ? allNames.map((n, idx) => (
              <span key={n} className={`avatar sm ${completedBy.includes(n) ? 'filled' : 'outline'} ${idx % 2 ? 'pink' : ''}`} title={completedBy.includes(n) ? `${n} ✓` : n}>
                {completedBy.includes(n) ? initialOf(n) : ''}
              </span>
            )) : <span className="avatar sm outline"></span>}
          </div>
        </div>
        <button className={`check ${iAmDone ? 'on' : ''}`} onClick={() => toggleComplete(item)} title={iAmDone ? 'আনডু করো' : 'আমি করেছি'}>{iAmDone ? '✓' : ''}</button>
        <button className="more" onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}>⋮</button>
        {openMenuId === item.id && (
          <div className="menu">
            <button onClick={() => { openEditModal(item); setOpenMenuId(null); }}>✏️ Edit</button>
            <button className="danger" onClick={() => { handleDelete(item.id); setOpenMenuId(null); }}>🗑️ Delete</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>PlanBuddy</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%92%9C</text></svg>" />
      </Head>

      <div className="app" onClick={() => { if (openMenuId) setOpenMenuId(null); if (bellOpen) setBellOpen(false); }}>
        <aside className="sidebar">
          <div className="logo"><span className="heart">💜</span><span className="plan">Plan</span><span className="buddy">Buddy</span></div>
          <div className="tagline">Our tasks, our success ✨</div>
          <nav>
            {NAV.map((n) => (
              <button key={n.id} className={`navitem ${nav === n.id ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setNav(n.id); }}>
                <span className="ic">{n.ic}</span>{n.label}
              </button>
            ))}
          </nav>
          <div className="side-spacer" />
          <div className="friend-card">
            <div className="emo">💜</div>
            <h4 style={{ background: 'var(--grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{myName ? `Hello, ${myName}!` : 'Hello!'}</h4>
            <p>Let's complete our plans together!</p>
            {myName && <button className="change-name" onClick={(e) => { e.stopPropagation(); setNameInput(myName); setNameModalOpen(true); }}>নাম বদলাও</button>}
          </div>
          <div className="darkrow">
            <span>🌙 Dark Mode</span>
            <button className={`switch ${darkMode ? 'on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }} />
          </div>
          <div className="sidebar-footer">© 2026 PlanBuddy</div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h1>{greetWord}{myName ? `, ${myName}` : ''}! {greetEmoji}</h1>
              <p>Stay organized, stay ahead.</p>
            </div>
            <div className="top-actions">
              <button className="btn-primary" onClick={(e) => { e.stopPropagation(); openAddModal(); }}>➕ Add New Task</button>
              <button className="iconbtn" onClick={(e) => { e.stopPropagation(); if (notifState === 'on') { setBellOpen((v) => !v); } else { enableNotifications(); } }}>
                🔔{notifState !== 'on' && <span className="dot" />}
              </button>
              {bellOpen && (
                <div className="bell-panel" onClick={(e) => e.stopPropagation()}>
                  <div className="bell-head">🔔 Reminders</div>
                  {upcomingForBell.length ? upcomingForBell.map((i) => {
                    const st = statusOf(i);
                    return (
                      <div className="bell-item" key={i.id}>
                        <b>{i.title}</b><br />
                        <span style={{ color: st.color }}>{st.key}</span>{' · '}
                        {new Date(i.deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    );
                  }) : <div className="bell-item muted">কোনো পেন্ডিং টাস্ক নেই 🎉</div>}
                </div>
              )}
              <button className={`avatar ${myName && myName.length % 2 ? 'pink' : ''}`} onClick={(e) => { e.stopPropagation(); setNameInput(myName); setNameModalOpen(true); }}>
                {myName ? initialOf(myName) : '?'}
              </button>
            </div>
          </div>

          {nav === 'settings' ? (
            <SettingsView myName={myName} onChangeName={() => { setNameInput(myName); setNameModalOpen(true); }} notifState={notifState} onEnableNotif={enableNotifications} darkMode={darkMode} onToggleDark={toggleDarkMode} />
          ) : nav === 'stats' ? (
            <StatsView rate={rate} counts={counts} byCat={byCat} maxCat={maxCat} />
          ) : nav === 'subjects' ? (
            <SubjectsView subjectMap={subjectMap} />
          ) : (
            <>
              <div className="stats-row">
                <StatCard ic="📋" num={counts.total} lbl="Total Tasks" color="var(--quiz)" bg="var(--quiz-bg)" />
                <StatCard ic="✅" num={counts.completed} lbl="Completed" color="var(--assignment)" bg="var(--assignment-bg)" />
                <StatCard ic="⏰" num={counts.dueSoon} lbl="Due Soon" color="var(--presentation)" bg="var(--presentation-bg)" />
                <StatCard ic="⚠️" num={counts.overdue} lbl="Overdue" color="var(--overdue)" bg="var(--overdue-bg)" />
              </div>
              <div className="content-grid">
                <div className="left-col">
                  <div className="filter-row">
                    <button className={`tab ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>All</button>
                    {TYPES.map((t) => (
                      <button key={t.id} className={`tab ${typeFilter === t.id ? 'active' : ''}`} onClick={() => setTypeFilter(t.id)}>{t.ic} {t.label}</button>
                    ))}
                    <div className="search-wrap">
                      <span>🔎</span>
                      <input placeholder="Search tasks..." value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
                    </div>
                  </div>
                  {nav === 'calendar' && selectedDay && (
                    <div className="daysel">📅 দেখাচ্ছে: <b>{selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</b></div>
                  )}
                  {loading ? (
  <div className="empty">লোড হচ্ছে...</div>
) : list.length === 0 ? (
  <div className="empty"><div className="e-ic">🗒️</div><div className="e-title">কোনো টাস্ক নেই</div><div>নতুন টাস্ক যোগ করে শুরু করো</div></div>
) : list.map(TaskCard)}

{!loading && nav === 'dashboard' && <BuddyIllustration />}
                </div>
                <div className="right-col">
                  <div className="panel">
                    <div className="cal-head">
                      <button onClick={() => setCalCursor(new Date(y, m - 1, 1))}>‹</button>
                      <b>{calCursor.toLocaleString('en-US', { month: 'long' })} {y}</b>
                      <button onClick={() => setCalCursor(new Date(y, m + 1, 1))}>›</button>
                    </div>
                    <div className="cal-grid">
                      {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <div className="dow" key={d}>{d}</div>)}
                      {calCells.map((c, idx) => (
                        <div key={idx} className={`day ${c.mute ? 'mute' : ''} ${c.isToday ? 'today' : ''} ${c.has ? 'has' : ''} ${c.isSel ? 'sel' : ''}`}
                          onClick={() => { if (!c.mute) { setSelectedDay(c.date); setNav('calendar'); } }}>{c.n}</div>
                      ))}
                    </div>
                  </div>
                  <div className="panel">
                    <b className="panel-title">Quick Summary</b>
                    <SummaryRow color="var(--overdue)" label="Overdue" val={counts.overdue} />
                    <SummaryRow color="var(--soon)" label="Due Soon" val={counts.dueSoon} />
                    <SummaryRow color="var(--calm)" label="Upcoming" val={counts.upcoming} />
                    <SummaryRow color="var(--done)" label="Completed" val={counts.completed} />
                    <div className="summary-row total"><span>Total Tasks</span><b>{counts.total}</b></div>
                  </div>
                  <div className="tip-card"><h4>You've got this! 💪</h4><p>Small steps every day lead to big results.</p></div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {modalOpen && (
        <div className="overlay" onClick={(e) => e.target.classList.contains('overlay') && setModalOpen(false)}>
          <div className="modal">
            <h3>{editing ? '✏️ Edit Task' : '➕ Add New Task'}</h3>
            <div className="field"><label>টাইটেল</label><input type="text" placeholder="যেমন: AI Quiz 1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="field"><label>বিষয় (Subject)</label><input type="text" placeholder="যেমন: Artificial Intelligence" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></div>
            <div className="field">
              <label>ক্যাটাগরি</label>
              <div className="catrow">
                {TYPES.map((t) => (
                  <div key={t.id} className={`catchip ${form.type === t.id ? 'sel' : ''}`} style={form.type === t.id ? { background: t.color, borderColor: t.color, color: '#fff' } : {}} onClick={() => setForm((f) => ({ ...f, type: t.id }))}>{t.ic} {t.label}</div>
                ))}
              </div>
            </div>
            <div className="field"><label>ডেডলাইন</label><input type="datetime-local" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} /></div>
            <div className="field"><label>নোট / বিবরণ</label><textarea placeholder="যেমন: Chapters 5-7" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="field"><label>লিংক (Google Drive/Docs ইত্যাদি)</label><input type="url" placeholder="https://..." value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} /></div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setModalOpen(false)}>বাতিল</button>
              <button className="btn-solid" onClick={handleSave}>{editing ? 'আপডেট করো' : 'যোগ করো'}</button>
            </div>
          </div>
        </div>
      )}

      {nameModalOpen && (
        <div className="overlay">
          <div className="modal name-modal">
            <h3>তুমি কে? 👋</h3>
            <p className="name-sub">"Done by" আর "✓" বাটনে কে চাপছে বোঝার জন্য শুধু একবার নামটা লাগবে — এই ডিভাইসে মনে থাকবে।</p>
            <div className="field">
              <input type="text" autoFocus placeholder="তোমার নাম লিখো (যেমন: Jannat)" value={nameInput} onChange={(e) => setNameInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName(nameInput)} />
            </div>
            <div className="modal-actions"><button className="btn-solid full" onClick={() => saveName(nameInput)}>ঠিক আছে</button></div>
          </div>
        </div>
      )}

      {toast && <div className="toast">✅ {toast}</div>}
    </>
  );
}

function StatCard({ ic, num, lbl, color, bg }) {
  return (
    <div className="stat-card">
      <div className="stat-ic" style={{ background: bg, color }}>{ic}</div>
      <div><div className="num">{num}</div><div className="lbl">{lbl}</div></div>
    </div>
  );
}

function SummaryRow({ color, label, val }) {
  return (
    <div className="summary-row">
      <span className="l"><span className="sw" style={{ background: color }} />{label}</span>
      <b>{val}</b>
    </div>
  );
}

function StatsView({ rate, counts, byCat, maxCat }) {
  return (
    <div className="settings-wrap">
      <div className="settings-block">
        <h3>📈 সার্বিক অগ্রগতি</h3>
        <div className="big-num">{rate}%</div>
        <div className="sub">টাস্ক সম্পন্নের হার ({counts.completed}/{counts.total})</div>
        <div className="bar"><div className="bar-fill" style={{ width: `${rate}%` }} /></div>
      </div>
      <div className="settings-block">
        <h3>📊 ক্যাটাগরি অনুযায়ী টাস্ক</h3>
        {TYPES.map((t) => (
          <div className="cat-row" key={t.id}>
            <div className="cat-row-top"><span>{t.ic} {t.label}</span><b>{byCat[t.id] || 0}</b></div>
            <div className="bar"><div className="bar-fill" style={{ width: `${((byCat[t.id] || 0) / maxCat) * 100}%`, background: t.color }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectsView({ subjectMap }) {
  const entries = Object.entries(subjectMap);
  return (
    <div className="content-grid single">
      {entries.length ? entries.map(([name, v]) => (
        <div className="task-card" style={{ borderLeftColor: 'var(--purple)' }} key={name}>
          <div className="t-ic" style={{ background: 'var(--quiz-bg)', color: 'var(--purple)' }}>📚</div>
          <div className="t-body"><div className="t-title">{name}</div><div className="t-meta">{v.done}/{v.total} completed</div></div>
        </div>
      )) : (
        <div className="empty"><div className="e-ic">📚</div><div className="e-title">কোনো বিষয় নেই</div></div>
      )}
    </div>
  );
}

function SettingsView({ myName, onChangeName, notifState, onEnableNotif, darkMode, onToggleDark }) {
  return (
    <div className="settings-wrap">
      <div className="settings-block">
        <h3>👤 বর্তমান ব্যবহারকারী</h3>
        <div className="srow">
          <div><div className="st">তুমি এখন</div><div className="sd">এই নামেই "Done by" আর অ্যাক্টিভিটি ট্র্যাক হয়</div></div>
          <b>{myName || 'নাম নেই'}</b>
        </div>
        <button className="btn-ghost" onClick={onChangeName}>নাম বদলাও</button>
      </div>
      <div className="settings-block">
        <h3>🔔 Reminder Notifications</h3>
        <div className="srow">
          <div><div className="st">Push Reminders</div><div className="sd">ডেডলাইনের ২৪ ঘণ্টা ও ১ ঘণ্টা আগে ব্রাউজার বন্ধ থাকলেও নোটিফিকেশন আসবে</div></div>
          <button className="btn-ghost" onClick={onEnableNotif} disabled={notifState === 'on'}>
            {notifState === 'on' ? 'চালু ✅' : notifState === 'unsupported' ? 'সাপোর্ট নেই' : 'Enable'}
          </button>
        </div>
        <div className="note">নোট: রিমাইন্ডার সার্ভার থেকে পাঠানো হয়, তাই এটা চেক করার ফ্রিকোয়েন্সি নির্ভর করে cron শিডিউলের উপর।</div>
      </div>
      <div className="settings-block">
        <h3>🌙 Appearance</h3>
        <div className="srow">
          <div><div className="st">Dark Mode</div><div className="sd">এই ডিভাইসে মনে থাকবে</div></div>
          <button className={`switch ${darkMode ? 'on' : ''}`} onClick={onToggleDark} />
        </div>
      </div>
      <div className="settings-block">
        <h3>👥 কীভাবে দুজনে ব্যবহার করবে</h3>
        <div className="note">লিংকটা তোমার বন্ধুকে পাঠাও — সে ওপেন করলে তার নাম জিজ্ঞেস করবে, তারপর দুজনেই একই টাস্ক লিস্ট দেখবে ও এডিট করতে পারবে।</div>
      </div>
    </div>
  );
}
function BuddyIllustration() {
  return (
    <div className="buddy-illus">
      <svg viewBox="0 0 300 160" className="buddy-svg">
        <ellipse cx="150" cy="145" rx="130" ry="10" fill="var(--panel-2)" />
        <circle cx="95" cy="60" r="26" fill="var(--purple)" opacity="0.9" />
        <rect x="70" y="82" width="50" height="55" rx="18" fill="var(--purple)" />
        <rect x="55" y="90" width="16" height="45" rx="8" fill="var(--purple)" opacity="0.85" transform="rotate(-25 63 112)" />
        <circle cx="205" cy="60" r="26" fill="#ec4899" opacity="0.9" />
        <rect x="180" y="82" width="50" height="55" rx="18" fill="#ec4899" />
        <rect x="229" y="90" width="16" height="45" rx="8" fill="#ec4899" opacity="0.85" transform="rotate(25 237 112)" />
        <rect x="140" y="55" width="20" height="16" rx="6" fill="#fff" />
        <path d="M150 40 C146 34 136 36 136 44 C136 50 150 58 150 58 C150 58 164 50 164 44 C164 36 154 34 150 40 Z" fill="var(--overdue)" opacity="0.85" />
        <circle cx="50" cy="35" r="3" fill="var(--purple)" opacity="0.4" />
        <circle cx="250" cy="45" r="4" fill="#ec4899" opacity="0.4" />
        <circle cx="270" cy="90" r="3" fill="var(--purple)" opacity="0.4" />
      </svg>
      <div className="buddy-text">
        <h4>You've got this! 💪</h4>
        <p>Small steps every day lead to big results.</p>
      </div>
    </div>
  );
}
export default dynamic(() => Promise.resolve(PlanBuddyApp), { ssr: false });
