// evidence.mjs — Tra cứu bằng chứng thật (PubMed E-utilities, Europe PMC, ClinicalTrials.gov, Crossref).
// Port từ grand-rounds/evidence-research/pubmed.py và evidence-audit/verify_refs.py (MIT, Trần Quang Hưng).
// Nguyên tắc: PMID/DOI/NCT chỉ đến từ lượt tra cứu chạy trong phiên, không bao giờ từ trí nhớ của AI.

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
const TOOL = "&tool=medslide-vi-studio&email=medslide@huynhanhthuan.com";

async function getText(url, timeoutMs = 30000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { "User-Agent": "MedSlide-VI-Studio/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} từ ${new URL(url).host}`);
  return res.text();
}
async function getJson(url, timeoutMs) { return JSON.parse(await getText(url, timeoutMs)); }

function makeId(firstAuthor, year, used = new Set()) {
  const base = (String(firstAuthor || "ref").split(/\s+/)[0] || "ref")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "") + (year || "");
  let id = base || "ref", n = 1;
  while (used.has(id)) id = base + String.fromCharCode(97 + n++);
  used.add(id);
  return id;
}

function decodeXml(s) {
  return String(s || "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export async function pubmedSearch(query, { retmax = 12, sort = "relevance", minYear = "" } = {}) {
  let term = String(query || "").trim();
  if (!term) throw new Error("Chưa có câu truy vấn PubMed.");
  if (minYear) term += ` AND ${minYear}:3000[dp]`;
  const s = await getJson(`${EUTILS}esearch.fcgi?db=pubmed&retmode=json&retmax=${retmax}&sort=${sort}&term=${encodeURIComponent(term)}${TOOL}`);
  const ids = s?.esearchresult?.idlist || [];
  const count = +(s?.esearchresult?.count || 0);
  if (!ids.length) return { count, items: [] };
  const items = await pubmedRecords(ids);
  return { count, items, query: term, searchedAt: new Date().toISOString() };
}

export async function pubmedRecords(pmids) {
  const ids = [...new Set((pmids || []).map((x) => String(x).replace(/\D/g, "")).filter(Boolean))];
  if (!ids.length) return [];
  const sum = await getJson(`${EUTILS}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}${TOOL}`);
  const abs = await abstracts(ids).catch(() => ({}));
  const used = new Set();
  return ids.map((id) => sum?.result?.[id]).filter(Boolean).map((r) => {
    const authors = (r.authors || []).filter((a) => a.authtype === "Author").map((a) => a.name);
    const doi = (r.articleids || []).find((a) => a.idtype === "doi")?.value || "";
    const pmc = (r.articleids || []).find((a) => a.idtype === "pmc")?.value || "";
    const year = String(r.pubdate || r.epubdate || "").slice(0, 4);
    return {
      id: makeId(authors[0], year, used),
      pmid: r.uid, doi, pmcid: pmc, title: decodeXml(r.title).replace(/\.$/, ""),
      authors, journal: r.source || "", year, volume: r.volume || "", issue: r.issue || "", pages: r.pages || "",
      pubtypes: r.pubtype || [], abstract: abs[r.uid] || "",
      retrieved_with: "PubMed E-utilities", verified: true, access: abs[r.uid] ? "abstract" : "metadata",
    };
  });
}

async function abstracts(ids) {
  const xml = await getText(`${EUTILS}efetch.fcgi?db=pubmed&rettype=abstract&retmode=xml&id=${ids.join(",")}${TOOL}`, 45000);
  const out = {};
  for (const art of xml.split(/<PubmedArticle>/).slice(1)) {
    const pmid = (/<PMID[^>]*>(\d+)<\/PMID>/.exec(art) || [])[1];
    if (!pmid) continue;
    const parts = [];
    const re = /<AbstractText([^>]*)>([\s\S]*?)<\/AbstractText>/g;
    let m;
    while ((m = re.exec(art))) {
      const label = (/Label="([^"]+)"/.exec(m[1]) || [])[1];
      parts.push((label ? label + ": " : "") + decodeXml(m[2]));
    }
    out[pmid] = parts.join("\n");
  }
  return out;
}

export async function europePmcFullText(pmcid) {
  const id = String(pmcid || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^PMC\d+$/.test(id)) throw new Error("Cần mã PMCID dạng PMC123456.");
  const xml = await getText(`https://www.ebi.ac.uk/europepmc/webservices/rest/${id}/fullTextXML`, 60000);
  return decodeXml(xml.replace(/<ref-list[\s\S]*?<\/ref-list>/g, "").replace(/<\/(p|title|sec)>/g, "\n")).slice(0, 120000);
}

