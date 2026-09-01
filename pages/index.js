import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';

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

function typeInfo(id) {
  return TYPES.find((t) => t.id === id) || TYPES[3];
}

function isDone(item) {
  return (item.completedBy || []).length >= 2;
}

function hoursLeft(deadline) {
  return (new Date(deadline) - new Date()) / 36e5;
}

function statusOf(item) {
  if (isDone(item)) return { key: 'COMPLETED', color: 'var(--done)', bg: 'var(--done-bg)' };

  const h = hoursLeft(item.deadline);

  if (h < 0) {
    return {
      key: 'OVERDUE',
      color: 'var(--overdue)',
      bg: 'var(--overdue-bg)',
    };
  }

  if (h <= 24) {
    return {
      key: 'DUE SOON',
      color: 'var(--soon)',
      bg: 'var(--soon-bg)',
    };
  }

  return {
    key: 'UPCOMING',
    color: 'var(--calm)',
    bg: 'var(--calm-bg)',
  };
}

function fmtTime(d) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';

  h = h % 12 || 12;

  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function daysBetween(a, b) {
  const A = new Date(
    a.getFullYear(),
    a.getMonth(),
    a.getDate()
  );

  const B = new Date(
    b.getFullYear(),
    b.getMonth(),
    b.getDate()
  );

  return Math.round((B - A) / 86400000);
}

function remainingTimeLabel(h) {
  // h = hoursLeft (negative হলে overdue, positive হলে due soon)
  const totalMinutes = Math.round(Math.abs(h) * 60);

  let value, unit;

  if (totalMinutes < 60) {
    value = totalMinutes;
    unit = 'মিনিট';
  } else {
    value = Math.round(totalMinutes / 60);
    unit = 'ঘণ্টা';
  }

  return h < 0
    ? `${value} ${unit} আগে পার হয়েছে`
    : `${value} ${unit} বাকি`;
}

