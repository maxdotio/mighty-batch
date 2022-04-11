import { readFile,writeFile } from "fs/promises";
import { request } from "./request.js";
import { isMainThread, BroadcastChannel, workerData } from "worker_threads";

if (!isMainThread) {
    //Level 3 - WORKER child (see multi.js)

    const channel = new BroadcastChannel('mightybatch');

    const worker_num = workerData.worker_num;
    const thread_num = workerData.thread_num;
    const url = workerData.url;
    //const batch = workerData.batch;
    const property = workerData.property;
    const secret = workerData.secret;

    let keep_going = true;

    while (keep_going) {

        let next_url = `http://localhost:3000/next?secret=${secret}`;
        let object = await request(next_url);
        let error = object[0];
        let file = object[1];
        if (error || file.done === true) {
            keep_going = false;
        } else {
            let vectors = [];
            let texts = [];
            let errors = [];
            let part = file.object;
            if(!part) {
                try {
                    let raw = await readFile(file.filename,"utf-8");
                    part = JSON.parse(raw);
                } catch(ex) {
                    keep_going = false;
                }
            }

            if (keep_going) {

                //TODO make this a JSON selector...
                let data_to_infer;
                if (property && property.length && part[property]) {
                    data_to_infer = part[property];
                } else if (part.fields) {
                    data_to_infer = part.fields.p;
                } else {
                    data_to_infer = part.text;
                }

                if (data_to_infer instanceof Array) {

                    for (var j=0;j<data_to_infer.length;j++) {
                        //Infer each part paragraph and accumulate
                        let text = data_to_infer[j];
                        if (text.length>0) {
                            let response = await request(url,text);
                            if (response[1]) {
                                vectors.push(response[1].outputs);
                                texts.push(response[1].texts);
                            } else {
                                errors.push(response[0]);
                                vectors.push([]);
                                texts.push([]);
                            }
                        } else {
                            vectors.push([]);
                            texts.push([]);
                        }
                    }

                } else {

                    //Infer each part paragraph and accumulate
                    let text = data_to_infer;
                    if (text.length>0) {
                        let response = await request(url,text);
                        if (response[1]) {
                            vectors.push(response[1].outputs);
                            texts.push(response[1].texts);
                        } else {
                            errors.push(response[0]);
                            vectors.push([]);
                            texts.push([]);
                        }
                    } else {
                        vectors.push([]);
                        texts.push([]);
                    }
                }

                //Append the vectors to the part, and save to disk
                if(part.fields) {
                    part.fields.vectors = vectors;
                    part.fields.texts = texts;
                } else {
                    part.vectors = vectors;
                    part.texts = texts;
                }
                await writeFile(file.outfile,JSON.stringify(part),"utf-8");

            }

            if (errors.length==0) {
                channel.postMessage({"type":"success","data":{"thread":thread_num,"worker":worker_num,"file":file.filename}});
            } else {
                channel.postMessage({"type":"error","data":{"thread":thread_num,"worker":worker_num,"file":file.filename,"errors":errors}});
            }

        }
    }

    channel.postMessage({"type":"done","data":{"thread":thread_num,"worker":worker_num}});
    channel.close();

}