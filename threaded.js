import fs from "fs";
import progress from "progress";
import { fork } from "child_process";
import { request } from "./request.js";
import { batch,slice,total_files } from "./files.js";
import { program } from "commander";

program.option("-c, --child", false);
program.option("-w, --workers <number>",2);
program.option("-t, --thread <number>",0);
program.option("-h, --host <string>","127.0.0.1");
program.option("-u, --url <string>");
program.parse();

let workers = parseInt(program.opts().workers);
let host = program.opts().host;

if (!program.opts().child) {

    const controller = new AbortController();
    const { signal } = controller;

    let total = total_files(1,1);
    var bar = new progress("Inferring [:bar] :percent remaining::etas elapsed::elapsed (:current/:total)", {complete: "=", incomplete: " ", width: 50, total: total});

    let threads_completed = 0;
    let errors = [];

    for (let n = 0; n < workers; n++) {
        (function(thread_num) {
            const port = 5050+thread_num;
            const url = `http://${host}:${port}/sentence-transformers`;
            const child = fork("./threaded.js", ["--child","--thread",thread_num,"--workers",workers,"--url",url,"--host",host], { signal });
            child.
              on("message", (event) => {
                
                if (event.type=="error") {
                    errors.push(event.data);
                }

                if (event.type=="done") {
                    if(++threads_completed == workers) {
                        console.log(`DONE! Total errors: ${errors.length}`);
                    }
                } else {
                    bar.tick();
                }
              }).
              on("error", (err) => {
                console.log("*************** Unexpected Error! ***************");
                console.log(err);
              });
        })(n);
    }

} else {

    const url = program.opts().url;
    const thread_num = parseInt(program.opts().thread);
    const sliced = slice(workers,thread_num,1,1);
    
    for (var i=0;i<sliced.length;i++) {
        let vectors = [];
        let errors = [];
        let file = sliced[i];

        let part = JSON.parse(fs.readFileSync(file.filename,"utf-8"));
        for (var j=0;j<part.fields.p.length;j++) {
            let response = await request(url,part.fields.p[j]);
            if (response[1]) {
                vectors.push(response[1].outputs);
            } else {
                errors.push(response[0]);
                vectors.push([]);                
            }
        }

        if (errors.length==0) {
            process.send({"type":"success","data":{"worker":thread_num,"file":file.filename}});
        } else {
            process.send({"type":"error","data":{"worker":thread_num,"file":file.filename}});
        }

        part.fields.vectors = vectors;
        fs.writeFileSync(file.outfile,JSON.stringify(part),"utf-8");
    }

    process.send({"type":"done","data":{"worker":thread_num}});
    process.exit(0);

}
