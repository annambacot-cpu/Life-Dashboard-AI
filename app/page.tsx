"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = { id: number; title: string; meta: string; done: boolean; tag: string };
type Goal = { id: number; title: string; progress: number; detail: string; color: string };
type Project = { id: number; title: string; category: string; progress: number; next: string; status: string; color: string };
type Habit = { id: number; name: string; streak: number; week: boolean[] };
type Decision = { id: number; title: string; confidence: number; date: string; status: string };
type Skill = { id: number; name: string; score: number; evidence: string };
type Note = { id: number; title: string; tag: string; excerpt: string };
type CalendarEvent = { id: number; title: string; date: string; time: string; category: string };
type FinanceEntry = { id: number; label: string; amount: number; type: "income" | "expense" | "savings" };
type Kind = "task" | "goal" | "project" | "habit" | "decision" | "skill" | "note" | "event" | "finance";
type Editable = Task | Goal | Project | Habit | Decision | Skill | Note | CalendarEvent | FinanceEntry;
type DashboardState = {
  tasks: Task[]; goals: Goal[]; projects: Project[]; habits: Habit[]; decisions: Decision[];
  skills: Skill[]; notes: Note[]; events: CalendarEvent[]; finances: FinanceEntry[]; reflection: string;
};

const STORAGE_KEY = "life-dashboard-ai-v2";
const emptyState: DashboardState = { tasks: [], goals: [], projects: [], habits: [], decisions: [], skills: [], notes: [], events: [], finances: [], reflection: "" };
const navItems = [
  ["overview", "⌂", "Overview"], ["goals", "◎", "Goals"], ["projects", "◇", "Projects"],
  ["habits", "↻", "Habits"], ["calendar", "□", "Calendar"], ["notes", "≡", "Notes & knowledge"],
  ["decisions", "⌘", "Decisions"], ["skills", "△", "Skills"], ["finance", "$", "Finances"],
] as const;
const viewCopy: Record<string, [string, string]> = {
  goals: ["Goals", "Turn the life you want into progress you can see."], projects: ["Projects", "Everything active, with the next action already decided."],
  habits: ["Habits", "Build consistency one honest check-in at a time."], calendar: ["Calendar", "See your commitments without losing sight of what matters."],
  notes: ["Notes & knowledge", "Your private, searchable brain for ideas, research, and memories."], decisions: ["Decision journal", "Record your reasoning so future you can learn from it."],
  skills: ["Skill tracker", "Measure growth with evidence, not just intention."], finance: ["Finance pulse", "A clear view of where your money goes and what it makes possible."],
};
const kindForView: Record<string, Kind> = { goals: "goal", projects: "project", habits: "habit", calendar: "event", notes: "note", decisions: "decision", skills: "skill", finance: "finance" };
const colorOptions = ["#28645c", "#de7d4c", "#7763a8", "#4177a6", "#a65d75"];

function todayInput() { return new Date().toISOString().slice(0, 10); }
function money(value: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value); }

