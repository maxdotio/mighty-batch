import fs from "fs";

export function get_files(min,max) {
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

export function total_files(min,max) {
    return get_files(min,max).length;
}

export function batch(n,min_folder,max_folder) {

    const files = get_files(min_folder,max_folder);

    let batches = Array.apply(null, Array(n)).map(()=>[]);

    for(var i=0,j=-1;i<files.length;i++) {
        if(++j>=n) j = 0;
        batches[j].push(files[i]);
    }

    return batches;

}

export function slice(threads,thread_num,min_folder,max_folder) {

    const files = get_files(min_folder,max_folder);

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
