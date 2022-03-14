import fs from "fs";
import progress from "progress";
import { fork } from "child_process";
import { request } from "./request.js";
import { batch,slice,total_files,mini_batch } from "./files.js";
import { program } from "commander";
import { isMainThread, BroadcastChannel, Worker, workerData } from "worker_threads";

//Hard coded constants
const min_title = 1;
const max_title = 50;

//Command Line API
program.option("-c, --child", false);
program.option("-t, --threads <number>",2);
program.option("-w, --workers <number>",2);
program.option("-n, --thread <number>",0);
program.option("-h, --host <string>","127.0.0.1");
program.option("-u, --url <string>");
program.parse();

const threads = parseInt(program.opts().threads);
const workers_per_thread = parseInt(program.opts().workers);
const host = program.opts().host;

//Safety for event emitters (default max==10)
process.setMaxListeners(threads*workers_per_thread*2);

if (!program.opts().child) {
    //Level 0 - CLUSTER parent (owner of all threads)

    const controller = new AbortController();
    const { signal } = controller;

    let total = total_files(min_title,max_title);
    var bar = new progress("Inferring [:bar] :percent remaining::etas elapsed::elapsed (:current/:total)", {complete: "=", incomplete: " ", width: 50, total: total});

    let threads_completed = 0;
    let errors = [];

    let completed_events = [];
    let exit_child = function(event) {
        completed_events.push(event);
        if(++threads_completed == (threads*workers_per_thread)) {
            for(var c=0;c<completed_events.length;c++) {
                console.log(completed_events[c]);
            }
            console.log(`DONE! Total errors: ${errors.length}`);
            for(var e=0;e<errors.length;e++) {
                console.log(errors[e]);
            }
            process.exit(0);
        }
    }

    let spawn_child = function(thread_num) {
        const child = fork("./multi.js", ["--child","--thread",thread_num,"--threads",threads,"--workers",workers_per_thread,"--host",host], { signal });
        child.
          on("message", (event) => {
            
            if (event.type=="error") {
                errors.push(event.data);
            }

            if (event.type=="done") {
                exit_child(event);

            } else {
                bar.tick();
            }

          }).
          on("error", (err) => {
            console.log("*************** Unexpected Error! ***************");
            console.log(err);
          }).
          on("exit", () => {
          });
    }

    for (let n = 0; n < threads; n++) {
        spawn_child(n);
    }

} else if (isMainThread) { 
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

    //Worker data
    const batches = mini_batch(workers_per_thread,slice(workers_per_thread,thread_num,min_title,max_title));
    const base_port = 5050 + (thread_num*workers_per_thread);

    //Create workers_per_thread workers - which will all be part of this thread_num cluster child process.
    for (let worker_num = 0; worker_num < workers_per_thread; worker_num++) {
        const port = base_port + worker_num;
        const url = `http://${host}:${port}/sentence-transformers`;

        //Level 3 - WORKER child (see worker.js)
        new Worker("./worker.js",{workerData:{"worker_num":worker_num,"thread_num":thread_num,"url":url,"batch":batches[worker_num]}});
    }

}
