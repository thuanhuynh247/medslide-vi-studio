// themes.mjs — 5 phong cách y khoa. Lấy tinh thần "preset có cá tính, không slop" của frontend-slides,
// bảng màu lâm sàng của grand-rounds, font Windows đủ dấu tiếng Việt của 2anh-studio (Segoe UI, Calibri, Cambria, Arial).
export const THEMES = {
  "lam-sang": {
    name: "Lâm sàng", desc: "Nền trắng, xanh teal — mặc định cho grand rounds, journal club",
    bg: "#FFFFFF", ink: "#1B2430", ink2: "#3C4654", muted: "#66707C", line: "#D9DDE2",
    primary: "#0F5E7A", primaryL: "#E6F0F4", accent: "#B4462E",
    int: "#C8372D", intL: "#FBEAE8", ctl: "#56677F", ctlL: "#EEF1F5",
    font: "'Segoe UI', Arial, sans-serif", head: "'Segoe UI', Arial, sans-serif", pptFont: "Segoe UI", pptHead: "Segoe UI Semibold",
  },
  "hoi-nghi": {
    name: "Hội nghị tối", desc: "Nền xanh đêm, tương phản cao — hội trường lớn, máy chiếu mạnh",
    bg: "#0F1B2A", ink: "#F2F5F9", ink2: "#C9D3DF", muted: "#8E9CAE", line: "#2B3C52",
    primary: "#4FC3D9", primaryL: "#16324A", accent: "#F2A93B",
    int: "#F2A93B", intL: "#3A2E17", ctl: "#8EA4BF", ctlL: "#1D2C40",
    font: "'Segoe UI', Arial, sans-serif", head: "'Segoe UI', Arial, sans-serif", pptFont: "Segoe UI", pptHead: "Segoe UI Semibold",
  },
  "hoc-thuat": {
    name: "Học thuật", desc: "Nền kem, tiêu đề có chân, đỏ rượu — bảo vệ luận án, hội thảo chuyên đề",
    bg: "#FBF8F2", ink: "#221E1A", ink2: "#4A423A", muted: "#7A7065", line: "#E2D9CB",
    primary: "#7A1F2B", primaryL: "#F3E6E3", accent: "#2F5D62",
    int: "#7A1F2B", intL: "#F3E6E3", ctl: "#6C7A80", ctlL: "#ECEFEF",
    font: "Calibri, 'Segoe UI', Arial, sans-serif", head: "Cambria, Georgia, 'Times New Roman', serif", pptFont: "Calibri", pptHead: "Cambria",
  },
  "benh-vien": {
    name: "Bệnh viện", desc: "Dải tiêu đề xanh dương đậm, chân trang có tên đơn vị — sinh hoạt khoa học nội viện",
    bg: "#FFFFFF", ink: "#16202C", ink2: "#384656", muted: "#64707E", line: "#D6DEE8",
    primary: "#123E7C", primaryL: "#E5EDF8", accent: "#D9822B",
    int: "#D9822B", intL: "#FBEFE2", ctl: "#5B6E86", ctlL: "#EDF1F6",
    font: "Arial, 'Segoe UI', sans-serif", head: "Arial, 'Segoe UI', sans-serif", pptFont: "Arial", pptHead: "Arial", band: true,
  },
  "cong-dong": {
    name: "Cộng đồng", desc: "Xanh lá ấm, chữ to, bo góc — giáo dục sức khỏe cho người bệnh",
    bg: "#F7FAF5", ink: "#1F2A1F", ink2: "#3D4B3D", muted: "#687568", line: "#D5E2D2",
    primary: "#2E7D4F", primaryL: "#E3F1E7", accent: "#E07A2E",
    int: "#2E7D4F", intL: "#E3F1E7", ctl: "#8A6D3B", ctlL: "#F3ECDF",
    font: "'Segoe UI', Arial, sans-serif", head: "'Segoe UI', Arial, sans-serif", pptFont: "Segoe UI", pptHead: "Segoe UI Semibold", large: true, round: true,
  },
};

export function theme(id) { return THEMES[id] || THEMES["lam-sang"]; }

export function themeCss(id) {
  const t = theme(id);
  return `:root{--bg:${t.bg};--ink:${t.ink};--ink2:${t.ink2};--muted:${t.muted};--faint:${t.muted};--line:${t.line};
--primary:${t.primary};--primary-l:${t.primaryL};--accent:${t.accent};--int:${t.int};--int-l:${t.intL};--ctl:${t.ctl};--ctl-l:${t.ctlL};
--font:${t.font};--font-head:${t.head};--title-size:${t.large ? 60 : 54}px;--body-size:${t.large ? 38 : 34}px;--small:${t.large ? 28 : 26}px;--foot:18px;--radius:${t.round ? 18 : 6}px}`;
}
