import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Coffee,
  Flag,
  Leaf,
  Menu,
  Plus,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import {
  addDays,
  dateKey,
  fromKey,
  hoursLabel,
  overlaps,
  recommend,
  seedEvents,
  subjectClass,
  subjects,
  timeLabel,
  validEvent,
  weekStart,
} from "./planner";
import type { Recommendation, Settings, StudyEvent, Subject } from "./planner";
const STORAGE = "studyspace.study.v1";
const LEGACY_STORAGE = "pln.study.v1";
const DEFAULT: Settings = {
  name: "학습자",
  weeklyGoal: 20,
  preferredStart: 9,
  preferredEnd: 21,
};
function validatedSettings(value: unknown): Settings {
  const s = (
    value && typeof value === "object" ? value : {}
  ) as Partial<Settings>;
  return {
    name:
      typeof s.name === "string" && s.name.trim()
        ? s.name.slice(0, 15)
        : DEFAULT.name,
    weeklyGoal:
      typeof s.weeklyGoal === "number" &&
      Number.isFinite(s.weeklyGoal) &&
      s.weeklyGoal >= 1 &&
      s.weeklyGoal <= 98
        ? s.weeklyGoal
        : DEFAULT.weeklyGoal,
    preferredStart:
      Number.isInteger(s.preferredStart) &&
      Number.isInteger(s.preferredEnd) &&
      s.preferredStart! >= 8 &&
      s.preferredEnd! <= 22 &&
      s.preferredStart! < s.preferredEnd!
        ? s.preferredStart!
        : DEFAULT.preferredStart,
    preferredEnd:
      Number.isInteger(s.preferredStart) &&
      Number.isInteger(s.preferredEnd) &&
      s.preferredStart! >= 8 &&
      s.preferredEnd! <= 22 &&
      s.preferredStart! < s.preferredEnd!
        ? s.preferredEnd!
        : DEFAULT.preferredEnd,
  };
}
function load() {
  try {
    const stored =
      localStorage.getItem(STORAGE) ?? localStorage.getItem(LEGACY_STORAGE);
    const data = JSON.parse(stored || "null");
    if (data && Array.isArray(data.events) && data.events.every(validEvent))
      return {
        events: data.events as StudyEvent[],
        settings: validatedSettings(data.settings),
        demo: Boolean(data.demo),
      };
  } catch {
    /* Recover gracefully from unavailable or old storage. */
  }
  return { events: seedEvents(), settings: DEFAULT, demo: true };
}
const initial = load();
const dayNames = ["월", "화", "수", "목", "금", "토", "일"];
const prettyDate = (key: string) =>
  fromKey(key).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Leaf size={23} />
      </span>
      <span>STUDYSPACE</span>
    </div>
  );
}
function MiniCalendar({
  date,
  onSelect,
}: {
  date: Date;
  onSelect: (d: Date) => void;
}) {
  const [month, setMonth] = useState(
    new Date(date.getFullYear(), date.getMonth(), 1),
  );
  useEffect(
    () => setMonth(new Date(date.getFullYear(), date.getMonth(), 1)),
    [date],
  );
  const start = weekStart(month);
  return (
    <div className="mini-calendar">
      <div className="mini-heading">
        <strong>
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </strong>
        <div>
          <button
            aria-label="미니 달력 이전 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={15} />
          </button>
          <button
            aria-label="미니 달력 다음 달"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <div className="mini-grid">
        {dayNames.map((d) => (
          <span className="mini-weekday" key={d}>
            {d}
          </span>
        ))}
        {Array.from(
          {
            length:
              Math.ceil(
                (((month.getDay() + 6) % 7) +
                  new Date(
                    month.getFullYear(),
                    month.getMonth() + 1,
                    0,
                  ).getDate()) /
                  7,
              ) * 7,
          },
          (_, i) => {
            const d = addDays(start, i);
            return (
              <button
                key={i}
                onClick={() => onSelect(d)}
                className={`${d.getMonth() !== month.getMonth() ? "muted" : ""} ${dateKey(d) === dateKey(date) ? "selected" : ""} ${dateKey(d) === dateKey(new Date()) ? "is-today" : ""}`}
              >
                {d.getDate()}
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}
function App() {
  const [events, setEvents] = useState<StudyEvent[]>(initial.events),
    [settings, setSettings] = useState<Settings>(initial.settings),
    [demo, setDemo] = useState(initial.demo);
  const [page, setPage] = useState("calendar"),
    [date, setDate] = useState(new Date()),
    [view, setView] = useState<"week" | "month">("week"),
    [filters, setFilters] = useState<Subject[]>([...subjects]);
  const [editing, setEditing] = useState<Partial<StudyEvent> | null>(null),
    [settingsOpen, setSettingsOpen] = useState(false),
    [mobileOpen, setMobileOpen] = useState(false),
    [toast, setToast] = useState(""),
    [storageError, setStorageError] = useState(false);
  const today = dateKey(new Date()),
    monday = weekStart(date),
    days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekly = events.filter(
    (e) => e.date >= dateKey(monday) && e.date <= dateKey(addDays(monday, 6)),
  );
  const completed = weekly.filter((e) => e.completed),
    doneMinutes = completed.reduce((sum, e) => sum + e.duration, 0),
    planMinutes = weekly.reduce((sum, e) => sum + e.duration, 0);
  const rated = completed.filter((e) => e.focus),
    average = rated.length
      ? rated.reduce((s, e) => s + e.focus!, 0) / rated.length
      : 0;
  const recommendations = useMemo(
    () => recommend(events, settings),
    [events, settings],
  );
  const todaysEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) => a.start - b.start);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ events, settings, demo }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [events, settings, demo]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(timer);
  }, [toast]);
  function newEvent(day = dateKey(date), start = 540) {
    setEditing({
      date: day,
      start,
      duration: 60,
      subject: "영어",
      completed: false,
    });
  }
  function saveEvent(event: StudyEvent) {
    setEvents((prev) => [...prev.filter((e) => e.id !== event.id), event]);
    setEditing(null);
    setToast(
      event.completed
        ? "학습 기록을 저장했어요. 추천에도 반영됩니다."
        : "캘린더에 일정을 저장했어요.",
    );
  }
  function applyRecommendation(r: Recommendation) {
    const event: StudyEvent = {
      id: crypto.randomUUID(),
      title: `${r.subject} 집중 학습`,
      ...r,
      completed: false,
      recommended: true,
    };
    if (events.some((e) => overlaps(e, event))) {
      setToast("이 시간에 이미 일정이 있어요. 다른 시간을 선택해 주세요.");
      return;
    }
    setEvents((prev) => [...prev, event]);
    setDate(fromKey(r.date));
    setPage("calendar");
    setToast("추천 시간을 캘린더에 추가했어요.");
  }
  function navigate(direction: number) {
    setDate(
      view === "week"
        ? addDays(date, direction * 7)
        : new Date(date.getFullYear(), date.getMonth() + direction, 1),
    );
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ events, settings }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `studyspace-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("학습 데이터를 내보냈어요.");
  }
  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="sidebar-shade"
          aria-label="메뉴 닫기"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <Logo />
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            <strong>나의 스터디 스페이스</strong>
            <span>작은 몰입, 더 나은 내일</span>
          </div>
          <ChevronsUpDown size={14} />
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {[
            { id: "calendar", name: "학습 캘린더", icon: CalendarDays },
            { id: "insights", name: "학습 인사이트", icon: BarChart3 },
            { id: "records", name: "학습 기록", icon: BookOpen },
          ].map(({ id, name, icon: Icon }) => (
            <button
              className={page === id ? "active" : ""}
              key={id}
              onClick={() => {
                setPage(id);
                setMobileOpen(false);
              }}
            >
              <Icon size={19} />
              {name}
              {id === "calendar" && (
                <span className="nav-count">
                  {
                    events.filter((e) => e.date === today && !e.completed)
                      .length
                  }
                </span>
              )}
            </button>
          ))}
        </nav>
        <MiniCalendar
          date={date}
          onSelect={(d) => {
            setDate(d);
            setPage("calendar");
            setMobileOpen(false);
          }}
        />
        <div className="subject-filter">
          <p className="nav-caption">
            나의 학습 과목 <span>{subjects.length}</span>
          </p>
          {subjects.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                checked={filters.includes(s)}
                onChange={() =>
                  setFilters((prev) =>
                    prev.includes(s)
                      ? prev.filter((x) => x !== s)
                      : [...prev, s],
                  )
                }
              />
              <span
                className={`subject-check ${subjectClass[s]} ${filters.includes(s) ? "checked" : ""}`}
              >
                {filters.includes(s) && <Check size={11} />}
              </span>
              {s}
            </label>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="gentle-note">
            <span>
              <Leaf size={17} /> 오늘도, 한 걸음
            </span>
            <p>
              완벽한 계획보다
              <br />
              꾸준한 나의 리듬이 중요해요.
            </p>
          </div>
          <button
            className="settings-link"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 size={17} /> 학습 환경 설정
          </button>
          <div className="profile">
            <div className="avatar">{settings.name.slice(0, 1)}</div>
            <div>
              <strong>{settings.name}님의 공간</strong>
              <span>나만의 성장 기록</span>
            </div>
            <button
              aria-label="프로필 설정"
              onClick={() => setSettingsOpen(true)}
            >
              <ChevronsUpDown size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>나의 스터디 스페이스</span>
            <ChevronRight size={13} />
            <strong>
              {page === "calendar"
                ? "학습 캘린더"
                : page === "insights"
                  ? "학습 인사이트"
                  : "학습 기록"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="saved-status">
              <i />
              {storageError ? "저장 공간 확인 필요" : "이 기기에 저장됨"}
            </span>
            <span className="topbar-divider" />
            <span className="small-avatar">{settings.name.slice(0, 1)}</span>
          </div>
        </header>
        <main>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> MAKE TIME FOR YOURSELF
              </div>
              <h1>
                {page === "calendar"
                  ? "조금씩, 나만의 속도로."
                  : page === "insights"
                    ? "기록에서 발견하는 나의 리듬."
                    : "오늘의 몰입이 쌓이는 곳."}
                <span className="heading-leaf">✳</span>
              </h1>
              <p>
                {page === "calendar"
                  ? "나에게 맞는 학습 리듬을 찾고, 의미 있는 하루를 만들어 보세요."
                  : page === "insights"
                    ? "차곡차곡 쌓인 학습 데이터로 더 나은 다음 시간을 계획해 보세요."
                    : "학습을 마친 뒤 집중도와 메모를 남기면 시간 추천이 더 정교해져요."}
              </p>
            </div>
            <button className="primary add-main" onClick={() => newEvent()}>
              <Plus size={17} /> 학습 일정 추가
            </button>
          </section>
          {demo && (
            <div className="demo-strip">
              <span>
                <Sparkles size={14} /> 샘플 학습 데이터로 둘러보고 있어요.
                나만의 기록을 시작해 보세요.
              </span>
              <button
                onClick={() => {
                  setEvents((prev) =>
                    prev.filter((e) => !e.id.startsWith("sample-")),
                  );
                  setDemo(false);
                  setToast("샘플 데이터를 지웠어요. 첫 일정을 추가해 보세요.");
                }}
              >
                샘플 지우기 <ArrowRight size={13} />
              </button>
            </div>
          )}
          {storageError && (
            <div className="storage-warning">
              브라우저 저장 공간에 접근할 수 없습니다. 창을 닫기 전에 학습
              기록에서 데이터를 내보내 주세요.
            </div>
          )}
          <section className="stats-grid">
            <Stat
              icon={<Clock3 size={18} />}
              label="이번 주 학습 시간"
              value={hoursLabel(doneMinutes)}
              detail={`계획한 ${hoursLabel(planMinutes)} 중`}
              color="sage"
            />
            <Stat
              icon={<Check size={18} />}
              label="완료한 학습"
              value={`${completed.length}`}
              unit={`/ ${weekly.length}개`}
              detail="작은 성취가 쌓이고 있어요"
              color="peach"
            />
            <Stat
              icon={<Target size={18} />}
              label="평균 집중도"
              value={average ? average.toFixed(1) : "—"}
              unit="/ 5"
              detail={
                rated.length
                  ? `${rated.length}개의 집중도 기록 기준`
                  : "첫 집중도를 기록해 보세요"
              }
              color="purple"
            />
            <Stat
              icon={<Flag size={18} />}
              label="주간 목표 달성"
              value={`${Math.round((doneMinutes / (settings.weeklyGoal * 60)) * 100)}%`}
              detail={`목표 ${settings.weeklyGoal}시간 · 나만의 페이스로`}
              color="blue"
            />
          </section>
          <div className="content-layout">
            <div className="primary-content">
              {page === "calendar" ? (
                <section className="calendar-panel">
                  <div className="calendar-toolbar">
                    <div className="calendar-title">
                      <h2>
                        {date.getFullYear()}년 {date.getMonth() + 1}월
                      </h2>
                      <span className="week-caption">
                        {view === "week"
                          ? `${monday.getMonth() + 1}.${monday.getDate()} – ${days[6].getMonth() + 1}.${days[6].getDate()}`
                          : "한 달 한눈에 보기"}
                      </span>
                    </div>
                    <div className="calendar-controls">
                      <button
                        className="today-button"
                        onClick={() => setDate(new Date())}
                      >
                        오늘
                      </button>
                      <div className="arrow-controls">
                        <button
                          aria-label="이전 기간"
                          onClick={() => navigate(-1)}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <button
                          aria-label="다음 기간"
                          onClick={() => navigate(1)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <div className="segmented">
                        <button
                          className={view === "week" ? "selected" : ""}
                          onClick={() => setView("week")}
                        >
                          주
                        </button>
                        <button
                          className={view === "month" ? "selected" : ""}
                          onClick={() => setView("month")}
                        >
                          월
                        </button>
                      </div>
                    </div>
                  </div>
                  {view === "week" ? (
                    <div className="calendar-scroll">
                      <div className="week-calendar">
                        <div className="week-header">
                          <span className="timezone">GMT+9</span>
                          {days.map((d) => (
                            <button
                              key={dateKey(d)}
                              className={`day-heading ${dateKey(d) === today ? "current" : ""}`}
                              onClick={() => newEvent(dateKey(d))}
                            >
                              <span>{dayNames[(d.getDay() + 6) % 7]}</span>
                              <strong>{d.getDate()}</strong>
                              {dateKey(d) === today && <i />}
                            </button>
                          ))}
                        </div>
                        <div className="week-body">
                          <div className="time-labels">
                            {Array.from({ length: 14 }, (_, i) => (
                              <span key={i} style={{ top: i * 58 }}>
                                {String(i + 8).padStart(2, "0")}:00
                              </span>
                            ))}
                          </div>
                          {days.map((d) => {
                            const key = dateKey(d),
                              list = events.filter(
                                (e) =>
                                  e.date === key && filters.includes(e.subject),
                              );
                            return (
                              <div
                                className={`day-column ${key === today ? "current-column" : ""}`}
                                key={key}
                              >
                                {Array.from({ length: 14 }, (_, i) => (
                                  <button
                                    key={i}
                                    className="time-slot"
                                    aria-label={`${prettyDate(key)} ${i + 8}시 일정 추가`}
                                    onClick={() => newEvent(key, (i + 8) * 60)}
                                  />
                                ))}
                                {list
                                  .filter(
                                    (e) => e.start >= 480 && e.start < 1320,
                                  )
                                  .map((e) => (
                                    <button
                                      key={e.id}
                                      className={`calendar-event ${subjectClass[e.subject]} ${e.completed ? "event-complete" : ""} ${e.duration < 60 ? "short-event" : ""}`}
                                      style={{
                                        top: ((e.start - 480) / 60) * 58 + 3,
                                        height:
                                          (Math.min(
                                            e.duration,
                                            1320 - e.start,
                                          ) /
                                            60) *
                                            58 -
                                          6,
                                      }}
                                      onClick={() => setEditing(e)}
                                    >
                                      <span className="event-subject">
                                        {e.subject}
                                        {e.completed ? (
                                          <Check size={11} />
                                        ) : e.recommended ? (
                                          <Sparkles size={11} />
                                        ) : null}
                                      </span>
                                      <strong>{e.title}</strong>
                                      <span className="event-time">
                                        {timeLabel(e.start)} –{" "}
                                        {timeLabel(e.start + e.duration)}
                                      </span>
                                    </button>
                                  ))}
                                {key === today &&
                                  new Date().getHours() >= 8 &&
                                  new Date().getHours() < 22 && (
                                    <div
                                      className="now-line"
                                      style={{
                                        top:
                                          ((new Date().getHours() * 60 +
                                            new Date().getMinutes() -
                                            480) /
                                            60) *
                                          58,
                                      }}
                                    />
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <MonthCalendar
                      date={date}
                      events={events.filter((e) => filters.includes(e.subject))}
                      onEdit={setEditing}
                      onAdd={newEvent}
                    />
                  )}
                  <div className="calendar-footer">
                    <span>
                      <span className="small-dot" /> 빈 시간을 눌러 학습을
                      계획해 보세요
                    </span>
                    <span>
                      {view === "week" ? "08:00 – 22:00" : "나의 한 달"}{" "}
                      <Leaf size={13} />
                    </span>
                  </div>
                </section>
              ) : page === "insights" ? (
                <Insights
                  events={weekly}
                  goal={settings.weeklyGoal}
                  monday={monday}
                />
              ) : (
                <Records
                  events={events}
                  onEdit={setEditing}
                  onExport={exportData}
                />
              )}
              <div className="bottom-note">
                <Leaf size={13} />
                <span>
                  잘하고 있어요. 오늘의 작은 몰입이 내일의 나를 만듭니다.
                </span>
              </div>
            </div>
            <aside className="right-rail">
              <section className="recommendation-panel">
                <div className="rail-title">
                  <span className="sparkle-icon">
                    <Sparkles size={18} />
                  </span>
                  <h2>나에게 맞는 학습 시간</h2>
                </div>
                <span className="ai-label">AI 플래너 · 미리보기</span>
                <p className="rail-description">
                  학습 기록과 비어 있는 시간을 바탕으로
                  <br />
                  다음 몰입 시간을 제안해요.
                </p>
                <div className="recommendation-list">
                  {recommendations.length ? (
                    recommendations.map((r, i) => (
                      <div
                        className="recommendation"
                        key={`${r.date}-${r.start}`}
                      >
                        <div className="recommendation-top">
                          <span>
                            {i === 0 ? "가장 잘 맞는 시간" : "이 시간도 좋아요"}
                          </span>
                          <span
                            className={`subject-pill ${subjectClass[r.subject]}`}
                          >
                            {r.subject}
                          </span>
                        </div>
                        <h3>
                          {timeLabel(r.start)} <span>–</span>{" "}
                          {timeLabel(r.start + r.duration)}
                        </h3>
                        <p className="rec-date">
                          {prettyDate(r.date)} · {r.duration}분 집중
                        </p>
                        <p className="rec-reason">
                          <Sparkles size={13} />
                          {r.reason}
                        </p>
                        <button onClick={() => applyRecommendation(r)}>
                          캘린더에 추가 <Plus size={15} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Coffee size={26} />
                      <p>
                        앞으로 7일의 선호 시간대가 꽉 찼어요.
                        <br />
                        학습 환경에서 시간을 조정해 보세요.
                      </p>
                    </div>
                  )}
                </div>
                <p className="recommendation-footnote">
                  현재는 기록 기반 규칙으로 추천해요.
                </p>
              </section>
              <section className="goal-panel">
                <div className="rail-title">
                  <h2>이번 주, 이만큼 자랐어요</h2>
                  <span>🌱</span>
                </div>
                <div className="goal-number">
                  {(doneMinutes / 60).toFixed(1)}
                  <span> / {settings.weeklyGoal}시간</span>
                  <button
                    aria-label="주간 목표 수정"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings2 size={15} />
                  </button>
                </div>
                <div className="progress-track">
                  <div
                    style={{
                      width: `${Math.min((doneMinutes / (settings.weeklyGoal * 60)) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p>
                  {doneMinutes >= settings.weeklyGoal * 60
                    ? "이번 주 목표 달성! 충분히 뿌듯해해도 좋아요."
                    : `목표까지 ${hoursLabel(Math.max(settings.weeklyGoal * 60 - doneMinutes, 0))}, 차근차근 가요.`}
                </p>
              </section>
              <section className="today-panel">
                <div className="rail-title">
                  <h2>오늘의 학습</h2>
                  <span className="today-count">
                    {todaysEvents.filter((e) => e.completed).length}/
                    {todaysEvents.length}
                  </span>
                </div>
                {todaysEvents.length ? (
                  todaysEvents.map((e) => (
                    <button
                      className="today-item"
                      key={e.id}
                      onClick={() => setEditing(e)}
                    >
                      <span
                        className={`completion-circle ${e.completed ? "done" : ""}`}
                      >
                        {e.completed && <Check size={12} />}
                      </span>
                      <span>
                        <strong className={e.completed ? "crossed" : ""}>
                          {e.title}
                        </strong>
                        <small>
                          {timeLabel(e.start)} · {hoursLabel(e.duration)}
                        </small>
                      </span>
                      <span
                        className={`subject-dot ${subjectClass[e.subject]}`}
                      />
                    </button>
                  ))
                ) : (
                  <div className="today-empty">
                    오늘은 아직 계획이 없어요.
                    <button onClick={() => newEvent(today)}>
                      첫 학습 계획하기 <Plus size={13} />
                    </button>
                  </div>
                )}
              </section>
              <div className="quote-card">
                <Coffee size={20} />
                <p>
                  쉬어가는 시간도
                  <br />
                  계획의 일부니까.
                </p>
                <span>틈틈이, 나를 돌봐주세요.</span>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              STUDYSPACE <span>PLAN YOUR OWN RHYTHM</span>
            </span>
            <span>오늘도 당신의 속도를 응원해요.</span>
          </footer>
        </main>
      </div>
      {editing && (
        <EventModal
          event={editing}
          events={events}
          onClose={() => setEditing(null)}
          onSave={saveEvent}
          onDelete={(id) => {
            setEvents((prev) => prev.filter((e) => e.id !== id));
            setEditing(null);
            setToast("학습 일정을 삭제했어요.");
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={(s) => {
            setSettings(s);
            setSettingsOpen(false);
            setToast("학습 환경을 저장했어요.");
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={15} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
function Stat({
  icon,
  label,
  value,
  unit,
  detail,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{detail}</p>
    </div>
  );
}
function MonthCalendar({
  date,
  events,
  onEdit,
  onAdd,
}: {
  date: Date;
  events: StudyEvent[];
  onEdit: (e: StudyEvent) => void;
  onAdd: (key: string) => void;
}) {
  const start = weekStart(new Date(date.getFullYear(), date.getMonth(), 1));
  return (
    <div className="month-calendar">
      <div className="month-weekdays">
        {dayNames.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-grid">
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i),
            key = dateKey(d);
          return (
            <div
              key={key}
              className={`month-day ${d.getMonth() !== date.getMonth() ? "outside" : ""}`}
            >
              <button
                className={key === dateKey(new Date()) ? "month-today" : ""}
                aria-label={`${prettyDate(key)} 일정 추가`}
                onClick={() => onAdd(key)}
              >
                {d.getDate()}
                <Plus size={12} />
              </button>
              {events
                .filter((e) => e.date === key)
                .sort((a, b) => a.start - b.start)
                .map((e) => (
                  <button
                    className={`month-event ${subjectClass[e.subject]}`}
                    key={e.id}
                    onClick={() => onEdit(e)}
                  >
                    {timeLabel(e.start)} {e.title}
                    {e.completed && " ✓"}
                  </button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,button")?.focus();
    function handle(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button,input,select,textarea,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => !el.hasAttribute("disabled"));
        const first = els[0],
          last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button aria-label="닫기" onClick={onClose}>
            <X size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function EventModal({
  event,
  events,
  onClose,
  onSave,
  onDelete,
}: {
  event: Partial<StudyEvent>;
  events: StudyEvent[];
  onClose: () => void;
  onSave: (event: StudyEvent) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState(event.title || ""),
    [subject, setSubject] = useState<Subject>(event.subject || "영어"),
    [date, setDate] = useState(event.date || dateKey(new Date())),
    [time, setTime] = useState(timeLabel(event.start ?? 540)),
    [duration, setDuration] = useState(event.duration || 60),
    [completed, setCompleted] = useState(event.completed || false),
    [focus, setFocus] = useState(event.focus || 0),
    [memo, setMemo] = useState(event.memo || ""),
    [error, setError] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    const [h, m] = time.split(":").map(Number);
    const item: StudyEvent = {
      id: event.id || crypto.randomUUID(),
      title: title.trim(),
      subject,
      date,
      start: h * 60 + m,
      duration,
      completed,
      focus: completed ? focus : undefined,
      memo,
      recommended: event.recommended,
    };
    if (!title.trim()) return setError("학습 제목을 입력해 주세요.");
    if (item.start < 480 || item.start + duration > 1320)
      return setError(
        "학습 시간은 오전 8시부터 오후 10시 사이로 설정해 주세요.",
      );
    if (completed && !focus)
      return setError("학습을 완료했다면 집중도를 선택해 주세요.");
    if (
      completed &&
      new Date(`${date}T${time}:00`).getTime() + duration * 60000 > Date.now()
    )
      return setError("아직 끝나지 않은 학습은 완료할 수 없어요.");
    if (events.some((e) => e.id !== item.id && overlaps(e, item)))
      return setError(
        "다른 학습 일정과 시간이 겹쳐요. 빈 시간을 선택해 주세요.",
      );
    onSave(item);
  }
  return (
    <Modal
      title={event.id ? "학습 일정 살펴보기" : "새로운 학습 계획"}
      subtitle="나에게 맞는 시간에, 나만의 속도로."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label className="form-field">
          무엇을 공부할까요?
          <input
            placeholder="예: 영어 리딩 & 단어 복습"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={60}
          />
        </label>
        <div className="form-field">
          학습 과목
          <div className="subject-options">
            {subjects.map((s) => (
              <button
                type="button"
                className={`${subjectClass[s]} ${subject === s ? "chosen" : ""}`}
                key={s}
                onClick={() => setSubject(s)}
              >
                {s}
                {subject === s && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>
        <label className="form-field">
          학습 날짜
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <div className="form-row">
          <label className="form-field">
            시작 시간
            <input
              type="time"
              value={time}
              min="08:00"
              max="21:45"
              step="900"
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            학습 시간
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[30, 45, 60, 90, 120, 180].map((m) => (
                <option value={m} key={m}>
                  {hoursLabel(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="complete-toggle">
          <input
            type="checkbox"
            checked={completed}
            onChange={(e) => setCompleted(e.target.checked)}
          />
          <span>이 학습을 완료했어요</span>
          <Check size={16} />
        </label>
        {completed && (
          <div className="focus-field">
            <span>얼마나 집중했나요?</span>
            <div>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  aria-label={`집중도 ${n}점`}
                  aria-pressed={focus === n}
                  className={focus === n ? "selected" : ""}
                  key={n}
                  onClick={() => setFocus(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <small>
              1 잠깐 산만했어요 <span>5 깊이 몰입했어요</span>
            </small>
          </div>
        )}
        <label className="form-field">
          학습 메모 <span className="optional">선택</span>
          <textarea
            placeholder="오늘 배운 것, 다음에 이어갈 내용을 남겨보세요."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {event.id && (
            <button
              type="button"
              className="delete-button"
              onClick={() =>
                confirmDelete ? onDelete(event.id!) : setConfirmDelete(true)
              }
            >
              <Trash2 size={16} />
              {confirmDelete ? "한 번 더 눌러 삭제" : "삭제"}
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary">
            {completed ? "학습 기록 저장" : "일정 저장"}
            <Check size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SettingsModal({
  settings,
  onClose,
  onSave,
}: {
  settings: Settings;
  onClose: () => void;
  onSave: (s: Settings) => void;
}) {
  const [value, setValue] = useState(settings),
    [error, setError] = useState("");
  return (
    <Modal
      title="나의 학습 환경"
      subtitle="목표와 학습하기 좋은 시간을 알려주세요."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.preferredStart >= value.preferredEnd)
            return setError("종료 시간을 시작 시간보다 늦게 설정해 주세요.");
          onSave({ ...value, name: value.name.trim() || "학습자" });
        }}
      >
        <label className="form-field">
          이름
          <input
            value={value.name}
            maxLength={15}
            required
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </label>
        <label className="form-field">
          주간 학습 목표 (시간)
          <input
            type="number"
            value={value.weeklyGoal}
            min="1"
            max="98"
            required
            onChange={(e) =>
              setValue({ ...value, weeklyGoal: Number(e.target.value) })
            }
          />
        </label>
        <div className="form-row">
          <label className="form-field">
            추천 시작 시간
            <select
              value={value.preferredStart}
              onChange={(e) =>
                setValue({ ...value, preferredStart: Number(e.target.value) })
              }
            >
              {Array.from({ length: 14 }, (_, i) => (
                <option value={i + 8} key={i}>
                  {timeLabel((i + 8) * 60)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            추천 종료 시간
            <select
              value={value.preferredEnd}
              onChange={(e) =>
                setValue({ ...value, preferredEnd: Number(e.target.value) })
              }
            >
              {Array.from({ length: 14 }, (_, i) => (
                <option value={i + 9} key={i}>
                  {timeLabel((i + 9) * 60)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="settings-hint">
          <Leaf size={17} /> 데이터는 현재 브라우저에 저장됩니다. 학습 기록
          화면에서 파일로 내보낼 수 있어요.
        </p>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            취소
          </button>
          <button className="primary" type="submit">
            설정 저장
            <Check size={15} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Insights({
  events,
  goal,
  monday,
}: {
  events: StudyEvent[];
  goal: number;
  monday: Date;
}) {
  const done = events.filter((e) => e.completed),
    values = Array.from({ length: 7 }, (_, i) =>
      done
        .filter((e) => e.date === dateKey(addDays(monday, i)))
        .reduce((s, e) => s + e.duration, 0),
    ),
    max = Math.max(180, ...values);
  return (
    <div className="insights">
      <section className="analysis-card">
        <div className="analysis-heading">
          <div>
            <h2>일주일의 학습 리듬</h2>
            <p>
              {prettyDate(dateKey(monday))} –{" "}
              {prettyDate(dateKey(addDays(monday, 6)))}
            </p>
          </div>
          <span className="subject-pill sage">완료한 학습 기준</span>
        </div>
        <div className="bar-chart">
          {values.map((v, i) => (
            <div className="bar-item" key={i}>
              <span>{hoursLabel(v)}</span>
              <div className="bar-track">
                <div style={{ height: `${(v / max) * 100}%` }} />
              </div>
              <strong>{dayNames[i]}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="analysis-card">
        <div className="analysis-heading">
          <div>
            <h2>과목별로 살펴보기</h2>
            <p>시간을 어디에 가장 많이 쓰고 있나요?</p>
          </div>
          <BookOpen size={19} />
        </div>
        {subjects.map((s) => {
          const minutes = done
              .filter((e) => e.subject === s)
              .reduce((sum, e) => sum + e.duration, 0),
            total = done.reduce((sum, e) => sum + e.duration, 0);
          return (
            <div className="subject-analysis" key={s}>
              <div>
                <span className={`subject-dot ${subjectClass[s]}`} />
                <strong>{s}</strong>
                <span>{hoursLabel(minutes)}</span>
              </div>
              <div className="progress-track">
                <div
                  className={subjectClass[s]}
                  style={{ width: `${total ? (minutes / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })}
        <p className="analysis-note">
          <Target size={15} /> 이번 주 목표는 {goal}시간이에요. 기록은 일정을
          열어 완료하면 쌓여요.
        </p>
      </section>
    </div>
  );
}
function Records({
  events,
  onEdit,
  onExport,
}: {
  events: StudyEvent[];
  onEdit: (e: StudyEvent) => void;
  onExport: () => void;
}) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all");
  const list = events
    .filter(
      (e) =>
        (type === "all" || (type === "done" ? e.completed : !e.completed)) &&
        `${e.title} ${e.subject} ${e.memo ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || a.start - b.start);
  return (
    <section className="records-panel">
      <div className="analysis-heading">
        <div>
          <h2>
            차곡차곡 쌓인 기록{" "}
            <span className="record-count">{list.length}</span>
          </h2>
          <p>학습 계획부터 완료한 순간까지 한눈에.</p>
        </div>
        <button className="export-button" onClick={onExport}>
          <ArrowDownToLine size={15} /> 내보내기
        </button>
      </div>
      <div className="record-filters">
        <input
          type="search"
          placeholder="제목, 과목, 메모 검색"
          aria-label="학습 기록 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="완료 상태 필터"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">전체 기록</option>
          <option value="done">학습 완료</option>
          <option value="planned">학습 예정</option>
        </select>
      </div>
      <div className="record-list">
        {list.length ? (
          list.map((e) => (
            <button
              className="record-item"
              key={e.id}
              onClick={() => onEdit(e)}
            >
              <span className={`record-icon ${subjectClass[e.subject]}`}>
                <BookOpen size={18} />
              </span>
              <div>
                <strong>{e.title}</strong>
                <span>
                  {prettyDate(e.date)} · {timeLabel(e.start)} ·{" "}
                  {hoursLabel(e.duration)}
                </span>
                {e.memo && <p>{e.memo}</p>}
              </div>
              <span
                className={`record-status ${e.completed ? "is-complete" : ""}`}
              >
                {e.completed ? `완료 · 집중도 ${e.focus ?? "—"}/5` : "예정"}
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))
        ) : (
          <div className="empty-state">
            <BookOpen size={30} />
            <h3>아직 표시할 기록이 없어요</h3>
            <p>새 학습 일정을 추가하거나 검색 조건을 바꿔보세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
export default App;
