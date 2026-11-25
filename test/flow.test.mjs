import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "medslide-"));
process.env.MEDSLIDE_DATA_DIR = tmp;
process.env.HOME = tmp; process.env.USERPROFILE = tmp;
process.env.MEDSLIDE_MOCK_AI = new URL("./mock-ai.mjs", import.meta.url).pathname;
const { startServer } = await import("../server/index.mjs");
const { parseJsonLoose } = await import("../server/pipeline.mjs");
const { auditDeck } = await import("../server/audit.mjs");

test("parseJsonLoose chịu được rác của CLI", () => {
  assert.deepEqual(parseJsonLoose('Ok:\n```json\n{"a":[1,2,],}\n```'), { a: [1, 2] });
  assert.deepEqual(parseJsonLoose('{"a":{"b":"x"'), { a: { b: "x" } });
  assert.deepEqual(parseJsonLoose('text {"s":"có } trong chuỗi"} tail'), { s: "có } trong chuỗi" });
});

test("PHI và slop", async () => {
  const p = { brief: { deckType: "ca-lam-sang" }, evidence: [], sources: [], deck: { claims: [], slides: [
    { id: "a", layout: "bullets", title: "Kết quả", points: ["Bệnh nhân Trần Văn Bình, SĐT 0905 123 456", "Bấm tiếp để xem", "phân tầng theo đái tháo đường 1:1"] }] } };
  const r = await auditDeck(p, { verifyRefs: false });
  const codes = r.findings.map((f) => f.code + ":" + f.problem);
  assert.ok(codes.some((c) => c.startsWith("S17")), "tiêu đề chủ đề");
  assert.ok(codes.some((c) => c.startsWith("S02")), "lời nhắc trên slide");
  assert.ok(codes.some((c) => c.includes("họ tên")), "tên người bệnh");
  assert.ok(codes.some((c) => c.includes("điện thoại")), "số điện thoại");
  assert.ok(!codes.some((c) => c.includes("địa chỉ")), "không báo nhầm 'đái tháo đường'");
});

test("toàn bộ quy trình qua HTTP với AI giả", async () => {
  const { server, url } = await startServer({ port: 0 });
  const post = async (p, b) => { const r = await fetch(url + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b || {}) }); const d = await r.json(); assert.ok(r.ok, d.error); return d; };
  const get = async (p) => (await fetch(url + p)).json();
  const wait = async (t) => { for (;;) { const s = await get(`/api/tasks/${t.id}`); if (s.status === "done") return s.result; if (s.status === "error") throw new Error(s.error); await new Promise((r) => setTimeout(r, 50)); } };
  try {
    await post("/api/config", { engine: "claude" });
    const p = await post("/api/projects", { brief: { topic: "DAPA-HF thử nghiệm", deckType: "journal-club", minutes: 10, presenter: "BS. A" } });
    assert.equal(p.id, "dapa-hf-thu-nghiem");
    await post(`/api/projects/${p.id}/sources`, { paste: "The primary outcome occurred in 16.3% vs 21.2% (HR 0.74).", pasteName: "Tóm tắt" });
    let r = await wait(await post(`/api/projects/${p.id}/grill`));
    assert.equal(r.project.questions.length, 1);
    r = await wait(await post(`/api/projects/${p.id}/plan`));
    assert.equal(r.project.plan.slides.length, 5);
    r = await wait(await post(`/api/projects/${p.id}/build`));
    const deck = r.project.deck;
    assert.equal(deck.slides.length, 5);
    assert.equal(deck.slides[3].series[0].values[0], 16.3, "chuẩn hóa số '16,3'");
    assert.equal(deck.claims[0].slideId, deck.slides[2].id);
    r = await wait(await post(`/api/projects/${p.id}/revise`, { slideId: deck.slides[1].id, instruction: "rút gọn" }));
    assert.equal(r.project.deck.slides[1].title, "Đã sửa theo yêu cầu");
    r = await wait(await post(`/api/projects/${p.id}/audit`, { verifyRefs: false }));
    assert.ok(r.project.audit.findings.some((f) => f.code === "S17"), "bắt tiêu đề 'Kết quả'");
    r = await wait(await post(`/api/projects/${p.id}/review`));
    assert.equal(r.project.review.findings.length, 1);
    const html = await (await fetch(`${url}/api/projects/${p.id}/deck.html`)).text();
    assert.match(html, /Dapagliflozin giảm biến cố suy tim/);
    for (const format of ["pptx", "html", "json"]) {
      const x = await post(`/api/projects/${p.id}/export`, { format });
      assert.ok(fs.statSync(x.file).size > 1000, format);
    }
    const ops = await post(`/api/projects/${p.id}`, { slideOp: { op: "duplicate", id: deck.slides[0].id } });
    assert.equal(ops.deck.slides.length, 6);
  } finally { server.close(); }
});
