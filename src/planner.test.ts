import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateKey,
  overlaps,
  recommend,
  seedEvents,
  validEvent,
  weekStart,
} from "./planner.ts";
import type { Settings, StudyEvent } from "./planner.ts";
const settings: Settings = {
  name: "테스트",
  weeklyGoal: 20,
  preferredStart: 9,
  preferredEnd: 18,
};
const event: StudyEvent = {
  id: "test",
  title: "학습",
  subject: "영어",
  date: "2026-09-21",
  start: 540,
  duration: 60,
  completed: false,
};
test("월요일 기준 주간 계산은 일요일과 연도를 넘어도 정확하다", () => {
  assert.equal(
    dateKey(weekStart(new Date("2026-09-20T10:00:00"))),
    "2026-09-14",
  );
  assert.equal(
    dateKey(weekStart(new Date("2027-01-01T10:00:00"))),
    "2026-12-28",
  );
  assert.equal(
    dateKey(addDays(new Date("2026-12-31T10:00:00"), 1)),
    "2027-01-01",
  );
});
test("서로 붙어 있는 일정은 허용하고 겹치는 일정만 감지한다", () => {
  assert.equal(overlaps(event, { ...event, start: 600 }), false);
  assert.equal(overlaps(event, { ...event, start: 570 }), true);
  assert.equal(overlaps(event, { ...event, date: "2026-09-22" }), false);
});
test("추천은 이미 지난 시간과 기존 일정, 선호 시간 밖을 제외한다", () => {
  const now = new Date("2026-09-21T10:15:00");
  const busy = { ...event, start: 660, duration: 120 };
  const result = recommend([busy], settings, now);
  assert.equal(result.length, 2);
  for (const r of result) {
    assert.ok(r.start >= 540 && r.start + r.duration <= 1080);
    assert.equal(overlaps(r, busy), false);
    assert.ok(r.date > "2026-09-21" || r.start > 615);
  }
});
test("집중도 높은 학습 시간대를 우선 추천한다", () => {
  const history: StudyEvent[] = [
    { ...event, date: "2026-09-18", start: 540, completed: true, focus: 2 },
    {
      ...event,
      id: "high",
      date: "2026-09-19",
      start: 900,
      completed: true,
      focus: 5,
    },
  ];
  const result = recommend(history, settings, new Date("2026-09-21T08:00:00"));
  assert.equal(result[0].average, 5);
  assert.equal(result[0].samples, 1);
  assert.ok(result[0].start >= 840 && result[0].start <= 960);
});
test("기록이 없으면 집중도 통계를 만들어내지 않는다", () => {
  const result = recommend([], settings, new Date("2026-09-21T08:00:00"));
  assert.equal(result[0].average, null);
  assert.equal(result[0].samples, 0);
  assert.ok(result[0].reason.includes("충분하지"));
});
test("일주일의 선호 시간이 모두 차면 추천이 없다", () => {
  const now = new Date("2026-09-21T08:00:00");
  const busy = Array.from({ length: 7 }, (_, i) => ({
    ...event,
    id: `busy-${i}`,
    date: dateKey(addDays(now, i)),
    duration: 540,
  }));
  assert.deepEqual(recommend(busy, settings, now), []);
});
test("생성된 샘플은 유효하고 동일 날짜에 겹치지 않는다", () => {
  const data = seedEvents(new Date("2026-09-20T12:00:00"));
  assert.ok(data.every(validEvent));
  for (let i = 0; i < data.length; i++)
    for (let j = i + 1; j < data.length; j++)
      assert.equal(overlaps(data[i], data[j]), false);
});
test("손상된 저장 데이터는 걸러낸다", () => {
  assert.equal(validEvent(null), false);
  assert.equal(validEvent({ ...event, duration: -1 }), false);
  assert.equal(validEvent({ ...event, focus: 7 }), false);
  assert.equal(validEvent({ ...event, subject: "unknown" }), false);
  assert.equal(validEvent(event), true);
});
