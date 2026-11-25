// Nhúng icon + thông tin phiên bản vào file .exe bằng JS thuần (thay rcedit/wine khi build trên Linux)
import fs from "node:fs";
import * as ResEdit from "resedit";
const [exe, ico, version = "1.0.0"] = process.argv.slice(2);
const data = fs.readFileSync(exe);
const exeObj = ResEdit.NtExecutable.from(data, { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exeObj);
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const gid = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, gid, lang, iconFile.icons.map((i) => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
const [a, b, c] = version.split(".").map(Number);
vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: "MedSlide VI Studio", ProductName: "MedSlide VI Studio", CompanyName: "Huynh Anh Thuan", LegalCopyright: "Copyright (c) 2026 Huynh Anh Thuan", OriginalFilename: "MedSlide VI Studio.exe", InternalName: "MedSlide VI Studio" });
vi.outputToResourceEntries(res.entries);
res.outputResource(exeObj);
fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
console.log("icon+version ok:", exe);
