import fs from "fs";
import progress from "progress";
import { fork } from "child_process";
import { request } from "./request.js";
import { batch,slice,total_files,mini_batch } from "./files.js";
import { Command, Option } from "commander";
import { isMainThread, BroadcastChannel, Worker, workerData } from "worker_threads";


import path from 'path';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Command Line API
let program = new Command();
program.addOption(new Option("-t, --threads <number>","Number of CPU threads to use.  This is also the number of processes that will run (one per thread).").default(2));
program.addOption(new Option("-w, --workers <number>","Number of asyncronous workers to use per thread process.").default(2));
program.addOption(new Option("-h, --host <string>","The address of the server where requests will be sent.").default("localhost"));
program.addOption(new Option("-H, --hosts <string>","A comma separated list of hosts where requests will be sent.").default(null));
program.addOption(new Option("-x, --max <number>","The maximum number of objects to send to the server.").default(100));
program.addOption(new Option("-p, --property <string>","The JSON property to convert (requires --json).").default(null));
program.addOption(new Option("-s, --secret <string>","(system flag, do not use)").default(""));
program.addOption(new Option("-n, --thread <number>","(system flag, do not use)").default(0));
program.addOption(new Option("--embeddings").default(false));
program.addOption(new Option("--sentence-transformers").default(false));
program.addOption(new Option("--question-answering").default(false));
program.addOption(new Option("--sequence-classification").default(false));
program.addOption(new Option("--token-classification").default(false));
program.addOption(new Option("--visual").default(false));

program.parse();


//Mighty Server IP address
const host = program.opts().host;

//If hosts is specified, it will override single host/port assignment by assigning one host per worker
let hosts = program.opts().hosts;
if (hosts && hosts.length) {
    hosts = hosts.split(',');
}

//Threads/Workers combinations
const threads = parseInt(program.opts().threads);
const workers_per_thread = parseInt(program.opts().workers);

//Folder numbers
const min = 1;
const max = parseInt(program.opts().max);

//Content specs
const property = program.opts().property;

//API security
const secret = program.opts().secret;

//Base64
const is_visual = (program.opts().visual)?true:false;

//Pipeline specs
let pipeline = null;
if (program.opts().embeddings) pipeline = "";
if (program.opts().sentenceTransformer) pipeline = "sentence-transformers";
if (program.opts().questionAnswering) pipeline = "question-answering";
if (program.opts().sequenceClassification) pipeline = "sequence-classification";
if (program.opts().tokenClassification) pipeline = "token-classification";
if (program.opts().visual) pipeline = "visual";
//Default to sentence-transformers
if (pipeline == null) pipeline = "sentence-transformers";

//Safety for event emitters (default max==10)
process.setMaxListeners(threads*workers_per_thread*2);

if (isMainThread) {

    //Level 1 - WORKER Thread Parent (1 per thread)

    //Configured from the CLI
    const thread_num = parseInt(program.opts().thread);    

    //Inter-worker communications
    const channel = new BroadcastChannel('mightybatch');
    let channels_completed = 0;
    channel.onmessage = (event) => {
        if (event.data === 'done') {
            if(++channels_completed == workers_per_thread) {
                //All done! Cleanup
                process.send(event.data);
                channel.close();
                process.exit(0);
            }
        }

        //Propagate message to the Cluster main process
        process.send(event.data);

    };

    //Mighty ports start at 5050 and grow from there
    const base_port = 5050 + (thread_num*workers_per_thread);
    let host_idx = 0;

    //Create workers_per_thread workers - which will all be part of this thread_num cluster child process.
    for (let worker_num = 0; worker_num < workers_per_thread; worker_num++) {

        const port = base_port + worker_num;
        let url = `http://${host}:${port}/${pipeline}`;

        if (hosts && hosts.length) {
            url = hosts[host_idx];
            if (url.lastIndexOf('/') != url.length-1) url += '/';
            url += pipeline;
            if (++host_idx>=hosts.length) host_idx=0;
        }

        //Level 3 - WORKER child (see worker.js)
        new Worker(__dirname + "/worker.js",{workerData:{"worker_num":worker_num,"thread_num":thread_num,"url":url,"property":property,"visual":is_visual,"secret":secret}});
    }

}