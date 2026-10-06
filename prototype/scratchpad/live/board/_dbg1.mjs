import { openProto, sleep } from "./lib.mjs";
const P = await openProto({ name: "dbg", width: 1480, height: 1000 });
await P.ev(`fresh('d', {})`); await P.waitFor("A('d').ctx.ready"); await sleep(600);
await P.click("#d #lv-q"); await P.typeText("zzzz", 4); await sleep(200);
console.log(JSON.stringify(await P.ev(`({ pb: document.querySelector('#d .lv-pbody').innerText.replace(/\s+/g,' ').slice(0,200), mn: document.querySelector('#d .lv-mnote').innerHTML.slice(0,300), mnHidden: document.querySelector('#d .lv-mnote').hidden, els: A('d').ctx.parts.map.count })`)));
await P.close();