export default function Home() {
  const [data, setData] = useState<DashboardState>(emptyState);
  const [active, setActive] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [editor, setEditor] = useState<{ kind: Kind; item?: Editable } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Add your goals and focus tasks, then ask me what deserves your attention.");
  const [noteSearch, setNoteSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setData({ ...emptyState, ...JSON.parse(saved) });
      } catch { /* Keep the workspace usable if storage is unavailable. */ }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* Keep current session usable. */ }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [data, loaded]);

  const todayDone = data.tasks.filter((task) => task.done).length;
  const alignment = data.goals.length ? Math.round(data.goals.reduce((sum, goal) => sum + goal.progress, 0) / data.goals.length) : 0;
  const habitsKept = data.habits.length ? Math.round(data.habits.flatMap((h) => h.week).filter(Boolean).length / (data.habits.length * 7) * 100) : 0;
  const momentum = data.goals.length || data.habits.length ? Math.round((alignment + habitsKept) / 2) : 0;
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  function askLifeAI(event: FormEvent) {
    event.preventDefault();
    const q = question.toLowerCase();
    const openTask = data.tasks.find((task) => !task.done);
    const topGoal = [...data.goals].sort((a, b) => b.progress - a.progress)[0];
    if (!data.tasks.length && !data.goals.length) setAnswer("Start by adding one meaningful goal and the next task that moves it forward.");
    else if (q.includes("goal") || q.includes("progress")) setAnswer(topGoal ? `${topGoal.title} is currently at ${topGoal.progress}%. A small next action today will keep it moving.` : "Add a goal first, then I can help you track its progress.");
    else if (q.includes("habit")) setAnswer(data.habits.length ? `You kept ${habitsKept}% of your habit check-ins this week. Aim for consistency, not perfection.` : "Add one tiny habit you can honestly repeat this week.");
    else setAnswer(openTask ? `Your next clear action is “${openTask.title}.” Protect a focused block for it.` : "Your focus list is clear. Add the next action that matters most.");
    setQuestion("");
  }

  function remove(kind: Kind, id: number) {
    setData((d) => {
      if (kind === "task") return { ...d, tasks: d.tasks.filter((x) => x.id !== id) };
      if (kind === "goal") return { ...d, goals: d.goals.filter((x) => x.id !== id) };
      if (kind === "project") return { ...d, projects: d.projects.filter((x) => x.id !== id) };
      if (kind === "habit") return { ...d, habits: d.habits.filter((x) => x.id !== id) };
      if (kind === "decision") return { ...d, decisions: d.decisions.filter((x) => x.id !== id) };
      if (kind === "skill") return { ...d, skills: d.skills.filter((x) => x.id !== id) };
      if (kind === "note") return { ...d, notes: d.notes.filter((x) => x.id !== id) };
      if (kind === "event") return { ...d, events: d.events.filter((x) => x.id !== id) };
      return { ...d, finances: d.finances.filter((x) => x.id !== id) };
    });
  }

  function save(kind: Kind, values: Record<string, string>, existingId?: number) {
    const id = existingId ?? Date.now();
    setData((d) => {
      const put = <T extends { id: number }>(list: T[], item: T) => existingId ? list.map((x) => x.id === existingId ? item : x) : [item, ...list];
      if (kind === "task") return { ...d, tasks: put(d.tasks, { id, title: values.title, meta: values.meta || "Inbox", tag: values.tag || "Focus", done: existingId ? d.tasks.find((x) => x.id === id)?.done ?? false : false }) };
      if (kind === "goal") return { ...d, goals: put(d.goals, { id, title: values.title, detail: values.detail, progress: Number(values.progress) || 0, color: values.color }) };
      if (kind === "project") return { ...d, projects: put(d.projects, { id, title: values.title, category: values.category, next: values.next, status: values.status, progress: Number(values.progress) || 0, color: values.color }) };
      if (kind === "habit") return { ...d, habits: put(d.habits, { id, name: values.name, streak: Number(values.streak) || 0, week: existingId ? d.habits.find((x) => x.id === id)?.week ?? Array(7).fill(false) : Array(7).fill(false) }) };
      if (kind === "decision") return { ...d, decisions: put(d.decisions, { id, title: values.title, confidence: Number(values.confidence) || 0, date: values.date, status: values.status }) };
      if (kind === "skill") return { ...d, skills: put(d.skills, { id, name: values.name, score: Number(values.score) || 0, evidence: values.evidence }) };
      if (kind === "note") return { ...d, notes: put(d.notes, { id, title: values.title, tag: values.tag, excerpt: values.excerpt }) };
      if (kind === "event") return { ...d, events: put(d.events, { id, title: values.title, date: values.date, time: values.time, category: values.category }) };
      return { ...d, finances: put(d.finances, { id, label: values.label, amount: Number(values.amount) || 0, type: values.type as FinanceEntry["type"] }) };
    });
    setEditor(null);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setActive("overview")}><span className="brand-mark">L</span><span>Life Dashboard<small>AI</small></span></button>
      <nav aria-label="Dashboard sections">{navItems.map(([id, icon, label]) => <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => setActive(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><div className="week-card"><span>Goal alignment</span><strong>{alignment}%</strong><div className="mini-track"><i style={{ width: `${alignment}%` }} /></div><small>{data.goals.length ? "Based on your active goals" : "Add a goal to begin"}</small></div><div className="profile"><span>AB</span><span>Anna<small>Personal workspace · Autosaved</small></span></div></div>
    </aside>
    <main>
      <header className="topbar"><div><span className="eyebrow">{dateLabel}</span><h1>{active === "overview" ? "Good morning, Anna." : viewCopy[active]?.[0]}</h1></div><div className="top-actions"><span className="save-state">● Autosaved</span><button className="capture-button" onClick={() => setEditor({ kind: active === "overview" ? "task" : kindForView[active] })}>＋ Add {active === "overview" ? "task" : singular(active)}</button></div></header>
      {active === "overview" ? <div className="dashboard-grid">
        <section className="ai-card full"><div className="ai-orb">✦</div><div className="ai-copy"><span className="eyebrow">LIFE AI BRIEFING</span><h2>What should I focus on today?</h2><p>{answer}</p><form onSubmit={askLifeAI} className="ask-form"><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your goals, habits, or next step…"/><button>↑</button></form></div><div className="focus-score"><span>MOMENTUM</span><strong>{momentum}</strong><small>Your live score</small></div></section>
        <section className="panel tasks-panel"><PanelHeader eyebrow="TODAY" title="Your focus list" action={`${todayDone}/${data.tasks.length} done`} /><div className="task-list">{data.tasks.length ? data.tasks.map((task) => <div className={task.done ? "task done" : "task"} key={task.id}><label><input type="checkbox" checked={task.done} onChange={() => setData((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === task.id ? { ...x, done: !x.done } : x) }))}/><span className="checkmark">✓</span></label><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><span className="item-actions"><button onClick={() => setEditor({ kind: "task", item: task })}>Edit</button><button onClick={() => remove("task", task.id)}>×</button></span></div>) : <Empty label="No focus tasks yet." action="Add your first task" onClick={() => setEditor({ kind: "task" })}/>}</div></section>
        <section className="panel momentum-panel"><PanelHeader eyebrow="THIS WEEK" title="Life momentum" action="Live"/><div className="momentum-score"><div className="ring" style={{ "--score": `${momentum}%` } as React.CSSProperties}><strong>{momentum}</strong><small>overall</small></div><div><span className="trend">Your data</span><h3>{momentum ? "You’re building consistency." : "Your dashboard is ready."}</h3><p>Add goals and check off habits to make this score yours.</p></div></div><div className="metric-row"><Metric label="Tasks complete" value={`${todayDone}`} note={`of ${data.tasks.length}`}/><Metric label="Habits kept" value={`${habitsKept}%`} note="this week"/><Metric label="Projects" value={`${data.projects.length}`} note="active"/></div></section>
        <section className="panel goals-panel full"><PanelHeader eyebrow="ACTIVE GOALS" title="Where you’re headed" action={`${data.goals.length} goals`}/>{data.goals.length ? <div className="goal-grid">{data.goals.map((goal) => <article className="goal-card" key={goal.id}><CardActions onEdit={() => setEditor({ kind: "goal", item: goal })} onDelete={() => remove("goal", goal.id)}/><div className="goal-top"><span className="goal-icon" style={{ background: goal.color }}>◎</span><span>{goal.progress}%</span></div><h3>{goal.title}</h3><p>{goal.detail}</p><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div></article>)}</div> : <Empty label="Your goals will live here." action="Add a goal" onClick={() => setEditor({ kind: "goal" })}/>}</section>
        <section className="panel projects-panel full"><PanelHeader eyebrow="PROJECT OS" title="What you’re building" action={`${data.projects.length} projects`}/>{data.projects.length ? <div className="project-list">{data.projects.map((project) => <article className="project-row" key={project.id}><span className="project-symbol sage">◇</span><div className="project-main"><span>{project.category}</span><h3>{project.title}</h3><p><b>Next:</b> {project.next}</p></div><div className="project-progress"><strong>{project.progress}%</strong><div className="progress"><i style={{ width: `${project.progress}%` }}/></div></div><em>{project.status}</em><span className="item-actions"><button onClick={() => setEditor({ kind: "project", item: project })}>Edit</button><button onClick={() => remove("project", project.id)}>×</button></span></article>)}</div> : <Empty label="No active projects yet." action="Add a project" onClick={() => setEditor({ kind: "project" })}/>}</section>
        <section className="panel reflection-panel full"><div><span className="eyebrow">WEEKLY REFLECTION</span><h2>What did this week teach you?</h2><p>This is your private space. It saves as you type.</p></div><textarea value={data.reflection} onChange={(e) => setData((d) => ({ ...d, reflection: e.target.value }))} placeholder="Write your reflection…"/></section>
      </div> : (
        <DetailView active={active} data={data} setData={setData} subtitle={viewCopy[active]?.[1]} noteSearch={noteSearch} setNoteSearch={setNoteSearch} edit={(kind, item) => setEditor({ kind, item })} remove={remove}/>
      )}
    </main>
    {editor && (
      <Editor editor={editor} onClose={() => setEditor(null)} onSave={save}/>
    )}
  </div>;
}

