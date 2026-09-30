"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Category = {
  id: string;
  name: string;
  sort_order: number;
};

type LedgerItem = {
  id: string;
  category_id: string;
  title: string;
  due_date: string;
  due_time: string | null;
  completed: boolean;
  notes: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const formatTime = (time: string | null) => {
  if (!time) return "No time";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const itemTimestamp = (item: LedgerItem) => {
  const time = item.due_time || "23:59";
  return new Date(`${item.due_date}T${time}:00`).getTime();
};

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categoryName, setCategoryName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDate, setItemDate] = useState(todayISO());
  const [itemTime, setItemTime] = useState("09:00");
  const [itemNotes, setItemNotes] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(new Date());
  const [notificationState, setNotificationState] = useState<"unsupported" | "default" | "granted" | "denied">("default");
  const [toast, setToast] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    setNotificationState(Notification.permission);
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!session || !items.length) return;

    const checkDueItems = () => {
      const current = Date.now();
      const storageKey = `daily-ledger-notified:${session.user.id}`;
      const sent = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, number>;
      let changed = false;

      items.forEach((item) => {
        if (item.completed || !item.due_time) return;
        const due = itemTimestamp(item);
        if (due <= current && due > current - 70_000 && !sent[item.id]) {
          sent[item.id] = due;
          changed = true;
          const category = categories.find((c) => c.id === item.category_id)?.name || "Ledger";
          setToast(`${item.title} is due now`);
          window.setTimeout(() => setToast(""), 5000);

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Daily Ledger", {
              body: `${item.title} · ${category}`,
              icon: "/icon-192.png",
              tag: `daily-ledger-${item.id}`,
            });
          }
        }
      });

      if (changed) localStorage.setItem(storageKey, JSON.stringify(sent));
    };

    checkDueItems();
    const timer = window.setInterval(checkDueItems, 15_000);
    return () => window.clearInterval(timer);
  }, [session, items, categories]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setToast("This browser does not support notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    setToast(permission === "granted" ? "Notifications are enabled." : "Notifications were not enabled.");
    window.setTimeout(() => setToast(""), 3500);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from("categories").select("id,name,sort_order").order("sort_order"),
      supabase.from("items").select("id,category_id,title,due_date,due_time,completed,notes").order("due_date").order("due_time"),
    ]);
    setCategories(cats || []);
    setItems(its || []);
    if (!itemCategory && cats?.[0]) setItemCategory(cats[0].id);
    setLoading(false);
  }

  async function authenticate(e: FormEvent) {
    e.preventDefault();
    setAuthMessage("");
    const result = authMode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (result.error) setAuthMessage(result.error.message);
    else setAuthMessage(authMode === "signup"
      ? "Account created. Check your email if confirmation is enabled."
      : "");
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!categoryName.trim()) return;
    const { data } = await supabase.from("categories").insert({
      name: categoryName.trim(),
      sort_order: categories.length,
    }).select("id,name,sort_order").single();
    if (data) {
      setCategories([...categories, data]);
      setCategoryName("");
      setShowCategoryForm(false);
      setItemCategory(data.id);
    }
  }

  async function addItem(e: FormEvent) {
    e.preventDefault();
    if (!itemTitle.trim() || !itemCategory || !itemDate || !itemTime) return;
    const { data } = await supabase.from("items").insert({
      category_id: itemCategory,
      title: itemTitle.trim(),
      due_date: itemDate,
      due_time: itemTime,
      notes: itemNotes.trim() || null,
    }).select("id,category_id,title,due_date,due_time,completed,notes").single();

    if (data) {
      setItems([...items, data].sort((a, b) => itemTimestamp(a) - itemTimestamp(b)));
      setItemTitle("");
      setItemNotes("");
      setItemDate(selectedDate);
      setItemTime("09:00");
      setShowItemForm(false);
    }
  }

  async function toggleItem(item: LedgerItem) {
    await supabase.from("items").update({ completed: !item.completed }).eq("id", item.id);
    setItems(items.map(x => x.id === item.id ? { ...x, completed: !x.completed } : x));
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from("items").delete().eq("id", id);
    setItems(items.filter(x => x.id !== id));
  }

  const visibleItems = useMemo(() => items
    .filter(item =>
      item.due_date === selectedDate &&
      (selectedCategory === "all" || item.category_id === selectedCategory)
    )
    .sort((a, b) => itemTimestamp(a) - itemTimestamp(b)), [items, selectedDate, selectedCategory]);

  const todayItems = useMemo(() => items.filter(item => item.due_date === todayISO()), [items]);
  const completedToday = todayItems.filter(item => item.completed).length;
  const overdueToday = todayItems.filter(item => !item.completed && item.due_time && itemTimestamp(item) < now.getTime()).length;
  const upcomingItems = useMemo(() => items
    .filter(item => !item.completed && itemTimestamp(item) > now.getTime())
    .sort((a, b) => itemTimestamp(a) - itemTimestamp(b))
    .slice(0, 8), [items, now]);

  const currentClock = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const currentDate = prettyDate(selectedDate);

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="auth-logo"><span>DL</span></div>
          <p className="eyebrow">YOUR PRIVATE WORKSPACE</p>
          <h1>Daily Ledger</h1>
          <p className="muted">A calm, beautiful place to keep track of what matters today.</p>
          <form onSubmit={authenticate} className="stack">
            <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" minLength={6} required /></label>
            <button className="primary full" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <span>→</span></button>
          </form>
          {authMessage && <p className="notice">{authMessage}</p>}
          <button className="link-button" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "Create a new account" : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand"><span className="brand-mark small">DL</span><span>Daily Ledger</span></div>
          <p className="sidebar-label">WORKSPACE</p>
          <button className={`nav-item ${selectedCategory === "all" ? "active" : ""}`} onClick={() => setSelectedCategory("all")}>
            <span className="nav-icon">⌂</span> All items <span className="nav-count">{items.length}</span>
          </button>
          {categories.map(c =>
            <button key={c.id} className={`nav-item ${selectedCategory === c.id ? "active" : ""}`} onClick={() => setSelectedCategory(c.id)}>
              <span className="dot"></span>{c.name}
              <span className="nav-count">{items.filter(i => i.category_id === c.id && !i.completed).length}</span>
            </button>
          )}
          <button className="nav-item add" onClick={() => setShowCategoryForm(true)}><span className="nav-icon">＋</span> New category</button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">{(session.user.email || "U").slice(0, 1).toUpperCase()}</div>
            <div><strong>{session.user.email?.split("@")[0]}</strong><small>Personal workspace</small></div>
          </div>
          <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div className="heading-block">
            <p className="eyebrow">DAILY LEDGER <span className="live-dot"></span> LIVE</p>
            <div className="date-clock">
              <div>
                <h1>{currentDate}</h1>
                <p className="date-subtitle">{selectedDate === todayISO() ? "Your day at a glance" : "Viewing a saved ledger date"}</p>
              </div>
              <div className="clock-card" aria-label={`Current time ${currentClock}`}>
                <span className="clock-label">LOCAL TIME</span>
                <strong>{currentClock}</strong>
              </div>
            </div>
          </div>

          <div className="top-actions">
            {notificationState !== "granted" && notificationState !== "unsupported" && (
              <button className="notification-button" onClick={enableNotifications}>◔ Enable alerts</button>
            )}
            {notificationState === "granted" && <span className="notification-on">● Alerts on</span>}
            <button className="secondary" onClick={() => { setSelectedDate(todayISO()); setSelectedCategory("all"); }}>Today</button>
            <button className="primary add-button" onClick={() => { setItemDate(selectedDate); setShowItemForm(true); }}>＋ Add item</button>
          </div>
        </header>

        <section className="stats">
          <div className="stat-card"><span className="stat-icon">☰</span><div><small>Today</small><strong>{todayItems.length}</strong><span>items</span></div></div>
          <div className="stat-card"><span className="stat-icon done">✓</span><div><small>Completed</small><strong>{completedToday}</strong><span>of {todayItems.length}</span></div></div>
          <div className={`stat-card ${overdueToday ? "alert" : ""}`}><span className="stat-icon">!</span><div><small>Due now</small><strong>{overdueToday}</strong><span>{overdueToday === 1 ? "item needs attention" : "items need attention"}</span></div></div>
        </section>

        <div className="date-strip">
          <label><span>VIEW DATE</span><input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} /></label>
          <span className="item-count">{visibleItems.length} {visibleItems.length === 1 ? "entry" : "entries"} · {loading ? "Syncing…" : "Synced"}</span>
        </div>

        <div className="grid">
          <section className="panel ledger-panel">
            <div className="panel-head">
              <div><p className="eyebrow">ENTRIES</p><h2>{selectedDate === todayISO() ? "Today" : prettyDate(selectedDate)}</h2></div>
              <span className="panel-date">{selectedDate}</span>
            </div>

            {visibleItems.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">✦</div>
                <h3>A clean slate</h3>
                <p>No entries are scheduled for this date.</p>
                <button className="primary" onClick={() => { setItemDate(selectedDate); setShowItemForm(true); }}>Add first item <span>→</span></button>
              </div>
            ) : (
              <div className="items">
                {visibleItems.map(item => {
                  const category = categories.find(c => c.id === item.category_id)?.name || "Uncategorized";
                  const isOverdue = !item.completed && !!item.due_time && itemTimestamp(item) < now.getTime();
                  const isDueSoon = !item.completed && !!item.due_time && itemTimestamp(item) >= now.getTime() && itemTimestamp(item) < now.getTime() + 60 * 60 * 1000;
                  return (
                    <article className={`item-card ${isOverdue ? "overdue" : ""} ${isDueSoon ? "due-soon" : ""} ${item.completed ? "completed" : ""}`} key={item.id}>
                      <button className="check" onClick={() => toggleItem(item)} aria-label={item.completed ? "Mark incomplete" : "Mark complete"}>{item.completed ? "✓" : ""}</button>
                      <div className="item-main">
                        <div className="item-title-row">
                          <h3>{item.title}</h3>
                          {item.completed ? <span className="status-badge complete-badge">DONE</span> :
                           isOverdue ? <span className="status-badge overdue-badge">OVERDUE</span> :
                           isDueSoon ? <span className="status-badge soon-badge">DUE SOON</span> :
                           <span className="status-badge upcoming-badge">UPCOMING</span>}
                        </div>
                        <div className="item-meta">
                          <span className="category-pill"><span className="dot"></span>{category}</span>
                          <span>•</span><span>{item.due_date}</span>
                          {item.due_time && <><span>•</span><strong className="due-time">◷ {formatTime(item.due_time)}</strong></>}
                        </div>
                        {item.notes && <p className="item-notes">{item.notes}</p>}
                      </div>
                      <button className="delete" onClick={() => deleteItem(item.id)} aria-label="Delete item">×</button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="right-column">
            <section className="panel upcoming-panel">
              <div className="panel-head"><div><p className="eyebrow">NEXT UP</p><h2>Upcoming</h2></div><span className="spark">✦</span></div>
              {upcomingItems.length === 0 ? <p className="muted">Nothing waiting in the queue.</p> : upcomingItems.map(item =>
                <button className="upcoming-row" key={item.id} onClick={() => { setSelectedDate(item.due_date); setSelectedCategory("all"); }}>
                  <span className="upcoming-time">{formatTime(item.due_time)}</span>
                  <span className="upcoming-copy"><strong>{item.title}</strong><small>{prettyDate(item.due_date)}</small></span>
                  <span className="upcoming-arrow">›</span>
                </button>
              )}
            </section>

            <section className="panel focus-panel">
              <div className="focus-icon">◷</div>
              <div>
                <p className="eyebrow">STAY ON TRACK</p>
                <h3>Alerts at due time</h3>
                <p>Keep Daily Ledger open and browser alerts enabled to receive a notification when an item reaches its due time.</p>
                {notificationState !== "granted" && notificationState !== "unsupported" && <button className="text-action" onClick={enableNotifications}>Enable browser alerts →</button>}
              </div>
            </section>
          </aside>
        </div>

        {toast && <div className="toast" role="status"><span>🔔</span>{toast}</div>}

        {showCategoryForm && <div className="modal-backdrop"><form className="modal" onSubmit={addCategory}>
          <div className="modal-head"><div><p className="eyebrow">NEW CATEGORY</p><h2>Create category</h2></div><button type="button" className="close" onClick={() => setShowCategoryForm(false)}>×</button></div>
          <label>Category name<input autoFocus value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="e.g. Finance" /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowCategoryForm(false)}>Cancel</button><button className="primary">Create category</button></div>
        </form></div>}

        {showItemForm && <div className="modal-backdrop"><form className="modal" onSubmit={addItem}>
          <div className="modal-head"><div><p className="eyebrow">NEW ENTRY</p><h2>Schedule an item</h2><p className="modal-subtitle">Choose when you want to be reminded.</p></div><button type="button" className="close" onClick={() => setShowItemForm(false)}>×</button></div>
          <label>Item<input autoFocus value={itemTitle} onChange={e => setItemTitle(e.target.value)} placeholder="What needs to be done?" required /></label>
          <div className="two-col">
            <label>Category<select value={itemCategory} onChange={e => setItemCategory(e.target.value)} required>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Date<input type="date" value={itemDate} onChange={e => setItemDate(e.target.value)} required /></label>
          </div>
          <div className="time-field">
            <label>Due time<input type="time" value={itemTime} onChange={e => setItemTime(e.target.value)} required /></label>
            <span className="time-hint">You’ll get an alert at this time when alerts are enabled.</span>
          </div>
          <label>Notes <span className="optional">optional</span><textarea rows={3} value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="Additional context…" /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowItemForm(false)}>Cancel</button><button className="primary">Schedule item</button></div>
        </form></div>}
      </section>
    </main>
  );
}
