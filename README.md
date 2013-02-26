jtl2json
================

jtl2json is nodejs based tool for jMeter *.jtl log files parsing and converting into JSON. Calculates min, max, average and median values for latency and the error rate.

Installing
------------------------------------------------
- install [node.js](http://nodejs.org/download/) and make sure node and npm work correctly
- `git clone git@github.com:azarichnyi/jtl2json.git` - clone repository
- in project folder `npm install` - install required packages 

Usage
------------------------------------------------

Application requires input *.jtl (or *.xml) file and output *.json file

Use ```--jtl [jmeter jtl file name]``` or ```--csv [jmeter csv file name]```to specify input file (mandatory).
Use ```--json [output json file name]``` to specify output JSON file name (temporary mandatory). You can
use ```--summary [summary html file]``` to generate test summary in HTML format.
###Examples of usage:

	node app.js --jtl jMeterOutputJtl.jtl --json outputJson.json --summary summaryHtml.html
	node app.js --csv jMeterOutputCsv.csv --json outputJson.json --summary summaryHtml.html
	node app.js --csv jMeterOutputCsv.csv --json outputJson.json 

