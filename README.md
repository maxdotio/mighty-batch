# mighty-batch

A concurrent application to parallelize Mighty Inference Server processing of bulk content.

Currently in proof-of-concept stage to work with https://github.com/maxdotio/ecfr-prepare

See the blog post for more information: 

# Installation

Requires Node.js v16: https://github.com/nvm-sh/nvm

```bash
git clone https://github.com/maxdotit/mighty-batch
cd mighty-batch
npm install
```

# Example command

See the blog post for now, but this command will run 32 threads (-t 32), with 4 workers each (-w 4), with enough Mighty servers running at 173.50.0.1:
```
node index.js -t 32 -w 4 -h 173.50.0.1
```

# Help

Here are the command line options and their explanations

```bash
$>node index.js --help
Usage: index [options]

Options:
  -t, --threads <number>  Number of CPU threads (processes) to use. (default: 2)
  -w, --workers <number>  Number of asyncronous workers to use per thread process. (default: 2)
  -h, --host <string>     The IP address of the server where requests will be sent. (default: "127.0.0.1")
  -x, --max <number>      The maximum number of objects to send to the server. (default: send eveything)
  --help                  display help for command
```
