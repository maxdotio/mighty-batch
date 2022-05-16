# mighty-batch

A concurrent application to parallelize Mighty Inference Server processing of bulk content.

# Installation

Requires Node.js v16: https://github.com/nvm-sh/nvm

```bash
npm install -g mighty-batch
```

# Example command

This command will run a total of 128 concurrent inference requests for the text property in each of the json objects in the list found in my_documents.json

```
mighty-batch --threads 32 --workers 4 --host 173.50.0.1 --json my_documents.json --property text
```

# Help

Here are the command line options and their explanations

```bash
$>node index.js --help
Usage: index [options]

Options:
  -t, --threads <number>   Number of CPU threads to use.  This is also the number of processes that will run (one per thread). (default: 2)
  -w, --workers <number>   Number of asyncronous workers to use per thread process. (default: 2)
  -h, --host <string>      The IP address of the server where requests will be sent. (default: "127.0.0.1")
  -x, --max <number>       The maximum number of objects to send to the server. (default: 0)
  -j, --json <string>      The filename of a JSON list of objects. (default: null)
  -s, --sitemap <string>   The URL of a sitemap XML file to be crawled and inferred. (default: null)
  -p, --property <string>  The JSON property to convert (requires --json). (default: null)
  --help                   display help for command

```

# Background

Initially developed to work with https://github.com/maxdotio/ecfr-prepare

See this blog post for more information: https://max.io/blog/encoding-the-federal-register.html
