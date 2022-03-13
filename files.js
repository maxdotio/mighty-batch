import fs from "fs";

function get_files() {
    const files = [];
    let k=0;
    for(let i = 1; i <= 2; i++) {
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

export function batch(n) {

    const files = get_files();

    let batches = Array.apply(null, Array(n)).map(()=>[]);

    for(var i=0,j=-1;i<files.length;i++) {
        if(++j>=n) j = 0;
        batches[j].push(files[i]);
    }

    return batches;

}