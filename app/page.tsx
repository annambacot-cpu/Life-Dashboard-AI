"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { strFromU8, unzipSync } from "fflate";

type Task = { id: number; title: string; meta: string; done: boolean; tag: string };
type GoalStep = { id: number; title: string; done: boolean };
type Goal = { id: number; title: string; progress: number; detail: string; color: string; steps: GoalStep[] };
type Project = { id: number; title: string; category: string; progress: number; next: string; status: string; color: string };
type Habit = { id: number; name: string; streak: number; week: boolean[] };
type Note = { id: number; title: string; tag: string; excerpt: string };
type CalendarEvent = { id: number; title: string; date: string; time: string; category: string };
type Thought = { id: number; text: string; date: string; type: "Lesson" | "Quote" | "On my mind" };
type KnowledgeFile = { id: number; name: string; size: number; addedAt: string; text: string; kind: string };
type Kind = "task" | "goal" | "project" | "habit" | "note" | "event" | "thought";
type Editable = Task | Goal | Project | Habit | Note | CalendarEvent | Thought;
type DashboardState = {
  tasks: Task[]; goals: Goal[]; projects: Project[]; habits: Habit[];
  notes: Note[]; events: CalendarEvent[]; thoughts: Thought[]; reflection: string;
};

const STORAGE_KEY = "life-dashboard-ai-v2";
const emptyState: DashboardState = { tasks: [], goals: [], projects: [], habits: [], notes: [], events: [], thoughts: [], reflection: "" };
const navItems = [
  ["overview", "⌂", "Overview"], ["goals", "◎", "Goals"], ["projects", "◇", "Projects"],
  ["habits", "↻", "Habits"], ["calendar", "□", "Calendar"], ["notes", "≡", "Notes & knowledge"],
  ["thoughts", "✦", "Daily thoughts"],
] as const;
const viewCopy: Record<string, [string, string]> = {
  goals: ["Goals", "Turn the life you want into progress you can see."], projects: ["Projects", "Everything active, with the next action already decided."],
  habits: ["Habits", "Build consistency one honest check-in at a time."], calendar: ["Calendar", "See your commitments without losing sight of what matters."],
  notes: ["Notes & knowledge", "Bring your documents and ideas together, then turn them into clear next actions."],
  thoughts: ["Daily thoughts", "Keep the lessons, quotes, and honest thoughts that shape who you’re becoming."],
};
const kindForView: Record<string, Kind> = { goals: "goal", projects: "project", habits: "habit", calendar: "event", notes: "note", thoughts: "thought" };
const colorOptions = ["#28645c", "#de7d4c", "#7763a8", "#4177a6", "#a65d75"];

