import fetch, { AbortError } from "node-fetch";

// AbortController was added in node v14.17.0 globally
const AbortController = globalThis.AbortController || await import('abort-controller');

export async function request(url,text,method){
    method = method || "GET";

    let response;

    if (method === "POST") {

        response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({text: text}),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

    } else {

        if (text && text.length) {
            url += "?" + new URLSearchParams({text:text}).toString();
        }

        response = await fetch(url);
    }

    try {
        const output = await response.json();
        return [null,output];
    } catch(ex) {
        const output = null;
        return [ex,output];
    }
}

export async function request_pair(url,text1,text2,method){
    method = method || "GET";

    let response;

    if (method === "POST") {

        response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({question:text1,context:text2}),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

    } else {

        if (text1 && text1.length && text2 && text2.length) {
            url += "?" + new URLSearchParams({question:text1,context:text2}).toString();
        }

        response = await fetch(url);
    }

    try {
        const output = await response.json();
        return [null,output];
    } catch(ex) {
        const output = null;
        return [ex,output];
    }
}

export async function request_html(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, 5000);
    let response = await fetch(url,{signal: controller.signal});
    try {
        if (response.status<400) {
            const output = await response.text();
            return [null,output];
        } else {
            return [output,null];
        }
    } catch(ex) {
        return [ex,null];
    }
}

export function slice_hosts(hosts,threads,thread_num) {

    if (!hosts || !hosts.length) return null;

    let queue = [];

    for(var i=thread_num;i<hosts.length;i+=threads) {
        queue.push(hosts[i]);
    }

    return queue;

}