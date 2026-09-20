export type Subject = "영어" | "수학" | "프로그래밍" | "독서";
export type StudyEvent = {
  id: string;
  title: string;
  subject: Subject;
  date: string;
  start: number;
  duration: number;
  completed: boolean;
  focus?: number;
  memo?: string;
  recommended?: boolean;
};
export type Settings = {
  name: string;
  weeklyGoal: number;
  preferredStart: number;
  preferredEnd: number;
};
export const subjects: Subject[] = ["영어", "수학", "프로그래밍", "독서"];
export const subjectClass: Record<Subject, string> = {
  영어: "blue",
  수학: "peach",
  프로그래밍: "sage",
  독서: "purple",
};
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function fromKey(key: string) {
  return new Date(`${key}T00:00:00`);
}
export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}
export function weekStart(date: Date) {
  return addDays(date, -(date.getDay() + 6) % 7);
}
export function timeLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function hoursLabel(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`
    : `${minutes}분`;
}
export function overlaps(
  a: Pick<StudyEvent, "date" | "start" | "duration">,
  b: Pick<StudyEvent, "date" | "start" | "duration">,
) {
  return (
    a.date === b.date &&
    a.start < b.start + b.duration &&
    b.start < a.start + a.duration
  );
}
export function seedEvents(now = new Date()): StudyEvent[] {
  const monday = weekStart(now),
    today = dateKey(now);
  const items: [number, number, number, Subject, string][] = [
    [0, 540, 90, "영어", "영어 리딩 & 단어"],
    [0, 840, 90, "프로그래밍", "React 컴포넌트 실습"],
    [1, 600, 90, "수학", "미적분 개념 정리"],
    [1, 960, 60, "독서", "하루 30페이지 읽기"],
    [2, 540, 60, "영어", "영어 리스닝 연습"],
    [2, 780, 120, "프로그래밍", "나만의 프로젝트 만들기"],
    [3, 600, 90, "수학", "미적분 문제 풀이"],
    [3, 900, 60, "독서", "책 읽고 생각 기록하기"],
    [4, 540, 90, "영어", "주간 영어 복습"],
    [4, 840, 90, "프로그래밍", "알고리즘 문제 풀이"],
    [5, 660, 60, "수학", "오답 노트 정리"],
    [6, 600, 60, "독서", "느긋한 주말 독서"],
    [6, 840, 90, "프로그래밍", "다음 프로젝트 구상"],
  ];
  return items.map(([day, start, duration, subject, title], i) => ({
    id: `sample-${i}`,
    title,
    subject,
    date: dateKey(addDays(monday, day)),
    start,
    duration,
    completed: dateKey(addDays(monday, day)) < today,
    focus:
      dateKey(addDays(monday, day)) < today
        ? [5, 4, 4, 3, 5, 4, 5, 4, 5, 3, 4][i % 11]
        : undefined,
  }));
}
export type Recommendation = {
  date: string;
  start: number;
  duration: number;
  subject: Subject;
  reason: string;
  samples: number;
  average: number | null;
};
export function recommend(
  events: StudyEvent[],
  settings: Settings,
  now = new Date(),
): Recommendation[] {
  const records = events.filter(
    (e) => e.completed && e.focus && e.date <= dateKey(now),
  );
  const candidates: (Recommendation & { score: number })[] = [];
  for (let day = 0; day < 7; day++) {
    const date = dateKey(addDays(now, day));
    for (
      let start = settings.preferredStart * 60;
      start + 60 <= settings.preferredEnd * 60;
      start += 60
    ) {
      if (day === 0 && start <= now.getHours() * 60 + now.getMinutes())
        continue;
      if (events.some((e) => overlaps(e, { date, start, duration: 60 })))
        continue;
      const matching = records.filter((e) => Math.abs(e.start - start) < 90);
      const average = matching.length
        ? matching.reduce((s, e) => s + e.focus!, 0) / matching.length
        : null;
      const ranked = [...subjects].sort(
        (a, b) =>
          events.filter((e) => !e.completed && e.subject === a).length -
          events.filter((e) => !e.completed && e.subject === b).length,
      );
      const subject = matching.length
        ? [...matching].sort((a, b) => b.focus! - a.focus!)[0].subject
        : ranked[0];
      candidates.push({
        date,
        start,
        duration: 60,
        subject,
        average,
        samples: matching.length,
        reason: matching.length
          ? `비슷한 시간대 학습 ${matching.length}회에서 평균 집중도 ${average!.toFixed(1)}/5를 기록했어요.`
          : "아직 기록이 충분하지 않아요. 선호 시간대의 빈 시간부터 시작해 보세요.",
        score: (average ?? 2.8) - day * 0.18 - start / 100000,
      });
    }
  }
  const result: Recommendation[] = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (result.some((r) => r.date === candidate.date)) continue;
    result.push(candidate);
    if (result.length === 2) break;
  }
  return result;
}
export function validEvent(value: unknown): value is StudyEvent {
  if (!value || typeof value !== "object") return false;
  const e = value as StudyEvent;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    subjects.includes(e.subject) &&
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    Number.isFinite(fromKey(e.date).getTime()) &&
    dateKey(fromKey(e.date)) === e.date &&
    Number.isInteger(e.start) &&
    e.start >= 0 &&
    Number.isInteger(e.duration) &&
    e.duration > 0 &&
    e.start + e.duration <= 1440 &&
    typeof e.completed === "boolean" &&
    (e.memo === undefined || typeof e.memo === "string") &&
    (e.focus === undefined ||
      (Number.isInteger(e.focus) && e.focus >= 1 && e.focus <= 5))
  );
}