export async function clinicalTrial(nct) {
  const id = String(nct || "").toUpperCase().trim();
  if (!/^NCT\d{8}$/.test(id)) throw new Error("Mã NCT không hợp lệ (NCT + 8 chữ số).");
  const d = await getJson(`https://clinicaltrials.gov/api/v2/studies/${id}`);
  const p = d.protocolSection || {};
  return {
    nct: id,
    title: p.identificationModule?.officialTitle || p.identificationModule?.briefTitle || "",
    status: p.statusModule?.overallStatus || "",
    phase: (p.designModule?.phases || []).join(", "),
    enrollment: p.designModule?.enrollmentInfo?.count || "",
    arms: (p.armsInterventionsModule?.armGroups || []).map((a) => ({ label: a.label, type: a.type, description: a.description })),
    primary: (p.outcomesModule?.primaryOutcomes || []).map((o) => `${o.measure} (${o.timeFrame || ""})`),
    secondary: (p.outcomesModule?.secondaryOutcomes || []).slice(0, 8).map((o) => `${o.measure} (${o.timeFrame || ""})`),
    eligibility: (p.eligibilityModule?.eligibilityCriteria || "").slice(0, 3000),
    retrieved_with: "ClinicalTrials.gov API v2",
  };
}

export async function crossref(doi) {
  const d = String(doi || "").replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim();
  const m = (await getJson(`https://api.crossref.org/works/${encodeURIComponent(d)}`)).message;
  return {
    doi: m.DOI, title: decodeXml((m.title || [""])[0]),
    authors: (m.author || []).map((a) => [a.family, (a.given || "").split(/[\s-]+/).map((x) => x[0]).join("")].filter(Boolean).join(" ")),
    journal: (m["short-container-title"] || m["container-title"] || [""])[0],
    year: String((m.issued?.["date-parts"]?.[0] || [""])[0] || ""),
    volume: m.volume || "", issue: m.issue || "", pages: m.page || "",
    retrieved_with: "Crossref", verified: true,
  };
}

// ---------- xác minh tài liệu tham khảo (verify_refs) ----------
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const surname = (a) => norm(String(a || "").split(/[\s,]+/)[0]);

function compare(rec, found) {
  const issues = [];
  const t1 = norm(rec.title), t2 = norm(found.title);
  if (t1 && t2 && !(t1.includes(t2.slice(0, 40)) || t2.includes(t1.slice(0, 40)))) issues.push(`tiêu đề khác bản ghi: "${found.title.slice(0, 90)}"`);
  if (rec.year && found.year && String(rec.year) !== String(found.year)) issues.push(`năm ${rec.year} ≠ ${found.year}`);
  const a1 = surname((rec.authors || [])[0]), a2 = surname((found.authors || [])[0]);
  if (a1 && a2 && a1 !== a2) issues.push(`tác giả đầu ${rec.authors[0]} ≠ ${found.authors[0]}`);
  return issues;
}

export async function verifyReference(rec) {
  try {
    if (rec.pmid) {
      const [found] = await pubmedRecords([rec.pmid]);
      if (!found) return { status: "fail", issues: [`PMID ${rec.pmid} không tồn tại trên PubMed`] };
      const issues = compare(rec, found);
      return { status: issues.length ? "mismatch" : "ok", issues, found };
    }
    if (rec.doi) {
      const found = await crossref(rec.doi);
      const issues = compare(rec, found);
      return { status: issues.length ? "mismatch" : "ok", issues, found };
    }
    if (rec.kind === "user-source") return { status: "ok", issues: [], note: "tài liệu người dùng cung cấp" };
    return { status: "unverifiable", issues: ["không có PMID hoặc DOI để đối chiếu"] };
  } catch (e) {
    return { status: "error", issues: [`không tra được: ${e.message}`] };
  }
}

export function formatVancouver(r) {
  const au = (r.authors || []);
  const authors = au.length > 6 ? au.slice(0, 6).join(", ") + ", et al" : au.join(", ");
  const vol = r.volume ? `;${r.volume}${r.issue ? `(${r.issue})` : ""}${r.pages ? `:${r.pages}` : ""}` : "";
  const ids = [r.pmid ? `PMID: ${r.pmid}` : "", r.doi ? `doi:${r.doi}` : ""].filter(Boolean).join(". ");
  if (r.kind === "user-source") return [r.title, r.note].filter(Boolean).join(". ");
  return [authors, r.title, `${r.journal}${r.year ? ". " + r.year : ""}${vol}`, ids].filter(Boolean).join(". ").replace(/\.\./g, ".") + ".";
}
