import crypto from "crypto";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { request_html } from "./request.js";

export function string_to_uuid(str) {
    let key = crypto.createHash('md5').update(str).digest('hex');
    let hash = `${key.substring(0, 8)}-${key.substring(8, 12)}-${key.substring(12, 16)}-${key.substring(16, 20)}-${key.substring(20)}`;
    return hash;
}

function guess_field(doc,possibles) {
    let val="";
    for(let i=0;i<possibles.length;i++) {
        const p = possibles[i];
        if (p && p[0] && p[1]) {
            const found = doc.window.document.querySelector(p[0]);
            if (found && found[p[1]]) val = found[p[1]];
        }
    }
    return val;
}

export async function fetch_and_transform(url){
    let response = await request_html(url);
    if (!response[0] && response[1]) {
        try {
            let doc = new JSDOM(response[1], {url: url});
            let reader = new Readability(doc.window.document);
            let article = reader.parse();

            //Url
            let canonical = guess_field(doc,[
                ["link[rel=canonical]","href"],
                ["meta[property=\"og:url\"]","content"]
            ])||url;

            //Title
            let title = article.title;

            //Author
            let author = article.byline;

            //Description
            let description = article.excerpt;

            //Dates
            let published = guess_field(doc,[
                ["meta[property=\"article:published_time\"]","content"],
                ["meta[name=\"DC.date\"]","content"],
                ["meta[name=\"DC.created\"]","content"]
            ]);
            let modified = guess_field(doc,[
                ["meta[property=\"article:modified_time\"]","content"],
                ["meta[name=\"DC.modified\"]","content"]
            ]);

            //Image
            let image = guess_field(doc,[
                ["meta[property=\"og:image\"]","content"],
                ["meta[name=\"twitter.image\"]","content"]
            ]);

            //Article Text Content
            let lines = article.textContent.trim().split(/[\n]+/).map((str)=>str.trim());
            let body = lines.join('\n').trim().replace(/[\n]+/g,'\n');

            //Augment article content with Title and Description
            let bodylc = body.toLowerCase();
            if (description && bodylc.indexOf(description.toLowerCase())<0) {
                body = description + '\n' + body;
            }
            if (title && bodylc.indexOf(title.toLowerCase())<0) {
                body = title + '\n' + body;
            }

            //Identifier
            let id = string_to_uuid(canonical);

            let obj = {
                "id":id,
                "url":canonical,
                "title":title,
                "author":author,
                "description":description,
                "published":published,
                "modified":modified,
                "image":image,
                "text": body
            }

            return [null,obj];

        } catch (ex) {

            return [ex,null];
            
        }

    }
    return response;
}

/*
Example of some metadata fields to use as a basic reference
<title>MAX.IO</title>
<meta name="description" content="Instantly spin up a low-latency microservice for your NLP models.  We believe integrating AI should be predictable, easy, and freely scalable.  We built Mighty Inference Server to take the pain out of model hosting and performance tuning, to automatically give you the highest possible throughput, to empower you to scale with predictable costs, on your terms in your stack.">
<meta property="og:locale" content="en_US" />
<meta property="og:type" content="website" />
<meta property="og:title" content="Mighty Inference Server - the best way to deploy AI models" />
<meta property="og:description" content="Instantly spin up a low-latency microservice for your NLP models.  We believe integrating AI should be predictable, easy, and freely scalable.  We built Mighty Inference Server to take the pain out of model hosting and performance tuning, to automatically give you the highest possible throughput, to empower you to scale with predictable costs, on your terms in your stack." />
<meta property="og:url" content="https://max.io/" />
<meta property="og:site_name" content="MAX.IO" />
<meta property="article:published_time" content="2022-02-11T10:10:10+00:00" />
<meta property="article:modified_time" content="2022-02-11T10:10:10+00:00" />
<meta property="og:image" content="https://max.io/img/hero-social.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="675" />
<meta property="og:image:type" content="image/jpeg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:creator" content="@binarymax" />
<meta name="twitter:site" content="@binarymax" />
<meta name="twitter:label1" content="Est. reading time" />
<meta name="twitter:data1" content="2 minutes" />
<meta name="twitter:image" content="https://max.io/img/hero-social.jpg" />
*/