function todayInput() { return new Date().toISOString().slice(0, 10); }
function thoughtInsights(thoughts: Thought[]) {
  const stopWords = new Set(["about", "after", "again", "being", "could", "every", "from", "have", "into", "just", "more", "only", "other", "really", "something", "their", "there", "these", "thing", "today", "when", "where", "which", "with", "would", "your", "that", "this", "they", "what", "people"]);
  const counts = new Map<string, number>();
  thoughts.forEach((entry) => entry.text.toLowerCase().match(/[a-z']{5,}/g)?.forEach((word) => { if (!stopWords.has(word)) counts.set(word, (counts.get(word) || 0) + 1); }));
  const themes = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = thoughts.filter((entry) => entry.date.startsWith(month)).length;
  const dates = new Set(thoughts.map((entry) => entry.date));
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setDate(cursor.getDate() - 1); }
  return { themes, thisMonth, streak };
}

function openKnowledgeDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("life-dashboard-knowledge", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function loadKnowledgeFiles() {
  const db = await openKnowledgeDB();
  return new Promise<KnowledgeFile[]>((resolve, reject) => {
    const request = db.transaction("files", "readonly").objectStore("files").getAll();
    request.onsuccess = () => resolve(request.result as KnowledgeFile[]);
    request.onerror = () => reject(request.error);
  });
}
async function storeKnowledgeFile(file: KnowledgeFile) {
  const db = await openKnowledgeDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("files", "readwrite").objectStore("files").put(file);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
async function eraseKnowledgeFile(id: number) {
  const db = await openKnowledgeDB();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("files", "readwrite").objectStore("files").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
function decodeXmlText(xml: string) {
  const pieces = [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]);
  const doc = new DOMParser().parseFromString(pieces.join(" "), "text/html");
  return doc.documentElement.textContent?.replace(/\s+/g, " ").trim() || "";
}
async function readUploadedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "file";
  if (extension === "docx") {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const documentXml = archive["word/document.xml"];
    if (!documentXml) throw new Error("This Word file could not be read.");
    return { text: decodeXmlText(strFromU8(documentXml)), kind: "Word document" };
  }
  const raw = await file.text();
  if (extension === "gdoc") {
    let url = "";
    try { url = JSON.parse(raw).url || ""; } catch { /* Keep it as a saved reference. */ }
    return { text: url ? `Google Doc reference: ${url}` : "Google Doc reference saved. Export it as a Word document to include its full text in suggestions.", kind: "Google Doc link" };
  }
  if (extension === "rtf") return { text: raw.replace(/\\[a-z]+\d* ?|[{}]/gi, " ").replace(/\s+/g, " ").trim(), kind: "Rich text" };
  return { text: raw, kind: extension === "md" ? "Markdown" : "Text document" };
}

function focusFromKnowledge(files: KnowledgeFile[], notes: Note[], tasks: Task[]) {
  const openTask = tasks.find((task) => !task.done);
  const combined = [...files.map((file) => file.text), ...notes.map((note) => `${note.title} ${note.excerpt}`)].join(" ").toLowerCase();
  const priorityLines = combined.split(/[.\n]/).filter((line) => /deadline|priority|next step|follow up|today|important|finish|submit|due/.test(line)).map((line) => line.trim()).filter(Boolean);
  if (priorityLines[0]) return `Your knowledge library points to this: “${priorityLines[0].slice(0, 180)}.” Turn that into one clear action today.`;
  if (openTask) return `Start with “${openTask.title}.” It is the first unfinished item on your focus list.`;
  if (files.length || notes.length) return `You have ${files.length + notes.length} items in your knowledge library. Review the newest one and capture its single most useful next action.`;
  return "Upload a document or add a note, and I’ll use it with your goals and tasks to suggest a focus.";
}

export default function Home() {
  const [data, setData] = useState<DashboardState>(emptyState);
  const [active, setActive] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [editor, setEditor] = useState<{ kind: Kind; item?: Editable } | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Add your goals and focus tasks, then ask me what deserves your attention.");
  const [noteSearch, setNoteSearch] = useState("");
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);

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
  useEffect(() => {
    loadKnowledgeFiles().then((files) => setKnowledgeFiles(files.sort((a, b) => b.id - a.id))).catch(() => setKnowledgeFiles([]));
  }, []);

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
    const journal = thoughtInsights(data.thoughts);
    if (!data.tasks.length && !data.goals.length) setAnswer("Start by adding one meaningful goal and the next task that moves it forward.");
    else if (q.includes("goal") || q.includes("progress")) setAnswer(topGoal ? `${topGoal.title} is currently at ${topGoal.progress}%. A small next action today will keep it moving.` : "Add a goal first, then I can help you track its progress.");
    else if (q.includes("habit")) setAnswer(data.habits.length ? `You kept ${habitsKept}% of your habit check-ins this week. Aim for consistency, not perfection.` : "Add one tiny habit you can honestly repeat this week.");
    else if (q.includes("learn") || q.includes("thought") || q.includes("quote") || q.includes("pattern")) setAnswer(data.thoughts.length ? `You’ve saved ${data.thoughts.length} thoughts. ${journal.themes.length ? `The themes showing up most are ${journal.themes.join(", ")}.` : "Keep writing and your recurring themes will begin to appear."}` : "Write your first daily thought, lesson, or quote and I’ll help you notice patterns over time.");
    else if (q.includes("focus") || q.includes("today") || q.includes("document") || q.includes("note")) setAnswer(focusFromKnowledge(knowledgeFiles, data.notes, data.tasks));
    else setAnswer(openTask ? `Your next clear action is “${openTask.title}.” Protect a focused block for it.` : focusFromKnowledge(knowledgeFiles, data.notes, data.tasks));
    setQuestion("");
  }

  function remove(kind: Kind, id: number) {
    setData((d) => {
      if (kind === "task") return { ...d, tasks: d.tasks.filter((x) => x.id !== id) };
      if (kind === "goal") return { ...d, goals: d.goals.filter((x) => x.id !== id) };
      if (kind === "project") return { ...d, projects: d.projects.filter((x) => x.id !== id) };
      if (kind === "habit") return { ...d, habits: d.habits.filter((x) => x.id !== id) };
      if (kind === "note") return { ...d, notes: d.notes.filter((x) => x.id !== id) };
      if (kind === "event") return { ...d, events: d.events.filter((x) => x.id !== id) };
      return { ...d, thoughts: d.thoughts.filter((x) => x.id !== id) };
    });
  }

  function save(kind: Kind, values: Record<string, string>, existingId?: number) {
    const id = existingId ?? Date.now();
    setData((d) => {
      const put = <T extends { id: number }>(list: T[], item: T) => existingId ? list.map((x) => x.id === existingId ? item : x) : [item, ...list];
      if (kind === "task") return { ...d, tasks: put(d.tasks, { id, title: values.title, meta: values.meta || "Inbox", tag: values.tag || "Focus", done: existingId ? d.tasks.find((x) => x.id === id)?.done ?? false : false }) };
      if (kind === "goal") {
        const previous = d.goals.find((goal) => goal.id === id);
        const steps = values.steps.split("\n").map((title) => title.trim()).filter(Boolean).map((title, index) => {
          const match = previous?.steps?.find((step) => step.title.toLowerCase() === title.toLowerCase());
          return match || { id: Date.now() + index, title, done: false };
        });
        return { ...d, goals: put(d.goals, { id, title: values.title, detail: values.detail, progress: Number(values.progress) || 0, color: values.color, steps }) };
      }
      if (kind === "project") return { ...d, projects: put(d.projects, { id, title: values.title, category: values.category, next: values.next, status: values.status, progress: Number(values.progress) || 0, color: values.color }) };
      if (kind === "habit") return { ...d, habits: put(d.habits, { id, name: values.name, streak: Number(values.streak) || 0, week: existingId ? d.habits.find((x) => x.id === id)?.week ?? Array(7).fill(false) : Array(7).fill(false) }) };
      if (kind === "note") return { ...d, notes: put(d.notes, { id, title: values.title, tag: values.tag, excerpt: values.excerpt }) };
      if (kind === "event") return { ...d, events: put(d.events, { id, title: values.title, date: values.date, time: values.time, category: values.category }) };
      return { ...d, thoughts: put(d.thoughts, { id, text: values.text, date: values.date, type: values.type as Thought["type"] }) };
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
        <section className="panel tasks-panel"><PanelHeader eyebrow="TODAY" title="Your focus list" action={`${todayDone}/${data.tasks.length} done`} /><div className="task-list">{data.tasks.length ? data.tasks.map((task) => <div className={task.done ? "task done" : "task"} key={task.id}><label><input type="checkbox" checked={task.done} onChange={() => setData((d) => ({ ...d, tasks: d.tasks.map((x) => x.id === task.id ? { ...x, done: !x.done } : x) }))}/><span className="checkmark">✓</span></label><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><span className="item-actions"><button onClick={() => setEditor({ kind: "task", item: task })}>Edit</button><button onClick={() => remove("task", task.id)}>×</button></span></div>) : <Empty label="No focus tasks yet." action="Add your first task" onClick={() => setEditor({ kind: "task" })}/>}</div>{data.tasks.length > 0 && <button className="add-another" onClick={() => setEditor({ kind: "task" })}>＋ Add another task</button>}</section>
        <section className="panel momentum-panel"><PanelHeader eyebrow="THIS WEEK" title="Life momentum" action="Live"/><div className="momentum-score"><div className="ring" style={{ "--score": `${momentum}%` } as React.CSSProperties}><strong>{momentum}</strong><small>overall</small></div><div><span className="trend">Your data</span><h3>{momentum ? "You’re building consistency." : "Your dashboard is ready."}</h3><p>Add goals and check off habits to make this score yours.</p></div></div><div className="metric-row"><Metric label="Tasks complete" value={`${todayDone}`} note={`of ${data.tasks.length}`}/><Metric label="Habits kept" value={`${habitsKept}%`} note="this week"/><Metric label="Projects" value={`${data.projects.length}`} note="active"/></div></section>
        <section className="panel goals-panel full"><PanelHeader eyebrow="ACTIVE GOALS" title="Where you’re headed" action={`${data.goals.length} goals`}/>{data.goals.length ? <div className="goal-grid">{data.goals.map((goal) => <article className="goal-card" key={goal.id}><CardActions onEdit={() => setEditor({ kind: "goal", item: goal })} onDelete={() => remove("goal", goal.id)}/><div className="goal-top"><span className="goal-icon" style={{ background: goal.color }}>◎</span><span>{goal.progress}%</span></div><h3>{goal.title}</h3><p>{goal.detail}</p><div className="goal-step-count"><strong>{(goal.steps ?? []).filter((step) => step.done).length}/{(goal.steps ?? []).length}</strong><span>steps complete</span></div><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div><button className="plan-button" onClick={() => setActive("goals")}>Open goal plan →</button></article>)}</div> : <Empty label="Your goals will live here." action="Add a goal" onClick={() => setEditor({ kind: "goal" })}/>}</section>
        <section className="panel projects-panel full"><PanelHeader eyebrow="PROJECT OS" title="What you’re building" action={`${data.projects.length} projects`}/>{data.projects.length ? <div className="project-list">{data.projects.map((project) => <article className="project-row" key={project.id}><span className="project-symbol sage">◇</span><div className="project-main"><span>{project.category}</span><h3>{project.title}</h3><p><b>Next:</b> {project.next}</p></div><div className="project-progress"><strong>{project.progress}%</strong><div className="progress"><i style={{ width: `${project.progress}%` }}/></div></div><em>{project.status}</em><span className="item-actions"><button onClick={() => setEditor({ kind: "project", item: project })}>Edit</button><button onClick={() => remove("project", project.id)}>×</button></span></article>)}</div> : <Empty label="No active projects yet." action="Add a project" onClick={() => setEditor({ kind: "project" })}/>}</section>
        <section className="panel reflection-panel full"><div><span className="eyebrow">WEEKLY REFLECTION</span><h2>What did this week teach you?</h2><p>This is your private space. It saves as you type.</p></div><textarea value={data.reflection} onChange={(e) => setData((d) => ({ ...d, reflection: e.target.value }))} placeholder="Write your reflection…"/></section>
      </div> : (
        <DetailView active={active} data={data} setData={setData} subtitle={viewCopy[active]?.[1]} noteSearch={noteSearch} setNoteSearch={setNoteSearch} knowledgeFiles={knowledgeFiles} setKnowledgeFiles={setKnowledgeFiles} edit={(kind, item) => setEditor({ kind, item })} remove={remove}/>
      )}
    </main>
    {editor && (
      <Editor editor={editor} onClose={() => setEditor(null)} onSave={save}/>
    )}
  </div>;
}

function singular(active: string) { return ({ goals: "goal", projects: "project", habits: "habit", calendar: "event", notes: "note", thoughts: "thought" } as Record<string, string>)[active] || "item"; }
function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) { return <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><span className="panel-count">{action}</span></div>; }
function Metric({ label, value, note }: { label: string; value: string; note: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Empty({ label, action, onClick }: { label: string; action: string; onClick: () => void }) { return <div className="empty-state"><span>✦</span><p>{label}</p><button onClick={onClick}>＋ {action}</button></div>; }
function CardActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { return <div className="card-actions"><button onClick={onEdit}>Edit</button><button onClick={onDelete} aria-label="Delete">×</button></div>; }

function DetailView({ active, data, setData, subtitle, noteSearch, setNoteSearch, knowledgeFiles, setKnowledgeFiles, edit, remove }: { active: string; data: DashboardState; setData: React.Dispatch<React.SetStateAction<DashboardState>>; subtitle: string; noteSearch: string; setNoteSearch: (x: string) => void; knowledgeFiles: KnowledgeFile[]; setKnowledgeFiles: React.Dispatch<React.SetStateAction<KnowledgeFile[]>>; edit: (kind: Kind, item: Editable) => void; remove: (kind: Kind, id: number) => void }) {
  const add = () => document.querySelector<HTMLButtonElement>(".capture-button")?.click();
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [uploadMessage, setUploadMessage] = useState("");
  async function uploadFiles(list: FileList | null) {
    if (!list?.length) return;
    setUploadMessage("Reading your files…");
    const added: KnowledgeFile[] = [];
    for (const file of Array.from(list)) {
      if (file.size > 8_000_000) { setUploadMessage(`${file.name} is larger than the 8 MB limit.`); continue; }
      try {
        const extracted = await readUploadedFile(file);
        const entry = { id: Date.now() + added.length, name: file.name, size: file.size, addedAt: new Date().toISOString(), text: extracted.text, kind: extracted.kind };
        await storeKnowledgeFile(entry);
        added.push(entry);
      } catch { setUploadMessage(`I couldn’t read ${file.name}. Try exporting it as a Word or text file.`); }
    }
    if (added.length) {
      setKnowledgeFiles((current) => [...added, ...current]);
      setUploadMessage(`${added.length} ${added.length === 1 ? "file is" : "files are"} ready to use.`);
    }
  }
  async function deleteKnowledgeFile(id: number) {
    await eraseKnowledgeFile(id);
    setKnowledgeFiles((current) => current.filter((file) => file.id !== id));
  }
  if (active === "goals") return <Page subtitle={subtitle}>{data.goals.length ? <div className="goal-plans">{data.goals.map((goal) => <article className="goal-plan" key={goal.id}><CardActions onEdit={() => edit("goal", goal)} onDelete={() => remove("goal", goal.id)}/><div className="goal-plan-head"><span className="goal-icon" style={{ background: goal.color }}>◎</span><div><span className="eyebrow">ACTIVE GOAL</span><h2>{goal.title}</h2><p>{goal.detail}</p></div><div className="goal-percent"><strong>{goal.progress}%</strong><span>complete</span></div></div><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div><GoalSteps goal={goal} setData={setData}/></article>)}</div> : <Empty label="You haven't added any goals." action="Add your first goal" onClick={add}/>}</Page>;
  if (active === "projects") return <Page subtitle={subtitle}>{data.projects.length ? <div className="detail-cards">{data.projects.map((project) => <article className="big-card" key={project.id}><CardActions onEdit={() => edit("project", project)} onDelete={() => remove("project", project.id)}/><span className="eyebrow">{project.category || "PROJECT"}</span><h2>{project.title}</h2><p><b>Next:</b> {project.next}</p><div className="big-number">{project.progress}%</div><div className="progress"><i style={{ width: `${project.progress}%` }}/></div><small className="status-pill">{project.status}</small></article>)}</div> : <Empty label="You haven't added any projects." action="Add your first project" onClick={add}/>}</Page>;
  if (active === "habits") return <Page subtitle={subtitle}>{data.habits.length ? <section className="detail-panel"><div className="experiment-head"><div><span className="eyebrow">THIS WEEK</span><h2>Your consistency, day by day</h2></div><span>Tap a day to check in</span></div>{data.habits.map((habit) => <div className="habit-row" key={habit.id}><div><strong>{habit.name}</strong><small>{habit.week.filter(Boolean).length} of 7 days · {habit.streak} day streak</small></div><div className="habit-controls"><div className="habit-week">{habit.week.map((done, i) => <button className={done ? "kept" : ""} key={i} title={["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]} onClick={() => setData((d) => ({ ...d, habits: d.habits.map((h) => h.id === habit.id ? { ...h, week: h.week.map((x, n) => n === i ? !x : x) } : h) }))}>{done ? "✓" : ["M","T","W","T","F","S","S"][i]}</button>)}</div><span className="item-actions"><button onClick={() => edit("habit", habit)}>Edit</button><button onClick={() => remove("habit", habit.id)}>×</button></span></div></div>)}</section> : <Empty label="No habits to check in yet." action="Add your first habit" onClick={add}/>}</Page>;
  if (active === "notes") {
    const shown = data.notes.filter((note) => `${note.title} ${note.tag} ${note.excerpt}`.toLowerCase().includes(noteSearch.toLowerCase()));
    const shownFiles = knowledgeFiles.filter((file) => `${file.name} ${file.kind} ${file.text}`.toLowerCase().includes(noteSearch.toLowerCase()));
    return <Page subtitle={subtitle}>
      <section className="knowledge-hero"><div><span className="eyebrow">YOUR KNOWLEDGE LIBRARY</span><h2>Bring your documents into one place.</h2><p>Upload Word documents, text files, Markdown, rich text, or a Google Doc shortcut. For full Google Doc analysis, download it as a Word file first.</p></div><label className="upload-button">↑ Upload files<input type="file" multiple accept=".docx,.txt,.md,.rtf,.gdoc" onChange={(event) => uploadFiles(event.target.files)}/></label></section>
      {uploadMessage && <div className="upload-message">{uploadMessage}</div>}
      <section className="knowledge-focus"><div className="ai-orb">✦</div><div><span className="eyebrow">TODAY’S SUGGESTED FOCUS</span><h3>{focusFromKnowledge(knowledgeFiles, data.notes, data.tasks)}</h3><p>This suggestion uses your unfinished tasks, notes, and readable document text.</p></div></section>
      <div className="knowledge-search">⌕<input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search your notes and uploaded documents…"/></div>
      {shownFiles.length > 0 && <section className="file-library"><div className="library-heading"><h2>Files</h2><span>{shownFiles.length} saved</span></div>{shownFiles.map((file) => <article className="file-row" key={file.id}><span className="file-icon">{file.name.split(".").pop()?.toUpperCase().slice(0, 4)}</span><div><strong>{file.name}</strong><small>{file.kind} · {(file.size / 1024).toFixed(0)} KB · Added {new Date(file.addedAt).toLocaleDateString()}</small><p>{file.text.slice(0, 150) || "Saved as a reference"}</p></div><button onClick={() => deleteKnowledgeFile(file.id)}>Remove</button></article>)}</section>}
      <div className="library-heading notes-heading"><h2>Your notes</h2><button onClick={add}>＋ Add a note</button></div>
      {shown.length ? (
        <div className="detail-cards">{shown.map((note) => <article className="big-card note-card" key={note.id}><CardActions onEdit={() => edit("note", note)} onDelete={() => remove("note", note.id)}/><span className="eyebrow">{note.tag || "NOTE"}</span><h2>{note.title}</h2><p>{note.excerpt}</p></article>)}</div>
      ) : (
        <Empty label={noteSearch ? "No notes match that search." : "Your written notes are empty."} action="Add a note" onClick={add}/>
      )}
    </Page>;
  }
  if (active === "calendar") {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = new Date(year, month, 1 - first.getDay());
    const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
    const today = todayInput();
    return <Page subtitle={subtitle}><section className="apple-calendar"><header><div className="calendar-nav"><button onClick={() => setCalendarCursor(new Date(year, month - 1, 1))}>‹</button><button onClick={() => setCalendarCursor(new Date())}>Today</button><button onClick={() => setCalendarCursor(new Date(year, month + 1, 1))}>›</button></div><h2>{calendarCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2><button className="calendar-add" onClick={add}>＋ Add event</button></header><div className="weekday-row">{["SUN","MON","TUE","WED","THU","FRI","SAT"].map((day) => <span key={day}>{day}</span>)}</div><div className="month-grid">{days.map((day) => {
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const events = data.events.filter((event) => event.date === date);
      return <div key={date} className={`${day.getMonth() !== month ? "outside " : ""}${date === today ? "today" : ""}`}><span className="day-number">{day.getDate()}</span><div className="day-events">{events.map((event) => <button key={event.id} className="calendar-pill" onClick={() => edit("event", event)} title={`${event.time || "All day"} · ${event.title}`}><i/>{event.time && <small>{event.time}</small>}{event.title}</button>)}</div></div>;
    })}</div></section></Page>;
  }
  const insights = thoughtInsights(data.thoughts);
  return <Page subtitle={subtitle}>
    <section className="thought-hero"><div><span className="eyebrow">YOUR INNER TIMELINE</span><h2>What stayed with you today?</h2><p>A lesson, a quote, or something you simply need to release. Every entry becomes part of the story your dashboard can reflect back to you.</p></div><button onClick={add}>＋ Write today’s thought</button></section>
    <div className="insight-grid"><article><span>Entries saved</span><strong>{data.thoughts.length}</strong><small>Your personal history</small></article><article><span>This month</span><strong>{insights.thisMonth}</strong><small>Moments captured</small></article><article><span>Reflection streak</span><strong>{insights.streak}</strong><small>{insights.streak === 1 ? "day" : "days"} in a row</small></article></div>
    <section className="thought-insight"><span className="ai-orb">✦</span><div><span className="eyebrow">WHAT YOUR WORDS ARE SHOWING</span><h3>{data.thoughts.length < 3 ? "Your patterns will grow clearer as you write." : "A few themes keep returning."}</h3><p>{insights.themes.length ? `Your recent reflections are circling around ${insights.themes.join(", ")}. These themes can help you see what has been taking up emotional space and where you may be growing.` : "Add honest entries in your own words. Over time, Life AI will surface recurring themes and show how your perspective is changing."}</p></div></section>
    {data.thoughts.length ? (
      <section className="thought-timeline">{[...data.thoughts].sort((a,b) => `${b.date}${b.id}`.localeCompare(`${a.date}${a.id}`)).map((thought) => <article className="thought-entry" key={thought.id}><div className="thought-date"><strong>{new Date(`${thought.date}T12:00:00`).toLocaleDateString("en-US", { day: "numeric" })}</strong><span>{new Date(`${thought.date}T12:00:00`).toLocaleDateString("en-US", { month: "short" })}</span></div><div><span className="thought-type">{thought.type}</span><blockquote>“{thought.text}”</blockquote></div><span className="item-actions"><button onClick={() => edit("thought", thought)}>Edit</button><button onClick={() => remove("thought", thought.id)}>×</button></span></article>)}</section>
    ) : (
      <Empty label="This is a judgment-free space for whatever is on your mind." action="Write your first thought" onClick={add}/>
    )}
  </Page>;
}

function GoalSteps({ goal, setData }: { goal: Goal; setData: React.Dispatch<React.SetStateAction<DashboardState>> }) {
  const [newStep, setNewStep] = useState("");
  const steps = goal.steps ?? [];
  function updateSteps(nextSteps: GoalStep[]) {
    const progress = nextSteps.length ? Math.round(nextSteps.filter((step) => step.done).length / nextSteps.length * 100) : goal.progress;
    setData((data) => ({ ...data, goals: data.goals.map((item) => item.id === goal.id ? { ...item, steps: nextSteps, progress } : item) }));
  }
  function addStep(event: FormEvent) {
    event.preventDefault();
    if (!newStep.trim()) return;
    updateSteps([...steps, { id: Date.now(), title: newStep.trim(), done: false }]);
    setNewStep("");
  }
  return <details className="goal-steps" open><summary><span>Steps to achieve this goal</span><b>{steps.filter((step) => step.done).length} of {steps.length} complete</b></summary><div className="step-list">{steps.length ? steps.map((step) => <div className={step.done ? "goal-step done" : "goal-step"} key={step.id}><label><input type="checkbox" checked={step.done} onChange={() => updateSteps(steps.map((item) => item.id === step.id ? { ...item, done: !item.done } : item))}/><span>✓</span><strong>{step.title}</strong></label><button onClick={() => updateSteps(steps.filter((item) => item.id !== step.id))} aria-label={`Remove ${step.title}`}>×</button></div>) : <p className="no-steps">Break your goal into small, specific actions you can check off.</p>}</div><form className="add-step-form" onSubmit={addStep}><input value={newStep} onChange={(event) => setNewStep(event.target.value)} placeholder="Add the next step…"/><button>＋ Add step</button></form></details>;
}

function Page({ subtitle, children }: { subtitle: string; children: React.ReactNode }) { return <div className="detail-page"><p className="page-intro">{subtitle}</p>{children}</div>; }

function Editor({ editor, onClose, onSave }: { editor: { kind: Kind; item?: Editable }; onClose: () => void; onSave: (kind: Kind, values: Record<string, string>, id?: number) => void }) {
  const initial = useMemo(() => {
    const item = editor.item as unknown as Record<string, unknown> | undefined;
    const defaults: Record<Kind, Record<string, string>> = {
      task: { title: "", meta: "Today · Personal", tag: "Focus" }, goal: { title: "", detail: "", progress: "0", color: colorOptions[0], steps: "" },
      project: { title: "", category: "Personal", next: "", status: "In progress", progress: "0", color: colorOptions[0] }, habit: { name: "", streak: "0" },
      note: { title: "", tag: "Personal", excerpt: "" }, event: { title: "", date: todayInput(), time: "", category: "Personal" }, thought: { text: "", date: todayInput(), type: "Lesson" },
    };
    const values = Object.fromEntries(Object.entries(defaults[editor.kind]).map(([key, value]) => [key, item?.[key] === undefined ? value : String(item[key])]));
    if (editor.kind === "goal" && editor.item) values.steps = ((editor.item as Goal).steps ?? []).map((step) => step.title).join("\n");
    return values;
  }, [editor]);
  const [values, setValues] = useState(initial);
  const change = (key: string, value: string) => setValues((v) => ({ ...v, [key]: value }));
  const label = editor.item ? `Edit ${editor.kind}` : `Add ${editor.kind}`;
  function submit(e: FormEvent) { e.preventDefault(); onSave(editor.kind, values, editor.item?.id); }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="capture-modal editor-modal" onSubmit={submit} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={onClose}>×</button><span className="eyebrow">LIVE UPDATE</span><h2>{label}</h2><div className="form-grid">
    {editor.kind === "task" && <><Field label="Task" value={values.title} onChange={(v) => change("title", v)} required/><Field label="When / area" value={values.meta} onChange={(v) => change("meta", v)}/><Field label="Tag" value={values.tag} onChange={(v) => change("tag", v)}/></>}
    {editor.kind === "goal" && <><Field label="Goal" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Details" value={values.detail} onChange={(v) => change("detail", v)} wide/><Field label="Steps to achieve it (one step per line)" value={values.steps} onChange={(v) => change("steps", v)} wide multiline/><Range label="Progress" value={values.progress} onChange={(v) => change("progress", v)}/><Color value={values.color} onChange={(v) => change("color", v)}/></>}
    {editor.kind === "project" && <><Field label="Project" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Category" value={values.category} onChange={(v) => change("category", v)}/><Field label="Next action" value={values.next} onChange={(v) => change("next", v)} wide/><Select label="Status" value={values.status} options={["In progress","On track","Exploring","Paused","Complete"]} onChange={(v) => change("status", v)}/><Range label="Progress" value={values.progress} onChange={(v) => change("progress", v)}/></>}
    {editor.kind === "habit" && <><Field label="Habit" value={values.name} onChange={(v) => change("name", v)} required/><Field label="Current streak" value={values.streak} onChange={(v) => change("streak", v)} type="number"/></>}
    {editor.kind === "note" && <><Field label="Title" value={values.title} onChange={(v) => change("title", v)} required/><Field label="Tag" value={values.tag} onChange={(v) => change("tag", v)}/><Field label="Note" value={values.excerpt} onChange={(v) => change("excerpt", v)} wide multiline/></>}
    {editor.kind === "event" && <><Field label="Event" value={values.title} onChange={(v) => change("title", v)} required wide/><Field label="Date" value={values.date} onChange={(v) => change("date", v)} type="date" required/><Field label="Time" value={values.time} onChange={(v) => change("time", v)} type="time"/><Field label="Category" value={values.category} onChange={(v) => change("category", v)}/></>}
    {editor.kind === "thought" && <><Select label="What kind of entry is this?" value={values.type} options={["Lesson","Quote","On my mind"]} onChange={(v) => change("type", v)}/><Field label="Date" value={values.date} onChange={(v) => change("date", v)} type="date" required/><Field label="Write it in your own words" value={values.text} onChange={(v) => change("text", v)} required wide multiline/></>}
  </div><div className="modal-footer"><span>Changes save to this browser</span><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit">Save changes</button></div></form></div>;
}
function Field({ label, value, onChange, required, wide, multiline, type = "text" }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; wide?: boolean; multiline?: boolean; type?: string }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span>{multiline ? <textarea value={value} onChange={(e) => onChange(e.target.value)} required={required}/> : <input type={type} min={type === "number" ? "0" : undefined} value={value} onChange={(e) => onChange(e.target.value)} required={required}/>}</label>; }
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((x) => <option key={x}>{x}</option>)}</select></label>; }
function Range({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) { return <label className="field range-field"><span>{label}: <b>{value}%</b></span><input type="range" min="0" max="100" value={value} onChange={(e) => onChange(e.target.value)}/></label>; }
function Color({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <label className="field"><span>Color</span><div className="color-options">{colorOptions.map((color) => <button type="button" key={color} className={value === color ? "selected" : ""} style={{ background: color }} onClick={() => onChange(color)} aria-label={`Choose ${color}`}/>)}</div></label>; }
