//import http from "http";
import fetch from "node-fetch";

//const http_agent = new http.Agent({ keepAlive: true });

//process.setMaxListeners(100);

export async function request(url,text){//,agent) {
    //agent = agent||http_agent;
    let response = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({text: text}),
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        //,agent
    });

    try {
        const output = await response.json();
        return [null,output];
    } catch(ex) {
        const output = null;
        return [ex,output];
    }
}