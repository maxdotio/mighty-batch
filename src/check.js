import fs from "fs";
import progress from "progress";
import { batch,slice,total_files } from "./files.js";

let sliced = slice(1,50);
let byte_total = 0;
let text_total = 0;

var bar = new progress("Inferring [:bar] :percent remaining::etas elapsed::elapsed (:current/:total)", {complete: "=", incomplete: " ", width: 50, total: sliced.length});
for (var i=0;i<sliced.length;i++) {
    let file = sliced[i];
    let part = JSON.parse(fs.readFileSync(file.filename,"utf-8"));
    text_total += part.fields.p.length;
    for (var j=0;j<part.fields.p.length;j++) {
        let text = part.fields.p[j];
        byte_total += text.length;
    }
    bar.tick();
}
console.log(`total paragraphs:${text_total}\t\ttotal bytes:${byte_total}`);