function singular(active: string) { return ({ goals: "goal", projects: "project", habits: "habit", calendar: "event", notes: "note", decisions: "decision", skills: "skill", finance: "entry" } as Record<string, string>)[active] || "item"; }
function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) { return <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="panel-count">{action}</span></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Empty({ label, action, onClick }: { label: string; action: string; onClick: () => void }) { return <div className="empty-state"><span>✦</span><p>{label}</p><button onClick={onClick}>＋ {action}</button></div>; }
function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="card-actions"><button onClick={onEdit}>Edit</button><button onClick={onDelete} aria-label="Delete">×</button></div>; }

function DetailView({ active, data, setData, subtitle, noteSearch, setNoteSearch, edit, remove }: { active: string; data: DashboardState; setData: React.Dispatch<React.SetStateAction<DashboardState>>; subtitle: string; noteSearch: string; setNoteSearch: (x: string) => void; edit: (kind: Kind, item: Editable) => void; remove: (kind: Kind, id: number) => void }) {
  const add = () => document.querySelector<HTMLButtonElement>(".capture-button")?.click();
  if (active === "goals") return <Page subtitle={subtitle}>{data.goals.length ? <div className="detail-cards">{data.goals.map((goal) => <article className="big-card" key={goal.id}><CardActions onEdit={() => edit("goal", goal)} onDelete={() => remove("goal", goal.id)}/><span className="eyebrow">ACTIVE GOAL</span><h2>{goal.title}</h2><p>{goal.detail}</p><div className="big-number">{goal.progress}%</div><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div></article>)}</div> : <Empty label="You haven't added any goals." action="Add your first goal" onClick={add}/>}</Page>;
  if (active === "projects") return <Page subtitle={subtitle}>{data.projects.length ? <div className="detail-cards">{data.projects.map((project) => <article className="big-card" key={project.id}><CardActions onEdit={() => edit("project", project)} onDelete={() => remove("project", project.id)}/><span className="eyebrow">{project.category || "PROJECT"}</span><h2>{project.title}</h2><p><b>Next:</b> {project.next}</p><div className="big-number">{project.progress}%</div><div className="progress"><i style={{ width: `${project.progress}%` }}/></div><small className="status-pill">{project.status}</small></article>)}</div> : <Empty label="You haven't added any projects." action="Add your first project" onClick={add}/>}</Page>;
  if (active === "habits") return <Page subtitle={subtitle}>{data.habits.length ? <section className="detail-panel"><div className="experiment-head"><div><span className="eyebrow">THIS WEEK</span><h2>Your consistency, day by day</h2></div><span>Tap a day to check in</span></div>{data.habits.map((habit) => <div className="habit-row" key={habit.id}><div><strong>{habit.name}</strong><small>{habit.week.filter(Boolean).length} of 7 days · {habit.streak} day streak</small></div><div className="habit-controls"><div className="habit-week">{habit.week.map((done, i) => <button className={done ? "kept" : ""} key={i} title={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} onClick={() => setData((d) => ({ ...d, habits: d.habits.map((h) => h.id === habit.id ? { ...h, week: h.week.map((x, n) => n === i ? !x : x) } : h) }))}>{done ? "✓" : ["M","T","W","T","F","S","S"][i]}</button>)}</div><span className="item-actions"><button onClick={() => edit("habit", habit)}>Edit</button><button onClick={() => remove("habit", habit.id)}>×</button></span></div></div>)}</section> : <Empty label="No habits to check in yet." action="Add your first habit" onClick={add}/>}</Page>;
  if (active === "decisions") return <Page subtitle={subtitle}>{data.decisions.length ? <div className="detail-cards">{data.decisions.map((decision) => <article className="big-card" key={decision.id}><CardActions onEdit={() => edit("decision", decision)} onDelete={() => remove("decision", decision.id)}/><span className="eyebrow">{decision.date}</span><h2>{decision.title}</h2><p>{decision.status}</p><div className="confidence"><strong>{decision.confidence}%</strong><span>confidence at decision time</span></div></article>)}</div> : <Empty label="Your decision journal is empty." action="Record a decision" onClick={add}/>}</Page>;
  if (active === "skills") return <Page subtitle={subtitle}>{data.skills.length ? <section className="detail-panel">{data.skills.map((skill) => <div className="skill-row" key={skill.id}><div><strong>{skill.name}</strong><small>{skill.evidence}</small></div><div className="progress"><i style={{ width: `${skill.score}%` }}/></div><b>{skill.score}</b><span className="item-actions"><button onClick={() => edit("skill", skill)}>Edit</button><button onClick={() => remove("skill", skill.id)}>×</button></span></div>)}</section> : <Empty label="No skills are being tracked." action="Add a skill" onClick={add}/>}</Page>;
  if (active === "notes") {
    const shown = data.notes.filter((note) => `${note.title} ${note.tag} ${note.excerpt}`.toLowerCase().includes(noteSearch.toLowerCase()));
    return <Page subtitle={subtitle}><div className="knowledge-search">⌕<input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search every note…"/></div>{shown.length ? <div className="detail-cards">{shown.map((note) => <article className="big-card note-card" key={note.id}><CardActions onEdit={() => edit("note", note)} onDelete={() => remove("note", note.id)}/><span className="eyebrow">{note.tag || "NOTE"}</span><h2>{note.title}</h2><p>{note.excerpt}</p></article>)}</div> : <Empty label={noteSearch ? "No notes match that search." : "Your notes are empty."} action="Add a note" onClick={add}/>}</Page>;
  }
  if (active === "calendar") return <Page subtitle={subtitle}>{data.events.length ? <section className="detail-panel calendar-list">{[...data.events].sort((a,b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).map((event) => <article className="calendar-event" key={event.id}><div className="date-tile"><strong>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { day: "numeric" })}</strong><span>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span></div><div><span className="eyebrow">{event.category || "EVENT"}</span><h3>{event.title}</h3><p>{event.time || "All day"}</p></div><span className="item-actions"><button onClick={() => edit("event", event)}>Edit</button><button onClick={() => remove("event", event.id)}>×</button></span></article>)}</section> : <Empty label="Your calendar is clear." action="Add an event" onClick={add}/>}</Page>;
  const income = data.finances.filter((x) => x.type === "income").reduce((s,x) => s + x.amount, 0);
  const expenses = data.finances.filter((x) => x.type === "expense").reduce((s,x) => s + x.amount, 0);
  const savings = data.finances.filter((x) => x.type === "savings").reduce((s,x) => s + x.amount, 0);
  return <Page subtitle={subtitle}><div className="finance-grid"><article><span>Income logged</span><strong>{money(income)}</strong><small>Your total income entries</small></article><article><span>Expenses logged</span><strong>{money(expenses)}</strong><small>Your total spending</small></article><article><span>Saved toward goals</span><strong>{money(savings)}</strong><small>Set aside intentionally</small></article></div>{data.finances.length ? <section className="detail-panel finance-list"><PanelHeader eyebrow="MONEY LOG" title="Your entries" action={`${money(income - expenses - savings)} available`}/>{data.finances.map((entry) => <article className="finance-entry" key={entry.id}><span className={`money-type ${entry.type}`}>{entry.type}</span><strong>{entry.label}</strong><b>{entry.type === "income" ? "+" : "−"}{money(entry.amount)}</b><span className="item-actions"><button onClick={() => edit("finance", entry)}>Edit</button><button onClick={() => remove("finance", entry.id)}>×</button></span></article>)}</section> : <Empty label="No money entries yet." action="Add income, expense, or savings" onClick={add}/>}</Page>;
}

