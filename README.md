# mighty-batch

A concurrent application to parallelize Mighty Inference Server inference processing of bulk content.  Easily get emeddings, classifications, or questions answered for JSON documents or HTML files.  Designed for speed and flexibility.

# Prerequisites

Requires Node.js v16 or greater.

Tested on Linux and MacOS.

# Installation

Install it globally and use it as a command line application:

```bash
npm install -g mighty-batch
mighty-batch --help
```

# Example command

This command will run a total of 128 concurrent inference requests for the text property in each of the json objects in the list found in my_documents.json, each request will be sent to a port on http://173.50.0.1, between ports 5050 and 5178...

```bash
mighty-batch --threads 32 --workers 4 --host 173.50.0.1 --json my_documents.json --property text
```

...The host needs to have a running Mighty Inference Server cluster running with as many ports open as (threads * workers).

# Help

Here are the command line options and their explanations when running `mighty-batch --help`

```bash
Usage: index [options]

Options:
  -t, --threads <number>     Number of CPU threads to use. This is also the number of processes that will run (one per thread). (default: 2)
  -w, --workers <number>     Number of asyncronous workers to use per thread process. (default: 2)
  -h, --host <string>        The address of the server where requests will be sent. (default: "localhost")
  -H, --hosts <string>       A comma separated list of hosts where requests will be sent. (default: null)
  -x, --max <number>         The maximum number of objects to send to the server. (default: 0)
  -j, --json <string>        The filename of a JSON list of objects. (default: null)
  -l, --jsonl <string>       The filename of a JSON lines list of objects. (default: null)
  -M, --html <string>        The path to the HTML files. (default: null)
  -f, --files <string>       The path to the JSON files. (default: null)
  -s, --sitemap <string>     The sitemap.xml file location. (default: null)
  -p, --property <string>    The JSON property to convert. (default: null)
  -m, --method <string>      GET (default) or POST (default: "GET")
  --save-jsonl <string>      Saves intermediary HTML or Sitemap output to JSONL (default: null)
  --embeddings                (default: false)
  --sentence-transformers     (default: false)
  --question-answering        (default: false)
  --sequence-classification   (default: false)
  --token-classification      (default: false)
  --visual                    (default: false)
  --help                     display help for command
```

# JSON and JSONL

Mighty-batch can process both JSON and JSONL files.  Specify the `--property` for which data in the JSON object should be sent to Mighty.

## JSON:

```bash
mighty-batch --threads 8 --workers 4 --host 173.50.0.1 --json path_to_my_json_file --property text --sentence-transformers
```

## JSONL:

```bash
mighty-batch --threads 8 --workers 4 --host 173.50.0.1 --html path_to_my_jsonl_file --property text --sentence-transformers
```

# HTML

If you want to process many HTML files, specify the path using the `--html` argument and Mighty-batch will recursively find all `.html` or `.htm` files in that path.  The content from each file will be extracted using a text reader and convert the file to JSON, and inference the text specified using the `--property`, but it is recommended to use the `text` property.

```bash
mighty-batch --threads 8 --workers 4 --host 173.50.0.1 --html path_to_my_files --property text --sentence-transformers
```

The following properties are available when the reader conversion is made:

- __docid__ - a UUID made from the canonical URL 
- __url__ - the canonical URL
- __title__ - the most likely title of the HTML document
- __author__ - the most likely author of the HTML document (if any)
- __description__ - the discription (if any)
- __published__ - the date the HTML file was published
- __modified__ - the date the HTML file was last modified
- __image__ - a URL of the social media image (if any)
- __text__ - the plain text of the title, description, and body that should be used for inference

# Files

If you have more than one JSON file, specify a path containing the JSON files, and all the files in that path will be processed.  sent to Mighty for processing.  Just like [JSON](#json), you need to specify the `--property` for which data in the JSON object should be sent to Mighty.

```bash
mighty-batch --threads 8 --workers 4 --host 173.50.0.1 --files path_to_my_json_files --property text --sentence-transformers
```

# Sitemap

You can scrape a site and convert the text of each web page by providing a sitemap.xml URL path.

```bash
mighty-batch --threads 8 --workers 4 --host 173.50.0.1 --sitemap https://example.com/sitemap.xml --property text --sentence-transformers
```

Once a sitemap specified HTML file is downloaded, it is converted and inferenced using the method described above in [HTML](#html)

# Multiple Hosts

It is possible to specify multiple hosts that are running Mighty, separated by commas.  In single host mode (-h, --host) you only need to specify the mighty server address and the port numbers will be assigned and provided by mighty-batch.

```bash
mighty-batch --threads 1 --workers 2 --hosts http://173.50.0.1:5050,http://173.50.0.2:5050 #...
```

You must remember to include the full protocol, hostname, and port, for each host listed.  Also remember that `threads * workers` must match the number of hosts provided.

# Question Answering

Question answering works the same, but requires two properties for the question and context.  This is easy to do, just provide both in the `--property` argument as comma separated.  For example, if the JSON objects has a property `question` and another property `text`, the command would be similar to this:

```bash
mighty-batch --property question,text --question-answering #...
```

# Background

Initially developed to work with https://github.com/maxdotio/ecfr-prepare

See this blog post for more information: https://max.io/blog/encoding-the-federal-register.html