function whenLabel(deadline) {
  const due = new Date(deadline);
  const now = new Date();

  const diffDays = daysBetween(now, due);
  const t = fmtTime(due);
  const h = hoursLeft(deadline);

  // l1 — আগের মতোই, কোনো পরিবর্তন নেই
  let l1;

  if (diffDays === 0) {
    l1 = `Today, ${t}`;
  } else if (diffDays === 1) {
    l1 = `Tomorrow, ${t}`;
  } else if (diffDays === -1) {
    l1 = `Yesterday, ${t}`;
  } else {
    l1 = `${due.toLocaleString('en-US', {
      month: 'short',
    })} ${due.getDate()}, ${t}`;
  }

  // l2 — DUE SOON / OVERDUE হলে remaining/elapsed time,
  // নাহলে (UPCOMING) আগের দিন-ভিত্তিক ফরম্যাট
  let l2;

  if (h <= 24) {
    l2 = remainingTimeLabel(h);
  } else {
    l2 = `${diffDays} দিন বাকি`;
  }

  return { l1, l2 };
}
function toLocalInputValue(isoStr) {
  const d = new Date(isoStr);

  const pad = (n) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(
    d.getMonth() + 1
  )}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function initialOf(name) {
  return (
    (name || '?').trim().charAt(0).toUpperCase() || '?'
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);

  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function Home() {
  const [items, setItemsState] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nav, setNav] = useState('dashboard');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQ, setSearchQ] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [notifState, setNotifState] = useState('off');
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    type: 'task',
    title: '',
    subject: '',
    deadline: '',
    description: '',
    link: '',
  });

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

    document.documentElement.classList.toggle(
      'dark',
      next
    );

    localStorage.setItem(
      'planner_dark_mode',
      next ? '1' : '0'
    );
  }

  function saveName(n) {
    const trimmed = n.trim();

    if (!trimmed) return;

    localStorage.setItem('planner_my_name', trimmed);

    setMyName(trimmed);
    setNameModalOpen(false);
  }

  async function toggleComplete(item) {
    if (!myName) {
      setNameInput('');
      setNameModalOpen(true);
      return;
    }

    try {
      const res = await fetch(
        `/api/items/${item.id}/toggle`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: myName,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(
          `Toggle failed: ${res.status}`
        );
      }

      const updated = await res.json();

      setItemsState((prev) =>
        prev.map((i) =>
          i.id === updated.id ? updated : i
        )
      );

      showToast(
        isDone(updated)
          ? 'দুজনেই সম্পন্ন করেছ! 🎉'
          : (updated.completedBy || []).includes(myName)
          ? 'সম্পন্ন হিসেবে চিহ্নিত হলো'
          : 'পুনরায় চালু করা হয়েছে'
      );
    } catch (e) {
      console.error('Toggle error:', e);
      showToast('আপডেট করতে সমস্যা হয়েছে');
    }
  }

  function showToast(msg) {
    setToast(msg);

    clearTimeout(toastTimer.current);

    toastTimer.current = setTimeout(
      () => setToast(''),
      2800
    );
  }

  async function fetchItems() {
    try {
      const res = await fetch('/api/items');

      if (!res.ok) {
        throw new Error(
          `Fetch failed: ${res.status}`
        );
      }

      const data = await res.json();

      setItemsState(
        Array.isArray(data) ? data : []
      );
    } catch (e) {
      console.error('Fetch items error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchItems();

    const poll = setInterval(
      fetchItems,
      30000
    );

    if (
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      setNotifState('on');
    } else if (
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setNotifState('unsupported');
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {});
    }

    const savedName =
      localStorage.getItem('planner_my_name');

    if (savedName) {
      setMyName(savedName);
    } else {
      setNameModalOpen(true);
    }

    const savedDark =
      localStorage.getItem('planner_dark_mode');

    if (savedDark === '1') {
      setDarkMode(true);
      document.documentElement.classList.add(
        'dark'
      );
    }

    return () => clearInterval(poll);
  }, []);

  async function enableNotifications() {
    if (notifState === 'unsupported') {
      showToast(
        'তোমার ব্রাউজার পুশ নোটিফিকেশন সাপোর্ট করে না'
      );
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      if (permission !== 'granted') {
        showToast(
          'নোটিফিকেশন পারমিশন দাওনি'
        );
        return;
      }

      const reg =
        await navigator.serviceWorker.ready;

      const publicKey =
        process.env
          .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

      if (!publicKey) {
        showToast(
          'সার্ভারে VAPID কী সেট করা নেই'
        );
        return;
      }

      const sub =
        await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(publicKey),
        });

      const res = await fetch(
        '/api/subscribe',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sub),
        }
      );

      if (!res.ok) {
        throw new Error(
          `Subscribe failed: ${res.status}`
        );
      }

      setNotifState('on');

      showToast(
        'রিমাইন্ডার অন হয়েছে 🔔'
      );
    } catch (e) {
      console.error(
        'Notification error:',
        e
      );

      showToast(
        'নোটিফিকেশন চালু করতে সমস্যা হয়েছে'
      );
    }
  }

  function openAddModal() {
    setEditing(null);

    setForm({
      type: 'task',
      title: '',
      subject: '',
      deadline: '',
      description: '',
      link: '',
    });

    setModalOpen(true);
  }

  function openEditModal(item) {
    setEditing(item);

    setForm({
      type: item.type,
      title: item.title,
      subject: item.subject || '',
      deadline: toLocalInputValue(
        item.deadline
      ),
      description:
        item.description || '',
      link: item.link || '',
    });

    setModalOpen(true);
  }

  /*
   * FIX:
   * Task save করার পরে API response check করা হচ্ছে।
   * Successful POST/PUT হলে fetchItems() দিয়ে
   * dashboard-এর items state refresh করা হচ্ছে।
   */
  async function handleSave() {
  if (!form.title.trim()) {
    return showToast('শিরোনাম দিতে হবে');
  }

  if (!form.deadline) {
    return showToast('ডেডলাইন দিতে হবে');
  }

  const payload = {
    type: form.type,
    title: form.title.trim(),
    subject: form.subject.trim(),
    deadline: new Date(form.deadline).toISOString(),
    description: form.description.trim(),
    link: form.link.trim(),
  };

  try {
    let res;

    if (editing) {
      res = await fetch(`/api/items/${editing.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    }

    // Server actually accepted the request কিনা check
    if (!res.ok) {
      let errorMessage = `Request failed (${res.status})`;

      try {
        const errorData = await res.json();

        if (errorData?.error) {
          errorMessage = errorData.error;
        }
      } catch (_) {}

      throw new Error(errorMessage);
    }

    // Server থেকে save হওয়ার পরে dashboard আবার load হবে
    await fetchItems();

    // Modal reset
    setModalOpen(false);
    setEditing(null);

    setForm({
      type: 'task',
      title: '',
      subject: '',
      deadline: '',
      description: '',
      link: '',
    });

    showToast(
      editing
        ? 'আপডেট হয়েছে ✅'
        : 'নতুন টাস্ক যোগ হয়েছে 🎉'
    );

  } catch (error) {
    console.error('Task save failed:', error);
    showToast('সেভ করতে সমস্যা হয়েছে');
  }
}
  async function handleDelete(id) {
    if (
      !confirm(
        'এই টাস্কটা মুছে ফেলতে চাও?'
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/items/${id}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        throw new Error(
          `Delete failed: ${res.status}`
        );
      }

      await fetchItems();

      showToast(
        'টাস্ক ডিলিট হয়েছে'
      );
    } catch (e) {
      console.error(
        'Delete error:',
        e
      );

      showToast(
        'মুছতে সমস্যা হয়েছে'
      );
    }
  }

  // ---------- derived data ----------

  const allNames = Array.from(
    new Set([
      ...(myName ? [myName] : []),
      ...items.flatMap(
        (i) => i.completedBy || []
      ),
    ])
  ).slice(0, 4);

  function passesCommonFilters(item) {
    if (
      typeFilter !== 'all' &&
      item.type !== typeFilter
    ) {
      return false;
    }

    if (searchQ.trim()) {
      const q =
        searchQ.toLowerCase();

      const hay =
        `${item.title} ${
          item.subject || ''
        } ${
          item.description || ''
        }`.toLowerCase();

      if (!hay.includes(q)) {
        return false;
      }
    }

    return true;
  }

  let list = items.filter(
    passesCommonFilters
  );

  if (nav === 'completed') {
    list = list.filter(isDone);
  }

  if (
    nav === 'calendar' &&
    selectedDay
  ) {
    list = list.filter((i) =>
      sameDay(
        new Date(i.deadline),
        selectedDay
      )
    );
  }

  list = list
    .slice()
    .sort(
      (a, b) =>
        new Date(a.deadline) -
        new Date(b.deadline)
    );

  const pending = items.filter(
    (i) => !isDone(i)
  );

  const counts = {
    total: items.length,

    completed:
      items.filter(isDone).length,

    dueSoon: pending.filter((i) => {
      const h = hoursLeft(
        i.deadline
      );

      return h >= 0 && h <= 24;
    }).length,

    overdue: pending.filter(
      (i) =>
        hoursLeft(i.deadline) < 0
    ).length,

    upcoming: pending.filter(
      (i) =>
        hoursLeft(i.deadline) > 24
    ).length,
  };

  const greetHour =
    new Date().getHours();

  const greetWord =
    greetHour < 12
      ? 'সুপ্রভাত'
      : greetHour < 17
      ? 'Good afternoon'
      : 'Good evening';

  const greetEmoji =
    greetHour < 12
      ? '🌅'
      : greetHour < 17
      ? '☀️'
      : '🌙';

  const upcomingForBell = pending
    .slice()
    .sort(
      (a, b) =>
        new Date(a.deadline) -
        new Date(b.deadline)
    )
    .slice(0, 5);

  // ---------- calendar ----------

  const y =
    calCursor.getFullYear();

  const m =
    calCursor.getMonth();

  const first = new Date(
    y,
    m,
    1
  );

  const startDow =
    first.getDay();

  const daysInMonth =
    new Date(
      y,
      m + 1,
      0
    ).getDate();

  const daysInPrev =
    new Date(
      y,
      m,
      0
    ).getDate();

  const today = new Date();

  const taskDaySet = new Set(
    items.map((i) => {
      const d =
        new Date(i.deadline);

      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const calCells = [];

  for (
    let i = startDow - 1;
    i >= 0;
    i--
  ) {
    calCells.push({
      n: daysInPrev - i,
      mute: true,
    });
  }

  for (
    let d = 1;
    d <= daysInMonth;
    d++
  ) {
    calCells.push({
      n: d,

      date: new Date(
        y,
        m,
        d
      ),

      isToday: sameDay(
        new Date(
          y,
          m,
          d
        ),
        today
      ),

      isSel:
        selectedDay &&
        sameDay(
          new Date(
            y,
            m,
            d
          ),
          selectedDay
        ),

      has: taskDaySet.has(
        `${y}-${m}-${d}`
      ),
    });
  }

  const trailing =
    (7 -
      (calCells.length % 7)) %
    7;

  for (
    let d = 1;
    d <= trailing;
    d++
  ) {
    calCells.push({
      n: d,
      mute: true,
    });
  }

  // ---------- statistics ----------

  const rate = counts.total
    ? Math.round(
        (counts.completed /
          counts.total) *
          100
      )
    : 0;

  const byCat = {};

  TYPES.forEach(
    (t) =>
      (byCat[t.id] =
        items.filter(
          (i) =>
            i.type === t.id
        ).length)
  );

  const maxCat = Math.max(
    1,
    ...Object.values(byCat)
  );

  // ---------- subjects ----------

  const subjectMap = {};

  items.forEach((i) => {
    const key =
      i.subject &&
      i.subject.trim()
        ? i.subject.trim()
        : 'বিষয় নেই';

    subjectMap[key] =
      subjectMap[key] || {
        total: 0,
        done: 0,
      };

    subjectMap[key].total++;

    if (isDone(i)) {
      subjectMap[key].done++;
    }
  });

  function TaskCard(item) {
    const t =
      typeInfo(item.type);

    const st =
      statusOf(item);

    const when =
      whenLabel(item.deadline);

    const completedBy =
      item.completedBy || [];

    const iAmDone =
      myName &&
      completedBy.includes(
        myName
      );

    return (
      <div
        className={`task-card ${
          isDone(item)
            ? 'done'
            : ''
        }`}
        style={{
          borderLeftColor:
            t.color,
        }}
        key={item.id}
      >
        <div
          className="t-ic"
          style={{
            background: t.bg,
            color: t.color,
          }}
        >
          {t.ic}
        </div>

        <div className="t-body">
          <div className="t-title">
            {item.title}
          </div>

          <div
            className="t-subject"
            style={{
              color: t.color,
            }}
          >
            {t.label}
            {item.subject
              ? ` · ${item.subject}`
              : ''}
          </div>

          {item.description ? (
            <div className="t-meta">
              📄 {item.description}
            </div>
          ) : null}

          {item.link ? (
            <a
              className="t-link"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              🔗 লিংক দেখো
            </a>
          ) : null}
        </div>

        <div className="t-when">
          <div className="l1">
            📅 {when.l1}
          </div>

          <div className="l2">
            {when.l2}
          </div>

          <span
            className="badge"
            style={{
              color: st.color,
              background: st.bg,
            }}
          >
            {st.key}
          </span>
        </div>

        <div className="doneby">
  <div className="avs">
    {allNames.length ? (
      allNames.map(
        (n, idx) => (
          <span
            key={n}
            className={`avatar sm ${
              completedBy.includes(
                n
              )
                ? 'filled'
                : 'outline'
            } ${
              idx % 2
                ? 'pink'
                : ''
            }`}
            title={
              completedBy.includes(
                n
              )
                ? `${n} ✓`
                : n
            }
          >
            {completedBy.includes(
              n
            )
              ? initialOf(n)
              : ''}
          </span>
        )
      )
    ) : (
      <span className="avatar sm outline"></span>
    )}
  </div>
</div>

        <button
          className={`check ${
            iAmDone
              ? 'on'
              : ''
          }`}
          onClick={() =>
            toggleComplete(item)
          }
          title={
            iAmDone
              ? 'আনডু করো'
              : 'আমি করেছি'
          }
        >
          {iAmDone ? '✓' : ''}
        </button>

        <button
          className="more"
          onClick={() =>
            setOpenMenuId(
              openMenuId === item.id
                ? null
                : item.id
            )
          }
        >
          ⋮
        </button>

        {openMenuId === item.id && (
          <div className="menu">
            <button
              onClick={() => {
                openEditModal(item);
                setOpenMenuId(
                  null
                );
              }}
            >
              ✏️ Edit
            </button>

            <button
              className="danger"
              onClick={() => {
                handleDelete(
                  item.id
                );

                setOpenMenuId(
                  null
                );
              }}
            >
              🗑️ Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Head>
  <title>
  PlanBuddy
  </title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%F0%9F%92%9C</text></svg>" />
</Head>

      <div
        className="app"
        onClick={() => {
          if (openMenuId) {
            setOpenMenuId(null);
          }

          if (bellOpen) {
            setBellOpen(false);
          }
        }}
      >
        <aside className="sidebar">
          <div className="logo">
            <span className="heart">
              💜
            </span>

            <span className="plan">Plan</span><span className="buddy">Buddy</span>
          </div>

          <div className="tagline">
            Our tasks, our success ✨
          </div>

          <nav>
            {NAV.map((n) => (
              <button
                key={n.id}
                className={`navitem ${
                  nav === n.id
                    ? 'active'
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setNav(n.id);
                }}
              >
                <span className="ic">
                  {n.ic}
                </span>

                {n.label}
              </button>
            ))}
          </nav>

          <div className="side-spacer" />

          <div className="friend-card">
            <div className="emo">
              🤝
            </div>

            <h4>
              {myName
                ? `Hello, ${myName}!`
                : 'Hello!'}{' '}
              👋
            </h4>

            <p>
              Let's complete our plans
              together!
            </p>

            {myName && (
              <button
                className="change-name"
                onClick={(e) => {
                  e.stopPropagation();

                  setNameInput(
                    myName
                  );

                  setNameModalOpen(
                    true
                  );
                }}
              >
                নাম বদলাও
              </button>
            )}
          </div>

          <div className="darkrow">
            <span>
              🌙 Dark Mode
            </span>

            <button
              className={`switch ${
                darkMode
                  ? 'on'
                  : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleDarkMode();
              }}
            />
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <h1>
                {greetWord}
                {myName
                  ? `, ${myName}`
                  : ''}
                ! {greetEmoji}
              </h1>

              <p>
                Stay organized, stay
                ahead.
              </p>
            </div>

            <div className="top-actions">
              <button
                className="btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  openAddModal();
                }}
              >
                ➕ Add New Task
              </button>

              <button
                className="iconbtn"
                onClick={(e) => {
                  e.stopPropagation();

                  if (
                    notifState ===
                    'on'
                  ) {
                    setBellOpen(
                      (v) => !v
                    );
                  } else {
                    enableNotifications();
                  }
                }}
              >
                🔔

                {notifState !==
                  'on' && (
                  <span className="dot" />
                )}
              </button>

              {bellOpen && (
                <div
                  className="bell-panel"
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >
                  <div className="bell-head">
                    🔔 Reminders
                  </div>

                  {upcomingForBell.length ? (
                    upcomingForBell.map(
                      (i) => {
                        const st =
                          statusOf(i);

                        return (
                          <div
                            className="bell-item"
                            key={i.id}
                          >
                            <b>
                              {i.title}
                            </b>

                            <br />

                            <span
                              style={{
                                color:
                                  st.color,
                              }}
                            >
                              {st.key}
                            </span>

                            {' · '}

                            {new Date(
                              i.deadline
                            ).toLocaleString(
                              'en-US',
                              {
                                month:
                                  'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute:
                                  '2-digit',
                              }
                            )}
                          </div>
                        );
                      }
                    )
                  ) : (
                    <div className="bell-item muted">
                      কোনো পেন্ডিং টাস্ক
                      নেই 🎉
                    </div>
                  )}
                </div>
              )}

              <button
                className={`avatar ${
                  myName &&
                  myName.length % 2
                    ? 'pink'
                    : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();

                  setNameInput(
                    myName
                  );

                  setNameModalOpen(
                    true
                  );
                }}
              >
                {myName
                  ? initialOf(
                      myName
                    )
                  : '?'}
              </button>
            </div>
          </div>

          {nav === 'settings' ? (
            <SettingsView
              myName={myName}
              onChangeName={() => {
                setNameInput(
                  myName
                );

                setNameModalOpen(
                  true
                );
              }}
              notifState={
                notifState
              }
              onEnableNotif={
                enableNotifications
              }
              darkMode={darkMode}
              onToggleDark={
                toggleDarkMode
              }
            />
          ) : nav === 'stats' ? (
            <StatsView
              rate={rate}
              counts={counts}
              byCat={byCat}
              maxCat={maxCat}
            />
          ) : nav === 'subjects' ? (
            <SubjectsView
              subjectMap={
                subjectMap
              }
            />
          ) : (
            <>
              <div className="stats-row">
                <StatCard
                  ic="📋"
                  num={
                    counts.total
                  }
                  lbl="Total Tasks"
                  color="var(--quiz)"
                  bg="var(--quiz-bg)"
                />

                <StatCard
                  ic="✅"
                  num={
                    counts.completed
                  }
                  lbl="Completed"
                  color="var(--assignment)"
                  bg="var(--assignment-bg)"
                />

                <StatCard
                  ic="⏰"
                  num={
                    counts.dueSoon
                  }
                  lbl="Due Soon"
                  color="var(--presentation)"
                  bg="var(--presentation-bg)"
                />

                <StatCard
                  ic="⚠️"
                  num={
                    counts.overdue
                  }
                  lbl="Overdue"
                  color="var(--overdue)"
                  bg="var(--overdue-bg)"
                />
              </div>

              <div className="content-grid">
                <div className="left-col">
                  <div className="filter-row">
                    <button
                      className={`tab ${
                        typeFilter ===
                        'all'
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setTypeFilter(
                          'all'
                        )
                      }
                    >
                      All
                    </button>

                    {TYPES.map(
                      (t) => (
                        <button
                          key={t.id}
                          className={`tab ${
                            typeFilter ===
                            t.id
                              ? 'active'
                              : ''
                          }`}
                          onClick={() =>
                            setTypeFilter(
                              t.id
                            )
                          }
                        >
                          {t.ic}{' '}
                          {t.label}
                        </button>
                      )
                    )}

                    <div className="search-wrap">
                      <span>
                        🔎
                      </span>

                      <input
                        placeholder="Search tasks..."
                        value={
                          searchQ
                        }
                        onChange={(e) =>
                          setSearchQ(
                            e.target
                              .value
                          )
                        }
                      />
                    </div>
                  </div>

                  {nav ===
                    'calendar' &&
                    selectedDay && (
                      <div className="daysel">
                        📅 দেখাচ্ছে:{' '}
                        <b>
                          {selectedDay.toLocaleDateString(
                            'en-US',
                            {
                              month:
                                'long',
                              day: 'numeric',
                            }
                          )}
                        </b>
                      </div>
                    )}

                  {loading ? (
                    <div className="empty">
                      লোড হচ্ছে...
                    </div>
                  ) : list.length ===
                    0 ? (
                    <div className="empty">
                      <div className="e-ic">
                        🗒️
                      </div>

                      <div className="e-title">
                        কোনো টাস্ক নেই
                      </div>

                      <div>
                        নতুন টাস্ক যোগ
                        করে শুরু করো
                      </div>
                    </div>
                  ) : (
                    list.map(TaskCard)
                  )}
                </div>

                <div className="right-col">
                  <div className="panel">
                    <div className="cal-head">
                      <button
                        onClick={() =>
                          setCalCursor(
                            new Date(
                              y,
                              m - 1,
                              1
                            )
                          )
                        }
                      >
                        ‹
                      </button>

                      <b>
                        {calCursor.toLocaleString(
                          'en-US',
                          {
                            month:
                              'long',
                          }
                        )}{' '}
                        {y}
                      </b>

                      <button
                        onClick={() =>
                          setCalCursor(
                            new Date(
                              y,
                              m + 1,
                              1
                            )
                          )
                        }
                      >
                        ›
                      </button>
                    </div>

                    <div className="cal-grid">
                      {[
                        'Su',
                        'Mo',
                        'Tu',
                        'We',
                        'Th',
                        'Fr',
                        'Sa',
                      ].map(
                        (d) => (
                          <div
                            className="dow"
                            key={d}
                          >
                            {d}
                          </div>
                        )
                      )}

                      {calCells.map(
                        (c, idx) => (
                          <div
                            key={idx}
                            className={`day ${
                              c.mute
                                ? 'mute'
                                : ''
                            } ${
                              c.isToday
                                ? 'today'
                                : ''
                            } ${
                              c.has
                                ? 'has'
                                : ''
                            } ${
                              c.isSel
                                ? 'sel'
                                : ''
                            }`}
                            onClick={() => {
                              if (
                                !c.mute
                              ) {
                                setSelectedDay(
                                  c.date
                                );

                                setNav(
                                  'calendar'
                                );
                              }
                            }}
                          >
                            {c.n}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="panel">
                    <b className="panel-title">
                      Quick Summary
                    </b>

                    <SummaryRow
                      color="var(--overdue)"
                      label="Overdue"
                      val={
                        counts.overdue
                      }
                    />

                    <SummaryRow
                      color="var(--soon)"
                      label="Due Soon"
                      val={
                        counts.dueSoon
                      }
                    />

                    <SummaryRow
                      color="var(--calm)"
                      label="Upcoming"
                      val={
                        counts.upcoming
                      }
                    />

                    <SummaryRow
                      color="var(--done)"
                      label="Completed"
                      val={
                        counts.completed
                      }
                    />

                    <div className="summary-row total">
                      <span>
                        Total Tasks
                      </span>

                      <b>
                        {counts.total}
                      </b>
                    </div>
                  </div>

                  <div className="tip-card">
                    <h4>
                      You've got this!
                      💪
                    </h4>

                    <p>
                      Small steps every
                      day lead to big
                      results.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {modalOpen && (
        <div
          className="overlay"
          onClick={(e) =>
            e.target.classList.contains(
              'overlay'
            ) &&
            setModalOpen(false)
          }
        >
          <div className="modal">
            <h3>
              {editing
                ? '✏️ Edit Task'
                : '➕ Add New Task'}
            </h3>

            <div className="field">
              <label>
                টাইটেল
              </label>

              <input
                type="text"
                placeholder="যেমন: AI Quiz 1"
                value={
                  form.title
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    title:
                      e.target
                        .value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>
                বিষয় (Subject)
              </label>

              <input
                type="text"
                placeholder="যেমন: Artificial Intelligence"
                value={
                  form.subject
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    subject:
                      e.target
                        .value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>
                ক্যাটাগরি
              </label>

              <div className="catrow">
                {TYPES.map(
                  (t) => (
                    <div
                      key={t.id}
                      className={`catchip ${
                        form.type ===
                        t.id
                          ? 'sel'
                          : ''
                      }`}
                      style={
                        form.type ===
                        t.id
                          ? {
                              background:
                                t.color,
                              borderColor:
                                t.color,
                              color:
                                '#fff',
                            }
                          : {}
                      }
                      onClick={() =>
                        setForm(
                          (f) => ({
                            ...f,
                            type: t.id,
                          })
                        )
                      }
                    >
                      {t.ic}{' '}
                      {t.label}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="field">
              <label>
                ডেডলাইন
              </label>

              <input
                type="datetime-local"
                value={
                  form.deadline
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deadline:
                      e.target
                        .value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>
                নোট / বিবরণ
              </label>

              <textarea
                placeholder="যেমন: Chapters 5-7"
                value={
                  form.description
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    description:
                      e.target
                        .value,
                  }))
                }
              />
            </div>

            <div className="field">
              <label>
                লিংক (Google Drive/Docs
                ইত্যাদি)
              </label>

              <input
                type="url"
                placeholder="https://..."
                value={
                  form.link
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    link:
                      e.target
                        .value,
                  }))
                }
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-ghost"
                onClick={() =>
                  setModalOpen(
                    false
                  )
                }
              >
                বাতিল
              </button>

              <button
                className="btn-solid"
                onClick={
                  handleSave
                }
              >
                {editing
                  ? 'আপডেট করো'
                  : 'যোগ করো'}
              </button>
            </div>
          </div>
        </div>
      )}

      {nameModalOpen && (
        <div className="overlay">
          <div className="modal name-modal">
            <h3>
              তুমি কে? 👋
            </h3>

            <p className="name-sub">
              "Done by" আর "✓" বাটনে
              কে চাপছে বোঝার জন্য
              শুধু একবার নামটা লাগবে —
              এই ডিভাইসে মনে থাকবে।
            </p>

            <div className="field">
              <input
                type="text"
                autoFocus
                placeholder="তোমার নাম লিখো (যেমন: Jannat)"
                value={
                  nameInput
                }
                onChange={(e) =>
                  setNameInput(
                    e.target
                      .value
                  )
                }
                onKeyDown={(e) =>
                  e.key ===
                    'Enter' &&
                  saveName(
                    nameInput
                  )
                }
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn-solid full"
                onClick={() =>
                  saveName(
                    nameInput
                  )
                }
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          ✅ {toast}
        </div>
      )}

      <GlobalStyle />
    </>
  );
}

function StatCard({
  ic,
  num,
  lbl,
  color,
  bg,
}) {
  return (
    <div className="stat-card">
      <div
        className="stat-ic"
        style={{
          background: bg,
          color,
        }}
      >
        {ic}
      </div>

      <div>
        <div className="num">
          {num}
        </div>

        <div className="lbl">
          {lbl}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  color,
  label,
  val,
}) {
  return (
    <div className="summary-row">
      <span className="l">
        <span
          className="sw"
          style={{
            background: color,
          }}
        />

        {label}
      </span>

      <b>{val}</b>
    </div>
  );
}

function StatsView({
  rate,
  counts,
  byCat,
  maxCat,
}) {
  return (
    <div className="settings-wrap">
      <div className="settings-block">
        <h3>
          📈 সার্বিক অগ্রগতি
        </h3>

        <div className="big-num">
          {rate}%
        </div>

        <div className="sub">
          টাস্ক সম্পন্নের হার (
          {counts.completed}/
          {counts.total})
        </div>

        <div className="bar">
          <div
            className="bar-fill"
            style={{
              width: `${rate}%`,
            }}
          />
        </div>
      </div>

      <div className="settings-block">
        <h3>
          📊 ক্যাটাগরি অনুযায়ী টাস্ক
        </h3>

        {TYPES.map((t) => (
          <div
            className="cat-row"
            key={t.id}
          >
            <div className="cat-row-top">
              <span>
                {t.ic} {t.label}
              </span>

              <b>
                {byCat[t.id] || 0}
              </b>
            </div>

            <div className="bar">
              <div
                className="bar-fill"
                style={{
                  width: `${
                    ((byCat[t.id] ||
                      0) /
                      maxCat) *
                    100
                  }%`,
                  background:
                    t.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectsView({
  subjectMap,
}) {
  const entries =
    Object.entries(
      subjectMap
    );

  return (
    <div className="content-grid single">
      {entries.length ? (
        entries.map(
          ([name, v]) => (
            <div
              className="task-card"
              style={{
                borderLeftColor:
                  'var(--purple)',
              }}
              key={name}
            >
              <div
                className="t-ic"
                style={{
                  background:
                    'var(--quiz-bg)',
                  color:
                    'var(--purple)',
                }}
              >
                📚
              </div>

              <div className="t-body">
                <div className="t-title">
                  {name}
                </div>

                <div className="t-meta">
                  {v.done}/
                  {v.total}{' '}
                  completed
                </div>
              </div>
            </div>
          )
        )
      ) : (
        <div className="empty">
          <div className="e-ic">
            📚
          </div>

          <div className="e-title">
            কোনো বিষয় নেই
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsView({
  myName,
  onChangeName,
  notifState,
  onEnableNotif,
  darkMode,
  onToggleDark,
}) {
  return (
    <div className="settings-wrap">
      <div className="settings-block">
        <h3>
          👤 বর্তমান ব্যবহারকারী
        </h3>

        <div className="srow">
          <div>
            <div className="st">
              তুমি এখন
            </div>

            <div className="sd">
              এই নামেই "Done by" আর
              অ্যাক্টিভিটি ট্র্যাক হয়
            </div>
          </div>

          <b>
            {myName || 'নাম নেই'}
          </b>
        </div>

        <button
          className="btn-ghost"
          onClick={
            onChangeName
          }
        >
          নাম বদলাও
        </button>
      </div>

      <div className="settings-block reminder-settings-block">
        <h3>
          🔔 Reminder Notifications
        </h3>

        <div className="reminder-row">
          <div>
            <div className="st">
              Push Reminders
            </div>

            <div className="sd">
              ডেডলাইনের সময় হলে ব্রাউজার নোটিফিকেশন পাবে
            </div>
          </div>

          <button
            type="button"
            className={`reminder-switch ${
              notifState === 'on' ? 'on' : ''
            }`}
            aria-label="Toggle Push Reminders"
            onClick={onEnableNotif}
          />
        </div>

        <div className="reminder-divider" />

        <div className="reminder-row">
          <div>
            <div className="st">
              Reminder Lead Time
            </div>

            <div className="sd">
              ডেডলাইনের কতক্ষণ আগে জানাবে
            </div>
          </div>

          <select className="reminder-select" defaultValue="24">
            <option value="1">1 ঘণ্টা আগে</option>
            <option value="6">6 ঘণ্টা আগে</option>
            <option value="24">24 ঘণ্টা আগে</option>
            <option value="48">48 ঘণ্টা আগে</option>
          </select>
        </div>

        <div className="reminder-divider" />

        <div className="reminder-row">
          <div>
            <div className="st">
              Browser Permission
            </div>

            <div className="sd">
              অনুমতি প্রয়োজন
            </div>
          </div>

          <button
            type="button"
            className="reminder-enable"
            onClick={onEnableNotif}
          >
            Enable
          </button>
        </div>
      </div>

      <div className="settings-block">
        <h3>
          🌙 Appearance
        </h3>

        <div className="srow">
          <div>
            <div className="st">
              Dark Mode
            </div>

            <div className="sd">
              এই ডিভাইসে মনে থাকবে
            </div>
          </div>

          <button
            className={`switch ${
              darkMode
                ? 'on'
                : ''
            }`}
            onClick={
              onToggleDark
            }
          />
        </div>
      </div>

      <div className="settings-block">
        <h3>
          👥 কীভাবে দুজনে ব্যবহার করবে
        </h3>

        <div className="note">
          লিংকটা তোমার বন্ধুকে পাঠাও —
          সে ওপেন করলে তার নাম জিজ্ঞেস
          করবে, তারপর দুজনেই একই টাস্ক
          লিস্ট দেখবে ও এডিট করতে পারবে।
          একটা টাস্ক তখনই "সম্পন্ন"
          দেখাবে, যখন দুজনেই নিজের ✓
          চাপবে।
        </div>
      </div>
    </div>
  );
}

function GlobalStyle() {
  return (
    <style jsx global>{`
      .app {
        display: flex;
        min-height: 100vh;
      }

      .sidebar {
        width: 240px;
        min-width: 240px;
        background: var(--panel);
        border-right: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        padding: 24px 18px;
        position: sticky;
        top: 0;
        height: 100vh;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 800;
        font-size: 20px;
        font-family: 'Poppins', sans-serif;
      }

      .logo .plan {
        color: var(--text);
      }

      .logo .buddy {
        background: var(--grad);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .tagline {
        font-size: 12px;
        color: var(--sub);
        margin: 2px 0 26px 2px;
      }

      .sidebar nav {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .navitem {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        color: var(--sub);
        font-size: 14.5px;
        font-weight: 600;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
      }

      .navitem .ic {
        font-size: 16px;
        width: 18px;
        text-align: center;
      }

      .navitem:hover {
        background: var(--panel-2);
        color: var(--text);
      }

      .navitem.active {
        background: var(--grad);
        color: #fff;
        box-shadow: var(--shadow);
      }

      .side-spacer {
        flex: 1;
      }

      .friend-card {
        background: linear-gradient(
          160deg,
          var(--quiz-bg),
          var(--task-bg)
        );
        border-radius: 16px;
        padding: 16px;
        text-align: center;
        margin-top: 18px;
      }

      .friend-card .emo {
        font-size: 28px;
      }

      .friend-card h4 {
        font-size: 14.5px;
        margin: 6px 0 2px;
      }

      .friend-card p {
        font-size: 12px;
        color: var(--sub);
        line-height: 1.4;
        margin: 0 0 8px;
      }

      .change-name {
        border: none;
        background: none;
        font-size: 11.5px;
        color: var(--purple);
        font-weight: 700;
        text-decoration: underline;
      }

      .darkrow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 16px;
        padding: 8px 4px;
      }

      .darkrow span {
        font-size: 13.5px;
        font-weight: 600;
      }

      .switch {
        width: 40px;
        height: 22px;
        background: var(--line);
        border-radius: 99px;
        position: relative;
        border: none;
        transition: 0.2s;
        flex-shrink: 0;
      }

      .switch.on {
        background: var(--grad);
      }

      .switch::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: #fff;
        border-radius: 50%;
        transition: 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }

      .switch.on::after {
        left: 20px;
      }

      .main {
        flex: 1;
        padding: 26px 30px 60px;
        max-width: 100%;
        overflow-x: hidden;
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 14px;
        margin-bottom: 22px;
        position: relative;
      }

      .topbar h1 {
        font-size: 24px;
        font-weight: 800;
        font-family: 'Poppins', sans-serif;
        margin: 0;
      }

      .topbar p {
        color: var(--sub);
        font-size: 13.5px;
        margin: 2px 0 0;
      }

      .top-actions {
        display: flex;
        align-items: center;
        gap: 14px;
        position: relative;
      }

      .btn-primary {
        background: var(--grad);
        color: #fff;
        border: none;
        padding: 12px 20px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: var(--shadow);
      }

      .btn-primary:hover {
        filter: brightness(1.06);
      }

      .iconbtn {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: var(--panel);
        border: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        position: relative;
      }

      .dot {
        position: absolute;
        top: 6px;
        right: 6px;
        width: 8px;
        height: 8px;
        background: var(--overdue);
        border-radius: 50%;
        border: 2px solid var(--panel);
      }

      .avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: var(--grad);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 15px;
        border: none;
      }

      .avatar.pink {
        background: linear-gradient(
          135deg,
          #ec4899,
          #f97316
        );
      }

      .avatar.sm {
        width: 26px;
        height: 26px;
        font-size: 11px;
        border: 2px solid var(--panel);
      }

      .avatar.sm.outline {
        background: var(--panel-2);
        color: var(--sub);
      }

      .avatar.sm.filled {
        background: var(--done);
        color: #fff;
      }

      .avatar.sm.filled.pink {
        background: var(--done);
      }

      .bell-panel {
        position: absolute;
        top: 52px;
        right: 60px;
        width: 270px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: var(--shadow);
        z-index: 150;
        overflow: hidden;
      }

      .bell-head {
        padding: 12px;
        font-weight: 700;
        font-size: 13.5px;
        border-bottom: 1px solid var(--line);
      }

      .bell-item {
        padding: 9px 12px;
        border-bottom: 1px solid var(--line);
        font-size: 12.5px;
      }

      .bell-item.muted {
        color: var(--sub);
      }

      .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 20px;
      }

      .stat-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: var(--shadow);
      }

      .stat-ic {
        width: 46px;
        height: 46px;
        border-radius: 13px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
      }

      .stat-card .num {
        font-size: 22px;
        font-weight: 800;
        line-height: 1;
      }

      .stat-card .lbl {
        font-size: 12.5px;
        color: var(--sub);
        margin-top: 3px;
      }

      .content-grid {
        display: grid;
        grid-template-columns: 1fr 300px;
        gap: 20px;
        align-items: start;
      }

      .content-grid.single {
        grid-template-columns: 1fr;
      }

      .left-col {
        min-width: 0;
      }

      .filter-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .tab {
        padding: 9px 16px;
        border-radius: 11px;
        font-size: 13.5px;
        font-weight: 700;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--sub);
      }

      .tab.active {
        background: var(--grad);
        color: #fff;
        border-color: transparent;
      }

      .search-wrap {
        margin-left: auto;
        position: relative;
        min-width: 220px;
      }

      .search-wrap input {
        width: 100%;
        padding: 10px 14px 10px 36px;
        border-radius: 11px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--text);
        font-size: 13.5px;
      }

      .search-wrap span {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--sub);
      }

      .daysel {
        margin-bottom: 12px;
        font-size: 13px;
        color: var(--sub);
      }

      .daysel b {
        color: var(--text);
      }

      .daysel a {
        color: var(--purple);
        font-weight: 700;
        text-decoration: none;
      }

      .task-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 16px 18px;
        margin-bottom: 14px;
        box-shadow: var(--shadow);
        display: flex;
        align-items: center;
        gap: 14px;
        border-left: 5px solid var(--purple);
        position: relative;
      }

      .task-card.done {
        opacity: 0.62;
      }

      .t-ic {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 19px;
        flex-shrink: 0;
      }

      .t-body {
        flex: 1;
        min-width: 0;
      }

      .t-title {
        font-size: 15px;
        font-weight: 700;
      }

      .task-card.done .t-title {
        text-decoration: line-through;
      }

      .t-subject {
        font-size: 12.5px;
        font-weight: 600;
        margin: 2px 0 4px;
      }

      .t-meta {
        font-size: 12px;
        color: var(--sub);
      }

      .t-link {
        display: inline-block;
        font-size: 12px;
        color: var(--task);
        margin-top: 4px;
      }

      .t-when {
        min-width: 150px;
        font-size: 12.5px;
      }

      .t-when .l1 {
        font-weight: 700;
      }

      .t-when .l2 {
        color: var(--sub);
        font-size: 11.5px;
        margin-top: 2px;
      }

      .badge {
        display: inline-block;
        margin-top: 6px;
        padding: 3px 10px;
        border-radius: 99px;
        font-size: 11px;
        font-weight: 800;
      }

      .doneby {
        text-align: center;
        font-size: 11px;
        color: var(--sub);
        font-weight: 600;
      }

      .doneby .avs {
        display: flex;
        gap: 4px;
        margin-top: 4px;
        justify-content: center;
      }

      .check {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        border: 2px solid var(--line);
        background: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        flex-shrink: 0;
        font-weight: 800;
      }

      .check.on {
        background: var(--done);
        border-color: var(--done);
      }

      .more {
        background: none;
        border: none;
        color: var(--sub);
        font-size: 18px;
        padding: 4px 8px;
        border-radius: 8px;
      }

      .more:hover {
        background: var(--panel-2);
      }

      .menu {
        position: absolute;
        right: 16px;
        top: 52px;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 12px;
        box-shadow: var(--shadow);
        z-index: 20;
        overflow: hidden;
        min-width: 120px;
      }

      .menu button {
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px 14px;
        background: none;
        border: none;
        font-size: 13px;
        color: var(--text);
      }

      .menu button:hover {
        background: var(--panel-2);
      }

      .menu button.danger {
        color: var(--overdue);
      }

      .empty {
        text-align: center;
        padding: 50px 20px;
        color: var(--sub);
        grid-column: 1 / -1;
      }

      .empty .e-ic {
        font-size: 38px;
        margin-bottom: 10px;
      }

      .empty .e-title {
        font-weight: 700;
        color: var(--text);
        margin-bottom: 4px;
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 18px;
        margin-bottom: 16px;
        box-shadow: var(--shadow);
      }

      .panel-title {
        font-size: 14.5px;
      }

      .cal-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .cal-head b {
        font-size: 14.5px;
      }

      .cal-head button {
        background: var(--panel-2);
        border: none;
        width: 26px;
        height: 26px;
        border-radius: 8px;
        color: var(--text);
        font-size: 14px;
      }

      .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
        font-size: 11.5px;
        text-align: center;
      }

      .cal-grid .dow {
        color: var(--sub);
        font-weight: 700;
        padding-bottom: 4px;
      }

      .cal-grid .day {
        padding: 6px 0;
        border-radius: 8px;
        cursor: pointer;
        position: relative;
        color: var(--text);
      }

      .cal-grid .day.mute {
        color: var(--sub);
        opacity: 0.35;
        cursor: default;
      }

      .cal-grid .day.today {
        background: var(--grad);
        color: #fff;
        font-weight: 800;
      }

      .cal-grid .day.has::after {
        content: '';
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: var(--overdue);
      }

      .cal-grid .day.today.has::after {
        background: #fff;
      }

      .cal-grid .day.sel {
        outline: 2px solid var(--purple);
      }

      .summary-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 7px 0;
        font-size: 13px;
      }

      .summary-row .l {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--sub);
      }

      .summary-row.total {
        border-top: 1px solid var(--line);
        margin-top: 6px;
        padding-top: 10px;
        font-weight: 700;
      }

      .sw {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .tip-card {
        background: var(--grad);
        border-radius: 16px;
        padding: 18px;
        color: #fff;
      }

      .tip-card h4 {
        font-size: 14.5px;
        margin: 0 0 4px;
      }

      .tip-card p {
        font-size: 12.5px;
        opacity: 0.9;
        line-height: 1.4;
        margin: 0;
      }

      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(10, 8, 20, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 16px;
      }

      .modal {
        background: var(--panel);
        border-radius: 18px;
        padding: 26px;
        width: 440px;
        max-width: 100%;
        max-height: 90vh;
        overflow: auto;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
      }

      .modal h3 {
        font-size: 18px;
        margin: 0 0 16px;
        font-family: 'Poppins', sans-serif;
      }

      .field {
        margin-bottom: 14px;
      }

      .field label {
        font-size: 12.5px;
        font-weight: 700;
        color: var(--sub);
        display: block;
        margin-bottom: 6px;
      }

      .field input,
      .field textarea {
        width: 100%;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--panel-2);
        color: var(--text);
        font-size: 13.5px;
        font-family: inherit;
      }

      .field textarea {
        resize: vertical;
        min-height: 60px;
      }

      .catrow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  width: 100%;
}