function Page({ subtitle, children }: { subtitle: string; children: React.ReactNode }) { return <div className="detail-page"><p className="page-intro">{subtitle}</p>{children}</div>; }

function Editor({ editor, onClose, onSave }: { editor: { kind: Kind; item?: Editable }; onClose: () => void; onSave: (kind: Kind, values: Record<string, string>, id?: number) => void }) {
  const initial = useMemo(() => {
    const item = editor.item as unknown as Record<string, unknown> | undefined;
    const defaults: Record<Kind, Record<string, string>> = {
      task: { title: "", meta: "Today · Personal", tag: "Focus" }, goal: { title: "", detail: "", progress: "0", color: colorOptions[0] },
      project: { title: "", category: "Personal", next: "", status: "In progress", progress: "0", color: colorOptions[0] }, habit: { name: "", streak: "0" },
      decision: { title: "", confidence: "50", date: todayInput(), status: "Revisit later" }, skill: { name: "", score: "0", evidence: "" },
      note: { title: "", tag: "Personal", excerpt: "" }, event: { title: "", date: todayInput(), time: "", category: "Personal" }, finance: { label: "", amount: "", type: "expense" },
    };
    return Object.fromEntries(Object.entries(defaults[editor.kind]).map(([key, value]) => [key, item?.[key] === undefined ? value : String(item[key])]));
  }, [editor]);
  const [values, setValues] = useState(initial);
  const change = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const label = editor.item ? `Edit ${editor.kind}` : `Add ${editor.kind}`;
  function submit(e: FormEvent) { e.preventDefault(); onSave(editor.kind, values, editor.item?.id); }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="capture-modal editor-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="eyebrow">LIVE UPDATE</span><h2>{label}</h2><div className="form-grid">
    {editor.kind === "task" && <><Field label="Task" value={values.title} onChange={(v) => change("title", v)} required/><Field label="When / area" value={values.meta} onChange={(v) => change("meta", v)}/><Field label="Tag" value={values.tag} onChange={(v) => change("tag", v)}/></>}
    {editor.kind === "goal" && <><Field label="Goal" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Details" value={values.detail} onChange={(v) => change("detail", v)} wide/><Range label="Progress" value={values.progress} onChange={(v) => change("progress", v)}/><Color value={values.color} onChange={(v) => change("color", v)}/></>}
    {editor.kind === "project" && <><Field label="Project" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Category" value={values.category} onChange={(v) => change("category", v)}/><Field label="Next action" value={values.next} onChange={(v) => change("next", v)} wide/><Select label="Status" value={values.status} options={["In progress","On track","Exploring","Paused","Complete"]} onChange={(v) => change("status", v)}/><Range label="Progress" value={values.progress} onChange={(v) => change("progress", v)}/></>}
    {editor.kind === "habit" && <><Field label="Habit" value={values.name} onChange={(v) => change("name", v)} required/><Field label="Current streak" value={values.streak} onChange={(v) => change("streak", v)} type="number"/></>}
    {editor.kind === "decision" && <><Field label="Decision" value={values.title} onChange={(v) => change("title", v)} required wide/><Field label="Date" value={values.date} onChange={(v) => change("date", v)} type="date"/><Range label="Confidence" value={values.confidence} onChange={(v) => change("confidence", v)}/><Field label="Status / revisit note" value={values.status} onChange={(v) => change("status", v)} wide/></>}
    {editor.kind === "skill" && <><Field label="Skill" value={values.name} onChange={(v) => change("name", v)} required/><Range label="Current level" value={values.score} onChange={(v) => change("score", v)}/><Field label="Evidence of growth" value={values.evidence} onChange={(v) => change("evidence", v)} wide/></>}
    {editor.kind === "note" && <><Field label="Title" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Tag" value={values.tag} onChange={(v) => change("tag", v)}/><Field label="Note" value={values.excerpt} onChange={(v) => change("excerpt", v)} wide multiline/></>}
    {editor.kind === "event" && <><Field label="Event" value={values.title} onChange={(v) => change("title", v)} required wide/><Field label="Date" value={values.date} onChange={(v) => change("date", v)} type="date" required/><Field label="Time" value={values.time} onChange={(v) => change("time", v)} type="time"/><Field label="Category" value={values.category} onChange={(v) => change("category", v)}/></>}
    {editor.kind === "finance" && <><Field label="Name" value={values.label} onChange={(v) => change("label", v)} required/><Field label="Amount" value={values.amount} onChange={(v) => change("amount", v)} type="number" required/><Select label="Type" value={values.type} options={["income","expense","savings"]} onChange={(v) => change("type", v)}/></>}
  </div><div className="modal-footer"><span>Changes save to this browser</span><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit">Save changes</button></div></form></div>;
}
function Field({ label, value, onChange, required, wide, multiline, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; wide?: boolean; multiline?: boolean; type?: string }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required}/> : <input type={type} min={type === "number" ? "0" : undefined} value={value} onChange={(e) => onChange(e.target.value)} required={required}/>}</label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((x) => <option key={x}>{x}</option>)}</select></label>; }
function Range({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="field range-field"><span>{label}: <b>{value}%</b></span><input type="range" min="0" max="100" value={value} onChange={(e) => onChange(e.target.value)}/></label>; }
function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <label className="field"><span>Color</span><div className="color-options">{colorOptions.map((color) => <button type="button" key={color} className={value === color ? "selected" : ""} style={{ background: color }} onClick={() => onChange(color)} aria-label={`Choose ${color}`}/>)}</div></label>; }
