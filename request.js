import fetch from "node-fetch";

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