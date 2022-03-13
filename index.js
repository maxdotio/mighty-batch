import {isMainThread, BroadcastChannel, Worker, workerData} from "worker_threads";
import {request} from "./request.js";
import {batch} from "./files.js";
import fs from "fs";
import progress from "progress"
import {program} from "commander";

const channel = new BroadcastChannel('mightybatch');

if (isMainThread) {

    program.option('-w, --workers <number>');
    program.parse();
    let workers = parseInt(program.opts().workers);
    if(!workers) workers = 2;

    let batches = batch(workers);
    let total = 0;
    batches.map(i=>total+=i.length);
    var bar = new progress('Inferring [:bar] :percent remaining::etas elapsed::elapsed (:current/:total)', {complete: '=', incomplete: ' ', width: 50, total: total});

    let channels = 0;
    let errors = [];
    channel.onmessage = (event) => {
        if (event.data.indexOf('error')>-1) {
            errors.push(event.data);
        }
        if (event.data.indexOf('done')>-1) {
            if(++channels == workers) {
                channel.close();
                console.log(`DONE! Total errors: ${errors.length}`);
            }
        } else {
            bar.tick();
        }
    };

    for (let n = 0; n < workers; n++) {
        new Worker("./index.js",{workerData:{"id":n,"batch":batches[n]}});
    }

} else {

    const url = `http://192.168.1.20:${5050+workerData.id}/sentence-transformers`;
    for (var i=0;i<workerData.batch.length;i++) {
        let vectors = [];
        let errors = [];
        let file = workerData.batch[i];
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
            channel.postMessage(`success from ${workerData.id} on file ${file.filename}`);
        } else {
            channel.postMessage(`error from ${workerData.id} on file ${file.filename}`);
        }

        part.fields.vectors = vectors;
        fs.writeFileSync(file.outfile,JSON.stringify(part,null,2),"utf-8");
    }
    channel.postMessage(`done from ${workerData.id}`);
    channel.close();
}