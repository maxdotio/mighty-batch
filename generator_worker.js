import { readFile,writeFile } from "fs/promises";
import { request } from "./request.js";
import { isMainThread, BroadcastChannel, workerData } from "worker_threads";

if (!isMainThread) {
    //Level 3 - WORKER child (see multi.js)

    const channel = new BroadcastChannel('mightybatch');

    const worker_num = workerData.worker_num;
    const thread_num = workerData.thread_num;
    const url = workerData.url;
    const batch = workerData.batch;

    let keep_going = true;

    while (keep_going) {

        let object = await request("http://localhost:3000/next");
        let error = object[0];
        let file = object[1];
        if (error || file.done === true) {
            keep_going = false;
        } else {
            let vectors = [];
            let errors = [];
            let json = await readFile(file.filename,"utf-8");
            let part = JSON.parse(json);

            for (var j=0;j<part.fields.p.length;j++) {
                //Infer each part paragraph and accumulate
                let text = part.fields.p[j];
                if (text.length>0) {
                    let response = await request(url,text);
                    if (response[1]) {
                        vectors.push(response[1].outputs);
                    } else {
                        errors.push(response[0]);
                        vectors.push([]);
                    }
                } else {
                    vectors.push([]);
                }
            }

            if (errors.length==0) {
                channel.postMessage({"type":"success","data":{"thread":thread_num,"worker":worker_num,"file":file.filename}});
            } else {
                channel.postMessage({"type":"error","data":{"thread":thread_num,"worker":worker_num,"file":file.filename,"errors":errors}});
            }

            //Append the vectors to the part, and save to disk
            part.fields.vectors = vectors;
            await writeFile(file.outfile,JSON.stringify(part),"utf-8");
        }
    }
    channel.postMessage({"type":"done","data":{"thread":thread_num,"worker":worker_num}});
    channel.close();

}