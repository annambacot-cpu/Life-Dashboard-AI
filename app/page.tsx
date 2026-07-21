"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Task = { id: number; title: string; meta: string; done: boolean; tag: string };
type Goal = { id: number; title: string; progress: number; detail: string; color: string };
type Project = { id: number; title: string; category: string; progress: number; next: string; status: string; color: string };
type DashboardState = {
  tasks: Task[];
  goals: Goal[];
  projects: Project[];
  habits: { name: string; streak: number; week: boolean[] }[];
  decisions: { title: string; confidence: number; date: string; status: string }[];
  skills: { name: string; score: number; evidence: string }[];
  notes: { title: string; tag: string; excerpt: string }[];
  reflection: string;
};

const initialState: DashboardState = {
  tasks: [
    { id: 1, title: "Tailor resume for medical sales role", meta: "Today · Career", done: false, tag: "High" },
    { id: 2, title: "Review Life Dashboard project plan", meta: "Today · Life Dashboard AI", done: false, tag: "Focus" },
    { id: 3, title: "Read confidence calibration paper", meta: "3:00 PM · Research", done: false, tag: "Deep work" },
    { id: 4, title: "20-minute interview practice", meta: "5:30 PM · Skill building", done: true, tag: "Habit" },
  ],
  goals: [
    { id: 1, title: "Land a sales role", progress: 64, detail: "8 applications · 3 conversations", color: "#28645c" },
    { id: 2, title: "Build Life Dashboard AI", progress: 42, detail: "Dashboard foundation in progress", color: "#de7d4c" },
    { id: 3, title: "Grow AI fluency", progress: 71, detail: "12 learning sessions this month", color: "#7763a8" },
  ],
  projects: [
    { id: 1, title: "Life Dashboard AI", category: "Build", progress: 42, next: "Design data model and daily workflow", status: "In progress", color: "coral" },
    { id: 2, title: "Sales Job Search", category: "Career", progress: 64, next: "Follow up with two hiring managers", status: "On track", color: "sage" },
    { id: 3, title: "Confidence Research", category: "Research", progress: 28, next: "Summarize calibration paper", status: "Exploring", color: "lavender" },
  ],
  habits: [
    { name: "8 hours of sleep", streak: 6, week: [true, true, true, false, true, true, true] },
    { name: "Exercise first", streak: 3, week: [true, false, true, true, false, true, false] },
    { name: "Coffee before 10", streak: 8, week: [true, true, true, true, true, true, true] },
  ],
  decisions: [
    { title: "Focus job search on medical sales", confidence: 78, date: "July 18", status: "Review in 6 weeks" },
    { title: "Build the dashboard as one connected app", confidence: 92, date: "July 14", status: "In progress" },
  ],
  skills: [
    { name: "Sales", score: 72, evidence: "3 mock interviews" },
    { name: "Prompt engineering", score: 81, evidence: "12 experiments" },
    { name: "Public speaking", score: 64, evidence: "2 recorded practices" },
    { name: "Coding", score: 46, evidence: "Life Dashboard build" },
  ],
  notes: [
    { title: "Why confidence and outcomes diverge", tag: "Psychology", excerpt: "Calibration improves when predictions are recorded before outcomes…" },
    { title: "Medical sales company list", tag: "Career", excerpt: "Prioritize companies with strong training programs and field mentorship…" },
    { title: "Prompt patterns worth keeping", tag: "AI", excerpt: "Clear context, a defined role, and an explicit output shape consistently help…" },
  ],
  reflection: "I made the most progress when I started with one clear outcome instead of a long task list.",
};

const navItems = [
  ["overview", "⌂", "Overview"], ["goals", "◎", "Goals"], ["projects", "◇", "Projects"],
  ["habits", "↻", "Habits"], ["calendar", "□", "Calendar"], ["notes", "≡", "Notes & knowledge"],
  ["decisions", "⌘", "Decisions"], ["skills", "△", "Skills"], ["finance", "$", "Finances"],
] as const;

