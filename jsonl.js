import { once } from 'events';
import { mkdirSync,createReadStream } from 'fs';
import { createInterface } from 'readline';

export function jsonl(filename) {
    this.filename = filename;
    this.lines = [];
}

jsonl.prototype.get_lines = async function(min,max) {
    let self = this;
    let i = 0;
    let filename = self.filename;
    let out = `vectors/${filename}/`;
    min = min||0;
    max = max||-1;    
    mkdirSync(out, { recursive: true });
    try {
        const filename = "test.jsonl";
        const rl = createInterface({
            input: createReadStream(filename),
            crlfDelay: Infinity
        });
    
        rl.on('line', (line) => {
            if ((i>=min) && ((max==-1) || (i<=max))) {
                self.lines.push({
                    "idx":i,
                    "jsonstring":line,
                    "outfile":`${out}${i}.json`
                });
            }
            i++;
        });
    
        await once(rl, 'close');

    } catch (err) {
        console.error(err);
    }
}