.catchip {
  min-width: 0;
  padding: 10px 6px;
  border-radius: 10px;
  border: 1px solid var(--line);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  background: var(--panel-2);
  color: var(--sub);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

      .modal-actions {
        display: flex;
        gap: 10px;
        margin-top: 18px;
      }

      .btn-ghost {
        flex: 1;
        padding: 11px;
        border-radius: 11px;
        border: 1px solid var(--line);
        background: none;
        color: var(--text);
        font-weight: 700;
        font-size: 13.5px;
      }

      .btn-solid {
        flex: 1;
        padding: 11px;
        border-radius: 11px;
        border: none;
        background: var(--grad);
        color: #fff;
        font-weight: 700;
        font-size: 13.5px;
      }

      .btn-solid.full {
        width: 100%;
      }

      .name-modal {
        text-align: center;
      }

      .name-sub {
        font-size: 13px;
        color: var(--sub);
        line-height: 1.5;
        margin: 0 0 16px;
      }

      .toast {
        position: fixed;
        bottom: 26px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 13px 20px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
        z-index: 200;
        font-size: 13.5px;
        font-weight: 600;
      }

      .settings-wrap {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 560px;
      }

      .settings-block {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 22px;
        box-shadow: var(--shadow);
      }

      .settings-block h3 {
        font-size: 15px;
        margin: 0 0 14px;
        font-family: 'Poppins', sans-serif;
      }

      .srow {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 0;
        gap: 12px;
      }

      .srow .st {
        font-size: 13.5px;
        font-weight: 600;
      }

      .srow .sd {
        font-size: 12px;
        color: var(--sub);
        margin-top: 2px;
      }

      /* Reminder Notifications — visual layout only */
      .reminder-settings-block {
        width: min(calc(100vw - 90px), 1120px);
        box-sizing: border-box;
        padding: 40px 44px 42px;
      }

      .reminder-settings-block h3 {
        font-size: 29px;
        line-height: 1.2;
        margin: 0 0 38px;
      }

      .reminder-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 28px;
        min-height: 64px;
      }

      .reminder-row .st {
        font-size: 25px;
        line-height: 1.2;
        font-weight: 700;
      }

      .reminder-row .sd {
        font-size: 21px;
        line-height: 1.35;
        color: var(--sub);
        margin-top: 4px;
      }

      .reminder-divider {
        height: 1px;
        background: var(--line);
        margin: 24px 0;
      }

      .reminder-switch {
        width: 80px;
        min-width: 80px;
        height: 44px;
        border: none;
        border-radius: 999px;
        background: var(--line);
        position: relative;
        flex-shrink: 0;
        cursor: pointer;
        transition: 0.2s ease;
      }

      .reminder-switch.on {
        background: var(--grad);
      }

      .reminder-switch::after {
        content: '';
        position: absolute;
        width: 36px;
        height: 36px;
        top: 4px;
        left: 4px;
        background: #fff;
        border-radius: 50%;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
        transition: 0.2s ease;
      }

      .reminder-switch.on::after {
        left: 40px;
      }

      .reminder-select {
        width: 238px;
        min-width: 238px;
        height: 70px;
        padding: 0 28px;
        border: 2px solid var(--line);
        border-radius: 16px;
        background: var(--panel-2);
        color: var(--text);
        font-size: 23px;
        outline: none;
      }

      .reminder-enable {
        width: 158px;
        min-width: 158px;
        height: 72px;
        border: 2px solid var(--line);
        border-radius: 20px;
        background: transparent;
        color: var(--text);
        font-size: 25px;
        font-weight: 700;
        cursor: pointer;
      }

      .note {
        font-size: 12px;
        color: var(--sub);
        line-height: 1.5;
        margin-top: 6px;
      }

      .big-num {
        font-size: 34px;
        font-weight: 800;
        color: var(--purple);
        font-family: 'Poppins', sans-serif;
      }

      .sub {
        color: var(--sub);
        font-size: 13px;
        margin-bottom: 14px;
      }

      .bar {
        height: 10px;
        background: var(--panel-2);
        border-radius: 99px;
        overflow: hidden;
      }

      .bar-fill {
        height: 100%;
        background: var(--grad);
        border-radius: 99px;
        transition: width 0.4s ease;
      }

      .cat-row {
        margin-bottom: 12px;
      }

      .cat-row-top {
        display: flex;
        justify-content: space-between;
        font-size: 13px;
        margin-bottom: 5px;
      }

      @media (max-width: 980px) {
        .content-grid {
          grid-template-columns: 1fr;
        }

        .stats-row {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (max-width: 720px) {
        .sidebar {
          display: none;
        }

        .main {
          padding: 18px;
        }
      }
    `}</style>
  );
}
