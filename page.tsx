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
  completed: boolean;
  notes: string | null;
};

const todayISO = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authMessage, setAuthMessage] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categoryName, setCategoryName] = useState("");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDate, setItemDate] = useState(todayISO());
  const [itemNotes, setItemNotes] = useState("");
  const [itemCategory, setItemCategory] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadData();
  }, [session]);

  async function loadData() {
    setLoading(true);
    const [{ data: cats }, { data: its }] = await Promise.all([
      supabase.from("categories").select("id,name,sort_order").order("sort_order"),
      supabase.from("items").select("id,category_id,title,due_date,completed,notes").order("due_date"),
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
    if (!itemTitle.trim() || !itemCategory) return;
    const { data } = await supabase.from("items").insert({
      category_id: itemCategory,
      title: itemTitle.trim(),
      due_date: itemDate,
      notes: itemNotes.trim() || null,
    }).select("id,category_id,title,due_date,completed,notes").single();
    if (data) {
      setItems([...items, data].sort((a,b) => a.due_date.localeCompare(b.due_date)));
      setItemTitle("");
      setItemNotes("");
      setItemDate(todayISO());
      setShowItemForm(false);
    }
  }

  async function toggleItem(item: LedgerItem) {
    await supabase.from("items").update({ completed: !item.completed }).eq("id", item.id);
    setItems(items.map(x => x.id === item.id ? {...x, completed: !x.completed} : x));
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    await supabase.from("items").delete().eq("id", id);
    setItems(items.filter(x => x.id !== id));
  }

  const visibleItems = useMemo(() => {
    return items.filter(item =>
      item.due_date === selectedDate &&
      (selectedCategory === "all" || item.category_id === selectedCategory)
    );
  }, [items, selectedDate, selectedCategory]);

  const futureItems = useMemo(() =>
    items.filter(item => item.due_date > todayISO() && !item.completed).slice(0, 8),
  [items]);

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">DL</div>
          <p className="eyebrow">PERSONAL WORKSPACE</p>
          <h1>Daily Ledger</h1>
          <p className="muted">Your organized daily record, available from any browser.</p>
          <form onSubmit={authenticate} className="stack">
            <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={6} required /></label>
            <button className="primary" type="submit">{authMode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          {authMessage && <p className="notice">{authMessage}</p>}
          <button className="link-button" onClick={()=>setAuthMode(authMode === "login" ? "signup" : "login")}>
            {authMode === "login" ? "Create a new account" : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand"><span className="brand-mark small">DL</span><span>Daily Ledger</span></div>
          <p className="sidebar-label">WORKSPACES</p>
          <button className={selectedCategory === "all" ? "nav-item active" : "nav-item"} onClick={()=>setSelectedCategory("all")}>All items</button>
          {categories.map(c =>
            <button key={c.id} className={selectedCategory === c.id ? "nav-item active" : "nav-item"} onClick={()=>setSelectedCategory(c.id)}>
              <span className="dot"></span>{c.name}
            </button>
          )}
          <button className="nav-item add" onClick={()=>setShowCategoryForm(true)}>＋ New category</button>
        </div>
        <div className="sidebar-bottom">
          <span className="user-email">{session.user.email}</span>
          <button className="nav-item" onClick={()=>supabase.auth.signOut()}>Sign out</button>
        </div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">DAILY LEDGER</p>
            <h1>{prettyDate(selectedDate)}</h1>
          </div>
          <div className="top-actions">
            <button className="secondary" onClick={()=>{setSelectedDate(todayISO());setSelectedCategory("all")}}>Today</button>
            <button className="primary" onClick={()=>setShowItemForm(true)}>＋ Add item</button>
          </div>
        </header>

        <div className="date-strip">
          <label>View date <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} /></label>
          <span className="item-count">{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}</span>
        </div>

        <div className="grid">
          <section className="panel">
            <div className="panel-head">
              <div><p className="eyebrow">ENTRIES</p><h2>{selectedDate === todayISO() ? "Today" : prettyDate(selectedDate)}</h2></div>
              {loading && <span className="muted">Loading…</span>}
            </div>
            {visibleItems.length === 0 ? (
              <div className="empty"><div className="empty-icon">○</div><h3>No entries for this date</h3><p>Add an item and assign it to this date.</p><button className="primary" onClick={()=>{setItemDate(selectedDate);setShowItemForm(true)}}>Add first item</button></div>
            ) : (
              <div className="items">
                {visibleItems.map(item => {
                  const future = item.due_date > todayISO();
                  return <article className={`item-card ${future ? "future" : ""} ${item.completed ? "completed" : ""}`} key={item.id}>
                    <button className="check" onClick={()=>toggleItem(item)} aria-label="Toggle complete">{item.completed ? "✓" : ""}</button>
                    <div className="item-main">
                      <div className="item-title-row"><h3>{item.title}</h3>{future && <span className="future-badge">UPCOMING</span>}</div>
                      <p>{categories.find(c=>c.id===item.category_id)?.name || "Uncategorized"} · {item.due_date}</p>
                      {item.notes && <small>{item.notes}</small>}
                    </div>
                    <button className="delete" onClick={()=>deleteItem(item.id)} aria-label="Delete">×</button>
                  </article>
                })}
              </div>
            )}
          </section>

          <aside className="panel upcoming">
            <div className="panel-head"><div><p className="eyebrow">LOOK AHEAD</p><h2>Upcoming</h2></div></div>
            {futureItems.length === 0 ? <p className="muted">No future entries yet.</p> : futureItems.map(item =>
              <button className="upcoming-row" key={item.id} onClick={()=>{setSelectedDate(item.due_date);setSelectedCategory("all")}}>
                <span className="upcoming-dot"></span><span><strong>{item.title}</strong><small>{item.due_date}</small></span>
              </button>
            )}
            <div className="rule"></div>
            <p className="tip"><strong>Future items change automatically.</strong><br/>Items dated after today use the upcoming style. When their date arrives, they return to the normal ledger style.</p>
          </aside>
        </div>

        {showCategoryForm && <div className="modal-backdrop"><form className="modal" onSubmit={addCategory}>
          <div className="modal-head"><div><p className="eyebrow">NEW CATEGORY</p><h2>Create category</h2></div><button type="button" className="close" onClick={()=>setShowCategoryForm(false)}>×</button></div>
          <label>Category name<input autoFocus value={categoryName} onChange={e=>setCategoryName(e.target.value)} placeholder="e.g. Finance" /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowCategoryForm(false)}>Cancel</button><button className="primary">Create</button></div>
        </form></div>}

        {showItemForm && <div className="modal-backdrop"><form className="modal" onSubmit={addItem}>
          <div className="modal-head"><div><p className="eyebrow">NEW ENTRY</p><h2>Add ledger item</h2></div><button type="button" className="close" onClick={()=>setShowItemForm(false)}>×</button></div>
          <label>Item<input autoFocus value={itemTitle} onChange={e=>setItemTitle(e.target.value)} placeholder="What needs to be recorded?" /></label>
          <div className="two-col">
            <label>Category<select value={itemCategory} onChange={e=>setItemCategory(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Date<input type="date" value={itemDate} onChange={e=>setItemDate(e.target.value)} /></label>
          </div>
          <label>Notes <span className="optional">optional</span><textarea rows={3} value={itemNotes} onChange={e=>setItemNotes(e.target.value)} placeholder="Additional context…" /></label>
          <div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowItemForm(false)}>Cancel</button><button className="primary">Add item</button></div>
        </form></div>}
      </section>
    </main>
  );
}