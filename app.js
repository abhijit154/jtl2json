var xpath = require('xpath')
      , dom = require('xmldom').DOMParser
      , fs = require('fs');

var nconf = require('nconf');

nconf.argv();

if (!(nconf.get('jtl') || nconf.get('csv'))) {
    throw new Error('No input file. Use --jtl or --csv')
}

var jsonFileName = nconf.get('json') || 'results.json';

if (nconf.get('csv'))  {
    fs.readFile(__dirname + '/'+nconf.get('csv'), 'utf-8', parseCsv);
} else {
    fs.readFile(__dirname + '/'+nconf.get('jtl'), 'utf-8', parseXml);    
}
	
//layer0
function parseXml(err, data) {
    if (err) throw err; //ToDo refactor error handling

    var xmlDoc = new dom().parseFromString(data);
    var xmlNodes = xpath.select("//httpSample", xmlDoc);

    var parsedXml = [];

    xmlNodes.forEach(function(entry) {
        var tmpdoc = new dom().parseFromString(entry.toString());

        var entry = {};
        entry.endpoint = xpath.select1("//@lb", tmpdoc).value;
        entry.latency = xpath.select1("//@lt", tmpdoc).value;
        entry.succesful = xpath.select1("//@s", tmpdoc).value;
        entry.rc = xpath.select1("//@rc", tmpdoc).value;
        entry.ts = xpath.select1("//@ts", tmpdoc).value;

        parsedXml.push(entry);
    });

    aggregateData(null, parsedXml);
}

//layer1
function parseCsv(err, data) {
    var lines = data.replace().split("\n");
    var schema = lines[0];
    
    lines.splice(0,1);
    schema = schema.split(";");

    var parsed = [];

    lines.forEach(function(line){
        var valArr = line.split(";");

        var entry = {};
        entry.endpoint = valArr[schema.indexOf('label')];
        entry.latency = valArr[schema.indexOf('Latency')];
        entry.succesful = valArr[schema.indexOf('success')];
        entry.rc = valArr[schema.indexOf('responseCode')];
        entry.ts = valArr[schema.indexOf('timeStamp')];

        if (entry.endpoint && entry.latency) parsed.push(entry);  
    });

    aggregateData(null, res);
}


var _ = require('underscore');

function aggregateData(err, parsedData){
    var aggData = dataGrouper(parsedData, ["endpoint"]);
    var summary = _.map(aggData, function(element){
        return element.key;
    });
    
    try {
        fs.writeFileSync(__dirname + '/' + jsonFileName, JSON.stringify(aggData,null,2), 'utf-8');    
      
        if (nconf.get('summary')) {
            var summaryFileName = nconf.get('summary');
          
            fs.writeFileSync(__dirname + '/' + summaryFileName, '<html><table border="1"><tr><td>endpoint</td><td>samples</td><td>min</td><td>max</td><td>avg</td><td>median</td><td>%erros</td></tr>', 'utf-8');
            summary.forEach(function(item){
                fs.appendFileSync(__dirname + '/' + summaryFileName, '<tr><td>'.concat(
                    item.endpoint, '</td><td>',
                    item.samples, '</td><td>',
                    item.min, '</td><td>',
                    item.max, '</td><td>',
                    Math.round(item.avg*100)/100,'</td><td>',
                    Math.round(item.median*100)/100 ,'</td><td>',
                    item.errors,
                    '</td></tr>'), 'utf-8');
            });
            fs.appendFileSync(__dirname + '/' + summaryFileName, '</table></html>', 'utf-8');
        }
    } catch (err) {
        throw err;
    }
}

var dataGrouper = (function() {
    var group = function(data, names, summaryOnly) {
        var stems = keys(data, names);
       
        return _.map(stems, function(stem) {
            var vls = _.map(_.where(data, stem), function(item) {
                    return _.omit(item, names);
                });
            
            var maxVal = {};
            maxVal.max = _.max(vls, function(vals){return Number(vals.latency)}).latency;

            var minVal = {};
            minVal.min = _.min(vls, function(vals){return Number(vals.latency)}).latency;

            var avgVal = {};
            avgVal.avg = sum(vls) / vls.length;

            var medianVal = {};
            medianVal.median = med(vls);

            var errVal = {};
            errVal.errors = sumErrors(vls) / vls.length; 

            var sampVal = {};
            sampVal.samples = vls.length;

            return {
                key: _.extend({}, stem, sampVal, maxVal, minVal, avgVal, medianVal, errVal),
                vals: vls
            };
        });
    };

    var has = function(obj, target) {
        return _.any(obj, function(value) {
            return _.isEqual(value, target);
        });
    };

    var keys = function(data, names) {
        return _.reduce(data, function(memo, item) {
            var key = _.pick(item, names);
            if (!has(memo, key)) {
                memo.push(key);
            }
            return memo;
        }, []);
    };

    //median value
    var med = function(items) {
    	items = _.toArray(items);
     	items = _.sortBy(items, function(item) { return Number(item.latency) });
     	//ToDo: refactor hardcoded latency
   		return items.length > 0 ? (items.length & 1) ? Number(items[items.length>>>1].latency) : (Number(items[(items.length>>>1)-1].latency) + Number(items[items.length>>>1].latency))/2  : null;
	}

	var sum = function(items) {
		return _.reduce(items, function(memo, item) {
			//ToDo: refactor hardcoded latency
			return memo + Number(item.latency)
		}, 0);
	}

	var sumErrors = function(items) {
		return _.reduce(items, function(memo, item) {
			return item.succesful =="false" ? memo+1 : memo;
		}, 0)
	}

    group.register = function(name, converter) {
        return group[name] = function(data, names) {
            return _.map(group(data, names), converter);
        };
    };

    return group;
}());
//layer 3