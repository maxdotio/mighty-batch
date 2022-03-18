import fs from "fs";
import progress from "progress";
import { fork } from "child_process";
import { request } from "./request.js";
import { batch,slice,total_files,mini_batch } from "./files.js";
import { Command, Option } from "commander";
import { isMainThread, BroadcastChannel, Worker, workerData } from "worker_threads";


//Command Line API
let program = new Command();
program.addOption(new Option("-t, --threads <number>","Number of CPU threads to use.  This is also the number of processes that will run (one per thread).").default(2));
program.addOption(new Option("-w, --workers <number>","Number of asyncronous workers to use per thread process.").default(2));
program.addOption(new Option("-h, --host <string>","The IP address of the server where requests will be sent.").default("127.0.0.1"));
program.addOption(new Option("-x, --max <number>","The maximum number of objects to send to the server.").default(0));
program.parse();


//Mighty Server IP address
const host = program.opts().host;

//Threads/Workers combinations
const threads = parseInt(program.opts().threads);
const workers_per_thread = parseInt(program.opts().workers);

//Folder numbers
const min = 1;
const max = parseInt(program.opts().max);

//Safety for event emitters (default max==10)
process.setMaxListeners(threads*workers_per_thread*2);

//Level 0 - CLUSTER parent (owner of all threads)

const controller = new AbortController();
const { signal } = controller;

let total = total_files(min,max);
var bar = new progress("Inferring [:bar] :percent remaining::etas elapsed::elapsed (:current/:total)", {complete: "=", incomplete: " ", width: 50, total: total});

let threads_completed = 0;
let errors = [];

//
// Called when a thread and all its workers are done
// Quits the main process when all threads are complete
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

//
// Spawns one thread.js child process
// Just specify a number!
let spawn_child = function(thread_num) {
    const child = fork("./thread.js", [
        "--thread",thread_num,
        "--threads",threads,
        "--workers",workers_per_thread,
        "--host",host,
        "--max",max
    ], { signal });
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
        console.error("*************** Unexpected Error! ***************");
        console.error(err);
      }).
      on("exit", () => {
      });
}

for (let n = 0; n < threads; n++) {
    spawn_child(n);
}