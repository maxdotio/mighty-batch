import fs from "fs";
import crypto from "crypto";
import Sitemapper from "sitemapper";

export function clean_filename(filename) {
    return filename.replace(/[:\/\.]+/g,'_')
}

export function string_to_uuid(str) {
    let key = crypto.createHash('md5').update(str).digest('hex');
    let hash = `${key.substring(0, 8)}-${key.substring(8, 12)}-${key.substring(12, 16)}-${key.substring(16, 20)}-${key.substring(20)}`;
    return hash;
}

export function get_files(files_path,min,max) {
    const files = [];
    let out = "vectors/"+clean_filename(files_path)+"/";
    fs.mkdirSync(out, { recursive: true });
    let filenames = fs.readdirSync(files_path);
    min = min||0;
    max = max||filenames.length;    
    for(var i=min;i<max;i++) {
        if(filenames[i].indexOf(".json")>0) {
            files.push({
                "file":i,
                "filename":files_path + '/' + filenames[i],
                "outfile":out + filenames[i]
            });
        }
    }
    return files;
}

export function get_parts(min,max) {
    const files = [];
    for(let i = (min||1); i <= (max||50); i++) {
        if (i!=35) {
            let path = "parts/"+i+"/";
            let out = "vectors/"+i+"/";
            fs.mkdirSync(out, { recursive: true });
            let parts = fs.readdirSync(path);
            for(var j=0;j<parts.length;j++) {
                if(parts[j].indexOf(".json")>0) {
                    files.push({
                        "title":i,
                        "filename":path + parts[j],
                        "outfile":out + parts[j]
                    });
                }
            }
        }
    }
    return files;
}

export function get_json(filename,min,max) {
    let json = JSON.parse(fs.readFileSync(filename,"utf-8"));
    let files = []
    min = min||0;
    max = max||json.length;
    let out = `vectors/${filename}/`;
    fs.mkdirSync(out, { recursive: true });
    for(let i = min; i <= max; i++) {
        files.push({
            "idx":i,
            "object":json[i],
            "outfile":`${out}${i}.json`
        });
    }
    return files;
}

export async function get_sitemap(filename,min,max) {
    const sitemap = new Sitemapper();
    let sites = await sitemap.fetch(filename);
    let files = [];
    let out = `vectors/${filename.replace(/[:\/]+/g,'_')}/`;
    min = min||0;
    max = max||sites.sites.length;
    fs.mkdirSync(out, { recursive: true });
    for(let i = min; i <= max; i++) {
        files.push({
            "idx":i,
            "url":sites.sites[i],
            "outfile":`${out}${i}.json`
        });
    }
    return files;
}

export async function get_urls(filename,min,max) {
    const sitemap = new Sitemapper();
    let urls = fs.readFileSync(filename,"utf-8").split('\n');
    let files = [];
    let out = `vectors/${filename.replace(/[:\/]+/g,'_')}/`;
    min = min||0;
    max = max||urls.length;
    fs.mkdirSync(out, { recursive: true });
    for(let i = min; i <= max; i++) {
        files.push({
            "idx":i,
            "url":urls[i],
            "outfile":`${out}${i}.json`
        });
    }
    return files;
}

export function total_files(min,max) {
    return get_parts(min,max).length;
}

export function batch(n,min_folder,max_folder) {

    const files = get_parts(min_folder,max_folder);

    let batches = Array.apply(null, Array(n)).map(()=>[]);

    for(var i=0,j=-1;i<files.length;i++) {
        if(++j>=n) j = 0;
        batches[j].push(files[i]);
    }

    return batches;

}

export function slice(threads,thread_num,min_folder,max_folder) {

    const files = get_parts(min_folder,max_folder);

    let queue = [];

    for(var i=thread_num;i<files.length;i+=threads) {
        queue.push(files[i]);
    }

    return queue;

}

export function mini_batch(workers,files) {
    let batches = Array.apply(null, Array(workers)).map(()=>[]);

    for(var i=0,j=-1;i<files.length;i++) {
        if(++j>=workers) j = 0;
        batches[j].push(files[i]);
    }

    return batches;
}


export function get_lines(filename,max) {
    let text = fs.readFileSync(filename,"utf-8");
    return text.split('\n');
}
