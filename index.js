#!/usr/bin/env node

import fs from "fs";
import progress from "progress";
import express from "express";
import { fork } from "child_process";
import { request, slice_hosts } from "./src/request.js";
import { jsonl } from "./src/jsonl.js";
import { read_and_transform, fetch_and_transform } from "./src/html.js";
import { batch, slice, get_files, get_html_files, get_parts, get_json, get_sitemap, total_files, mini_batch, clean_filename } from "./src/files.js";
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
program.addOption(new Option("-t, --threads <number>","Number of CPU threads to use. This is also the number of processes that will run (one per thread).").default(2));
program.addOption(new Option("-w, --workers <number>","Number of asyncronous workers to use per thread process.").default(2));
program.addOption(new Option("-h, --host <string>","The address of the server where requests will be sent.").default("localhost"));
program.addOption(new Option("-H, --hosts <string>","A comma separated list of hosts where requests will be sent.").default(null));
program.addOption(new Option("-x, --max <number>","The maximum number of objects to send to the server.").default(0));
program.addOption(new Option("-j, --json <string>","The filename of a JSON list of objects.").default(null));
program.addOption(new Option("-l, --jsonl <string>","The filename of a JSON lines list of objects.").default(null));
program.addOption(new Option("-f, --html <string>","The path to the HTML files.").default(null));
program.addOption(new Option("-f, --files <string>","The path to the JSON files.").default(null));
program.addOption(new Option("-s, --sitemap <string>","The sitemap.xml file location.").default(null));
program.addOption(new Option("-p, --property <string>","The JSON property to convert.").default(null));
program.addOption(new Option("-m, --method <string>","GET (default) or POST").default("GET"));
program.addOption(new Option("--embeddings").default(false));
program.addOption(new Option("--sentence-transformers").default(false));
program.addOption(new Option("--question-answering").default(false));
program.addOption(new Option("--sequence-classification").default(false));
program.addOption(new Option("--token-classification").default(false));
program.addOption(new Option("--visual").default(false));

program.parse();

//Threads/Workers combinations
const threads = parseInt(program.opts().threads);
const workers_per_thread = parseInt(program.opts().workers);

//Mighty Server address
const host = program.opts().host;

//If hosts is specified, it will override single host/port assignment by assigning one host per connection (threads*workers)
let hosts = program.opts().hosts;
if (hosts && hosts.length) {
    hosts = hosts.split(',');
    if (hosts.length !== threads*workers_per_thread) {
        console.error(`Oops! You must specify the same number for both hosts and connections (threads * workers).  You have specified ${hosts.length} hosts, and ${threads*workers_per_thread} connections(${threads} threads * ${workers_per_thread} workers)`);
        process.exit(1);
    }
}

//Folder numbers
const min = 0;
const max = parseInt(program.opts().max);

//Content specs
const json_file = program.opts().json;
const jsonl_file = program.opts().jsonl;
const sitemap_url = program.opts().sitemap;
const html_path = program.opts().html;
const files_path = program.opts().files;
const property = program.opts().property;

//Pipeline specs and conflicts
let pipeline = null;
let set_count = 0;
if (program.opts().embeddings) { pipeline = "--embeddings"; set_count++; }
if (program.opts().sentenceTransformer) { pipeline = "--sentence-transformers"; set_count++; }
if (program.opts().questionAnswering) { pipeline = "--question-answering"; set_count++; }
if (program.opts().sequenceClassification) { pipeline = "--sequence-classification"; set_count++; }
if (program.opts().tokenClassification) { pipeline = "--token-classification"; set_count++; }
if (program.opts().visual) { pipeline = "--visual"; set_count++; }
if (set_count>1){
    console.error("Multiple pipelines specified.  Please choose only one!  Exiting...");
    process.exit(1);
}
//Default to sentence-transformers
if (!pipeline) pipeline = "--sentence-transformers";

if (pipeline == "--question-answering" && property.split(',').length !==2) {
    console.error(`Oops! You must specify two properties separated by a comma (the first for the question, the second for the context).  You have specified "${property}"`);
    process.exit(1);
}


//HTTP Method
let method = program.opts().method.toUpperCase();
if (method !== "GET" && method !== "POST") {
    console.warn(`HTTP method "${method}" not supported, defaulting to GET`);
    method = "GET";
}

if (method !== "GET" && program.opts().visual) {
    console.warn(`Visual pipelines only support HTTP GET for now.`);
    method = "GET";
}

