import { readFile,writeFile } from "fs/promises";
import { request,request_pair,request_base64 } from "./request.js";
import { isMainThread, BroadcastChannel, workerData } from "worker_threads";
import imageToBase64 from "image-to-base64";

if (!isMainThread) {
    //Level 3 - WORKER child (called by thread.js)

    const channel = new BroadcastChannel('mightybatch');

    const worker_num = workerData.worker_num;
    const thread_num = workerData.thread_num;
    const url = workerData.url;
    const property = workerData.property;
    const secret = workerData.secret;
    const is_visual = workerData.visual;
    const method = workerData.method;

    let keep_going = true;

    let do_inference = async function(text,text2,errors,vectors,texts) {

        let vec = [];
        let txt = [];
        let err = [];

        if (text.length>0) {
            let response;
            if (text2 && text2.length > 0) {
                response = await request_pair(url,text,text2,method);
                if (response[1]) {
                    vec = response[1];
                } else {
                    err = response[0];
                    vec = [];
                    txt = [];
                }                              
            } else if (is_visual) {
                //The text value holds the filename of an image to infer
                let b64 = await imageToBase64(text);
                response = await request_base64(url,"data:image/png;base64," + b64);
                if (response[1]) {
                    vec = response[1].outputs;
                    txt = []; //no text for base64
                } else {
                    err = response[0];
                    vec = [];
                    txt = [];
                }
            } else {
                response = await request(url,text,method);
                if (response[1] && response[1].outputs) {
                    vec = response[1].outputs;
                    txt = response[1].texts;
                } else if (response[1] && response[1].entities) {
                    vec = response[1].entities;
                    txt = response[1].texts;
                } else if (response[1]) {
                    vec = response[1];
                    txt = [];                    
                } else  {
                    err = response[0];
                    vec = [];
                    txt = [];
                }
            }
        } else {
            vec = [];
            txt = [];
        }

        return {errors:err,vectors:vec,texts:txt};

    }

    while (keep_going) {

        let next_url = `http://localhost:5888/next?secret=${secret}`;
        let object = await request(next_url);
        let error = object[0];
        let file = object[1];
        if (error || file.done === true) {
            keep_going = false;
        } else {
            let success = true;
            let vectors = [];
            let texts = [];
            let errors = [];
            let doc = file.object;
            if(!doc) {
                try {
                    let raw = await readFile(file.filename,"utf-8");
                    doc = JSON.parse(raw);
                    success = true;
                } catch(ex) {
                    success = false;
                }
            }
            

            if (success) {

                //TODO make this a JSON selector...
                let data_to_infer;
                let context_to_infer = null;
                if (property && property.length) {
                    let pair = property.split(',');
                    if (doc[property]) {
                        data_to_infer = doc[property];
                    } else if (property && pair.length==2 && doc[pair[0]] && doc[pair[1]]) {
                        data_to_infer = doc[pair[0]];
                        context_to_infer = doc[pair[1]];
                    } else {
                        data_to_infer = doc.text;
                    }
                } else if (doc.fields) {
                    data_to_infer = doc.fields.p;
                } else {
                    data_to_infer = doc.text;
                }

                if (data_to_infer instanceof Array) {

                    for (var j=0;j<data_to_infer.length;j++) {
                        //Infer each doc paragraph and accumulate
                        let text = data_to_infer[j];
                        let text2 = null;
                        if (context_to_infer instanceof Array) {
                            text2 = context_to_infer[j]
                        }

                        let inferred = await do_inference(text,text2);
                        errors = errors.concat(inferred.errors);
                        vectors = vectors.concat(inferred.vectors);
                        texts = texts.concat(inferred.texts);

                    }

                } else {

                    //Infer each doc paragraph and accumulate
                    let text = data_to_infer;
                    let text2 = context_to_infer;

                    let inferred = await do_inference(text,text2);
                    errors = errors.concat(inferred.errors);
                    vectors = vectors.concat(inferred.vectors);
                    texts = texts.concat(inferred.texts);

                }

                //Append the vectors to the doc, and save to disk
                if(doc.fields) {
                    doc.fields.vectors = vectors;
                    doc.fields.texts = texts;
                } else {
                    doc.vectors = vectors;
                    doc.texts = texts;
                }
                await writeFile(file.outfile,JSON.stringify(doc),"utf-8");

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