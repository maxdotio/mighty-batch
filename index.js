#!/usr/bin/env node

import fs from "fs";
import progress from "progress";
import express from "express";
import { fork } from "child_process";
import { request } from "./request.js";
import { batch, slice, get_files, get_json, total_files, mini_batch } from "./files.js";
import { Command, Option } from "commander";
import { isMainThread, BroadcastChannel, Worker, workerData } from "worker_threads";


import { v4 as uuidv4 } from "uuid";
const secret = uuidv4();

import path from 'path';
import {fileURLToPath} from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//Command Line API
let program = new Command();
program.addOption(new Option("-t, --threads <number>","Number of CPU threads to use.  This is also the number of processes that will run (one per thread).").default(2));
program.addOption(new Option("-w, --workers <number>","Number of asyncronous workers to use per thread process.").default(2));
program.addOption(new Option("-h, --host <string>","The IP address of the server where requests will be sent.").default("127.0.0.1"));
program.addOption(new Option("-x, --max <number>","The maximum number of objects to send to the server.").default(0));
program.addOption(new Option("-j, --json <string>","The filename of a JSON list of objects.").default(null));
program.addOption(new Option("-p, --property <string>","The JSON property to convert (requires --json).").default(null));
program.parse();


//Mighty Server IP address
const host = program.opts().host;

//Threads/Workers combinations
const threads = parseInt(program.opts().threads);
const workers_per_thread = parseInt(program.opts().workers);

//Folder numbers
const min = 10;
const max = parseInt(program.opts().max);

//Content specs
const json_file = program.opts().json;
const property = program.opts().property;

//Safety for event emitters (default max==10)
process.setMaxListeners(threads*workers_per_thread*2);

//Level 0 - CLUSTER parent (owner of all threads)

const controller = new AbortController();
const { signal } = controller;

let files = [];
if (json_file) {
    files = get_json(json_file,min,max);
} else {
    files = get_files(min,max);
}
let total = files.length;

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
            console.error(errors[e]);
        }

        //Bye!
        process.exit(0);
    }
}

//
// Spawns one thread.js child process
// Just specify a number!
let spawn_child = function(thread_num) {
    const child = fork(__dirname + "/thread.js", [
        "--thread",thread_num,
        "--threads",threads,
        "--workers",workers_per_thread,
        "--host",host,
        "--max",max,
        "--property",property,
        "--secret",secret
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


//
// A non-generator generator for any array
const done_message = {"done":true};
let object_generator = function(arr) {
    let idx = -1;
    let max = arr.length;
    return function next_object() { 
        return (((++idx)<max)?arr[idx]:done_message);
    }
}
let next_object = object_generator(files);

//
// Express listener
// hands out id's based on a generator
const app = express();
app.get('/next', function (req, res) {
    if (req.query.secret == secret) {
        let thing = next_object();
        res.send(thing);
    } else {
        res.send(done_message);
    }
});
app.listen(3000);
//
//Spawn one child process per thread
for (let n = 0; n < threads; n++) {
    spawn_child(n);
}