//For sitemaps, this contains any broken/missing URLs
let missing = [];

//Safety for event emitters (default max==10)
process.setMaxListeners(threads*workers_per_thread*2);

//Level 0 - CLUSTER parent (owner of all threads)

const controller = new AbortController();
const { signal } = controller;

let files = [];
let name = "mighty-batch";
if (json_file) {
    name = clean_filename(json_file);
    files = get_json(json_file,min,max);
} else if (jsonl_file) {
    name =  clean_filename(jsonl_file);
    let jsonl_stream = new jsonl(jsonl_file);
    await jsonl_stream.get_lines();
    files = jsonl_stream.lines;
} else if (sitemap_url) {
    name = clean_filename(sitemap_url);
    files = await get_sitemap(sitemap_url,min,max);
    if (files && files.length) {
        console.log(`Sitemap loaded and found ${files.length} URLs`);
    } else {
        console.log(`Sitemap ${sitemap_url} either not found or is empty!`);
    }
} else if (html_path) {
    name = clean_filename(html_path);
    files = get_html_files(html_path,min,max);
    console.log(files.length);
    console.log(files[0]);
} else if (files_path) {
    name = "files";
    files = get_files(files_path,min,max);
    console.log(files.length);
    console.log(files[0]);
} else {
    name = "parts";
    files = get_parts(min,max);
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

        if (missing.length) {
            console.log(`WARNING! ${missing.length} URLs were inaccessible:`);
            errors = errors.concat(missing);
        }

        if (errors.length) {
            let err_file = `${name}_error.log`;
            fs.writeFileSync(err_file,JSON.stringify(errors,null,2),"utf-8");
            console.error(`DONE! Total errors: ${errors.length} ...see ${err_file} for detailed information.`);

            //Bye!
            process.exit(1);

        } else {

            console.log(`DONE! Total errors: 0`);
            //Bye!
            process.exit(0);

        }

    }
}

//
// Spawns one thread.js child process
// Just specify a number!
let spawn_child = function(thread_num) {

    let params = [
        "--thread",thread_num,
        "--threads",threads,
        "--workers",workers_per_thread,
        "--host",host,
        "--max",max,
        "--property",property,
        "--method",method,
        "--secret",secret,
        pipeline
    ];

    const thread_hosts = slice_hosts(hosts,threads,thread_num);
    if (thread_hosts) {
        params.push("--hosts");
        params.push(thread_hosts);
    }

    const child = fork(__dirname + "/src/thread.js", params, { signal });
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
    return async function next_object() { 
        if (++idx<max) {
            let obj = arr[idx];
            if (obj.url) {
                //A URL was specified instead of a JSON object or filename.
                //Try to scrape it!
                try {
                    let doc = await fetch_and_transform(obj.url);
                    if (!doc[0] && doc[1]) {
                        obj.object = doc[1]
                    } else {
                        bar.tick();
                        return {"error":{"url":obj.url,"ex":doc[0]||doc[1]}};
                    }
                } catch (ex) {
                    bar.tick();
                    return {"error":{"url":obj.url,"ex":ex}};
                }
            } else if (obj.html) {
                //An HTML file was specified.
                //Try to scrape it!
                try {
                    let doc = await read_and_transform(obj.html);
                    if (!doc[0] && doc[1]) {
                        obj.object = doc[1]
                    } else {
                        bar.tick();
                        return {"error":{"url":obj.html,"ex":doc[0]||doc[1]}};
                    }
                } catch (ex) {
                    bar.tick();
                    return {"error":{"url":obj.html,"ex":ex}};
                }                
            } else if (obj.jsonstring) {
                //A JSON string which hasn't been parsed yet!
                try {
                    obj.object = JSON.parse(obj.jsonstring);
                } catch (ex) {
                    bar.tick();
                    return {"error":{"url":obj.url,"ex":ex}};
                }
            }
            return obj;
        } else {
            return done_message;
        }
    }
}
let next_object = object_generator(files);

//
// Express listener
// hands out id's based on a generator
const app = express();
app.get('/next', async function (req, res) {
    if (req.query.secret == secret) {
        let thing = null;
        while (!thing || thing.error) {
            thing = await next_object();
            if (thing.error) missing.push(thing.error);
        } 
        res.send(thing);
    } else {
        res.send(done_message);
    }
});
app.listen(5888);

//
//Spawn one child process per thread
for (let n = 0; n < threads; n++) {
    spawn_child(n);
}