const viewCopy: Record<string, [string, string]> = {
  goals: ["Goals", "Turn the life you want into progress you can see."],
  projects: ["Projects", "Everything active, with the next action already decided."],
  habits: ["Habit experiment lab", "Treat routines like experiments, then learn what changes your days."],
  calendar: ["Calendar", "See the week without losing sight of what matters."],
  notes: ["Notes & knowledge", "Your private, searchable brain for ideas, research, and memories."],
  decisions: ["Decision journal", "Record your reasoning now so future you can learn from it."],
  skills: ["Skill tracker", "Measure growth with evidence, not just intention."],
  finance: ["Finance pulse", "A clear view of where your money goes and what it makes possible."],
};

export default function Home() {
  const [data, setData] = useState(initialState);
  const [active, setActive] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capture, setCapture] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("Based on your priorities, start with the sales resume. It has the closest deadline and directly supports your top goal.");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("life-dashboard-ai");
      if (saved) setData(JSON.parse(saved));
    } catch {
      // Keep the built-in starter data if this browser blocks local storage.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem("life-dashboard-ai", JSON.stringify(data)); } catch { /* keep the session usable */ }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [data, loaded]);

  const todayDone = data.tasks.filter((task) => task.done).length;
  const weeklyScore = Math.round((data.goals.reduce((sum, goal) => sum + goal.progress, 0) / data.goals.length));
  const dateLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  function askLifeAI(event: FormEvent) {
    event.preventDefault();
    const q = question.toLowerCase();
    if (q.includes("deadline") || q.includes("week")) setAnswer("This week: finish the tailored resume, follow up with two hiring managers, and summarize the confidence paper. The resume is the only item that needs attention today.");
    else if (q.includes("progress") || q.includes("sales")) setAnswer("You’re 64% toward your sales goal: 8 applications and 3 active conversations. Your best next move is targeted follow-up, not more broad applications.");
    else if (q.includes("skill")) setAnswer("Prompt engineering is growing fastest at 81. Coding has the most leverage right now because the Life Dashboard project gives you concrete evidence of progress.");
    else setAnswer("Your highest-leverage next action is “" + (data.tasks.find((task) => !task.done)?.title ?? "plan tomorrow") + ". Protect a 45-minute focus block for it.");
    setQuestion("");
  }

  function saveCapture(event: FormEvent) {
    event.preventDefault();
    if (!capture.trim()) return;
    setData((current) => ({ ...current, tasks: [{ id: Date.now(), title: capture.trim(), meta: "Just added · Inbox", done: false, tag: "New" }, ...current.tasks] }));
    setCapture("");
    setCaptureOpen(false);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActive("overview")} aria-label="Open overview">
          <span className="brand-mark">L</span><span>Life Dashboard<small>AI</small></span>
        </button>
        <nav aria-label="Dashboard sections">
          {navItems.map(([id, icon, label]) => (
            <button key={id} className={active === id ? "nav-item active" : "nav-item"} onClick={() => setActive(id)}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="week-card"><span>Weekly alignment</span><strong>{weeklyScore}%</strong><div className="mini-track"><i style={{ width: `${weeklyScore}%` }} /></div><small>Goals are moving in the right direction</small></div>
          <button className="profile"><span>AB</span><span>Anna<small>Personal workspace</small></span><b>•••</b></button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><span className="eyebrow">{dateLabel}</span><h1>{active === "overview" ? "Good morning, Anna." : viewCopy[active]?.[0]}</h1></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications">◌<i /></button><button className="capture-button" onClick={() => setCaptureOpen(true)}>＋ Quick capture</button></div>
        </header>

        {active === "overview" ? (
          <div className="dashboard-grid">
            <section className="ai-card full">
              <div className="ai-orb">✦</div>
              <div className="ai-copy"><span className="eyebrow">LIFE AI BRIEFING</span><h2>What should I focus on today?</h2><p>{answer}</p>
                <form onSubmit={askLifeAI} className="ask-form"><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about your week, goals, notes, or progress…" aria-label="Ask Life AI"/><button aria-label="Send question">↑</button></form>
              </div>
              <div className="focus-score"><span>FOCUS SCORE</span><strong>82</strong><small>Clear day ahead</small></div>
            </section>

            <section className="panel tasks-panel">
              <PanelHeader eyebrow="TODAY" title="Your focus list" action={`${todayDone}/${data.tasks.length} done`} />
              <div className="task-list">
                {data.tasks.slice(0, 5).map((task) => <label className={task.done ? "task done" : "task"} key={task.id}>
                  <input type="checkbox" checked={task.done} onChange={() => setData((current) => ({ ...current, tasks: current.tasks.map((item) => item.id === task.id ? { ...item, done: !item.done } : item) }))}/>
                  <span className="checkmark">✓</span><span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span><em>{task.tag}</em>
                </label>)}
              </div>
              <button className="text-button" onClick={() => setCaptureOpen(true)}>＋ Add a task</button>
            </section>

            <section className="panel momentum-panel">
              <PanelHeader eyebrow="THIS WEEK" title="Life momentum" action="Last 7 days" />
              <div className="momentum-score"><div className="ring" style={{ "--score": "78%" } as React.CSSProperties}><strong>78</strong><small>overall</small></div><div><span className="trend">↗ 6%</span><h3>You’re building consistency.</h3><p>Career and learning are leading your progress this week.</p></div></div>
              <div className="metric-row"><Metric label="Focus blocks" value="9" note="+2"/><Metric label="Habits kept" value="84%" note="+7%"/><Metric label="Projects moved" value="3" note="steady"/></div>
            </section>

            <section className="panel goals-panel full">
              <PanelHeader eyebrow="ACTIVE GOALS" title="Where you’re headed" action="View all" />
              <div className="goal-grid">{data.goals.map((goal) => <article className="goal-card" key={goal.id}><div className="goal-top"><span className="goal-icon" style={{ background: goal.color }}>◎</span><span>{goal.progress}%</span></div><h3>{goal.title}</h3><p>{goal.detail}</p><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div></article>)}</div>
            </section>

            <section className="panel projects-panel full">
              <PanelHeader eyebrow="PROJECT OS" title="What you’re building" action="Open projects" />
              <div className="project-list">{data.projects.map((project) => <article className="project-row" key={project.id}><span className={`project-symbol ${project.color}`}>◇</span><div className="project-main"><span>{project.category}</span><h3>{project.title}</h3><p><b>Next:</b> {project.next}</p></div><div className="project-progress"><strong>{project.progress}%</strong><div className="progress"><i style={{ width: `${project.progress}%` }}/></div></div><em>{project.status}</em><button aria-label={`Open ${project.title}`} onClick={() => setActive("projects")}>→</button></article>)}</div>
            </section>

            <section className="panel reflection-panel full">
              <div><span className="eyebrow">WEEKLY REFLECTION</span><h2>What did this week teach you?</h2><p>Your reflections become patterns Life AI can use to help you plan better.</p></div>
              <textarea value={data.reflection} onChange={(e) => setData((current) => ({ ...current, reflection: e.target.value }))} aria-label="Weekly reflection" />
            </section>
          </div>
        ) : <DetailView active={active} data={data} setData={setData} subtitle={viewCopy[active]?.[1]} />}
      </main>

      {captureOpen && <div className="modal-backdrop" onMouseDown={() => setCaptureOpen(false)}><form className="capture-modal" onSubmit={saveCapture} onMouseDown={(e) => e.stopPropagation()}><button type="button" className="modal-close" onClick={() => setCaptureOpen(false)}>×</button><span className="eyebrow">QUICK CAPTURE</span><h2>Get it out of your head.</h2><p>Add a task, thought, reminder, or idea to your inbox.</p><textarea autoFocus value={capture} onChange={(e) => setCapture(e.target.value)} placeholder="What’s on your mind?"/><div><span>Saved to Inbox</span><button type="submit">Capture it</button></div></form></div>}
    </div>
  );
}

function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action: string }) {
  return <div className="panel-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button>{action} <span>→</span></button></div>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function DetailView({ active, data, setData, subtitle }: { active: string; data: DashboardState; setData: React.Dispatch<React.SetStateAction<DashboardState>>; subtitle: string }) {
  if (active === "goals") return <div className="detail-page"><p className="page-intro">{subtitle}</p><div className="detail-cards">{data.goals.map((goal) => <article className="big-card" key={goal.id}><span className="eyebrow">ACTIVE GOAL</span><h2>{goal.title}</h2><p>{goal.detail}</p><div className="big-number">{goal.progress}%</div><div className="progress"><i style={{ width: `${goal.progress}%`, background: goal.color }}/></div><button onClick={() => setData((d) => ({...d, goals: d.goals.map((g) => g.id === goal.id ? {...g, progress: Math.min(100, g.progress + 5)} : g)}))}>Log progress +5%</button></article>)}</div></div>;
  if (active === "projects") return <div className="detail-page"><p className="page-intro">{subtitle}</p><div className="kanban">{["In progress", "On track", "Exploring"].map((status) => <section key={status}><h3>{status}<span>{data.projects.filter((p) => p.status === status).length}</span></h3>{data.projects.filter((p) => p.status === status).map((project) => <article key={project.id}><span>{project.category}</span><h2>{project.title}</h2><p>{project.next}</p><div className="progress"><i style={{ width: `${project.progress}%` }}/></div><small>{project.progress}% complete</small></article>)}</section>)}</div></div>;
  if (active === "habits") return <div className="detail-page"><p className="page-intro">{subtitle}</p><section className="detail-panel"><div className="experiment-head"><div><span className="eyebrow">CURRENT EXPERIMENT</span><h2>Does exercise first improve focus?</h2></div><span>Week 3 of 4</span></div>{data.habits.map((habit) => <div className="habit-row" key={habit.name}><div><strong>{habit.name}</strong><small>{habit.streak} day streak</small></div><div className="habit-week">{habit.week.map((done, i) => <i className={done ? "kept" : ""} key={i}>{done ? "✓" : "·"}</i>)}</div></div>)}</section></div>;
  if (active === "decisions") return <div className="detail-page"><p className="page-intro">{subtitle}</p><div className="detail-cards">{data.decisions.map((decision) => <article className="big-card" key={decision.title}><span className="eyebrow">{decision.date}</span><h2>{decision.title}</h2><p>{decision.status}</p><div className="confidence"><strong>{decision.confidence}%</strong><span>confidence at decision time</span></div><button>Review reasoning</button></article>)}</div></div>;
  if (active === "skills") return <div className="detail-page"><p className="page-intro">{subtitle}</p><section className="detail-panel">{data.skills.map((skill) => <div className="skill-row" key={skill.name}><div><strong>{skill.name}</strong><small>{skill.evidence}</small></div><div className="progress"><i style={{ width: `${skill.score}%` }}/></div><b>{skill.score}</b></div>)}</section></div>;
  if (active === "notes") return <div className="detail-page"><p className="page-intro">{subtitle}</p><div className="knowledge-search">⌕<input placeholder="Search every note, paper, memory, and idea…"/></div><div className="detail-cards">{data.notes.map((note) => <article className="big-card note-card" key={note.title}><span className="eyebrow">{note.tag}</span><h2>{note.title}</h2><p>{note.excerpt}</p><button>Open note</button></article>)}</div></div>;
  if (active === "calendar") return <div className="detail-page"><p className="page-intro">{subtitle}</p><section className="detail-panel calendar-week">{["Mon 20", "Tue 21", "Wed 22", "Thu 23", "Fri 24"].map((day, i) => <div key={day} className={i === 1 ? "today-col" : ""}><h3>{day}</h3>{i === 1 && <><span className="event coral">Resume focus block</span><span className="event sage">Interview practice</span></>}{i === 2 && <span className="event lavender">Research notes</span>}{i === 3 && <span className="event sage">Hiring manager follow-up</span>}</div>)}</section></div>;
  return <div className="detail-page"><p className="page-intro">{subtitle}</p><div className="finance-grid"><article><span>Available this month</span><strong>$1,840</strong><small>After planned bills and savings</small></article><article><span>Saved toward goals</span><strong>$620</strong><small>34% of available income</small></article><article><span>Subscriptions</span><strong>$74</strong><small>4 active subscriptions</small></article></div><section className="detail-panel"><PanelHeader eyebrow="MONTHLY FLOW" title="Where your money went" action="July"/><div className="bar-chart">{[["Savings", 78], ["Food", 55], ["Shopping", 38], ["Gas", 26], ["Subscriptions", 18]].map(([label, value]) => <div key={label}><span>{label}</span><i style={{ height: `${value}%` }}><b>{value}%</b></i></div>)}</div></section></div>;
}
