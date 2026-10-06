// Preuzimanje generisanog teksta kao datoteke u pregledniku (CSV iz Prometa). BOM ide ispred sadržaja da
// lokalni Excel prepozna UTF-8 (š, đ, č, ć, ž). Vraća false ako preglednik ne dozvoli preuzimanje.
export const downloadText = (filename: string, text: string, type = "text/csv;charset=utf-8"): boolean => {
  try {
    const blob = new Blob(["﻿", text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
};
