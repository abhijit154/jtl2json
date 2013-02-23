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

    var doc = new dom().parseFromString(data);
    var nodes = xpath.select("//httpSample", doc);

    //ToDo: refactor this to work with stream (after test suite would be implemeted)
    fs.writeFileSync('rawdata.csv','label;Latency;success;responseCode','utf-8');
    nodes.forEach(function(entry) {
        var tmpdoc = new dom().parseFromString(entry.toString());
        var raw = '\n' 
                + xpath.select1("//@lb", tmpdoc).value + ';'  
                + xpath.select1("//@lt", tmpdoc).value + ';' 
                + xpath.select1("//@s", tmpdoc).value + ';' 
                + xpath.select1("//@rc", tmpdoc).value + ';';

        try {
            fs.appendFileSync('rawdata.csv', raw, 'utf-8');
        } catch (err) {
            throw err;
        }  
    });

    fs.readFile(__dirname + '/rawdata.csv', 'utf-8', parseCsv);
}

//layer1
function parseCsv(err, data) {
    var lines = data.replace().split("\n");
    var schema = lines[0];
    
    lines.splice(0,1);
    schema = schema.split(";");

    var res = [];

    lines.forEach(function(line){
        var valArr = line.split(";");

        var piece = {};
        piece.endpoint = valArr[schema.indexOf('label')];
        piece.latency = valArr[schema.indexOf('Latency')];
        piece.succesful = valArr[schema.indexOf('success')];
        piece.rc = valArr[schema.indexOf('responseCode')];

        if (piece.endpoint && piece.latency) res.push(piece);  
    });

    parsedData(null, res);

    //ToDo: REMOVE THIS when moved to streaming
    try {
        fs.writeFileSync(__dirname + '/rawdata.csv', '' ,'utf-8')    
    } catch (err) { 
        throw err 
    }
}

function parsedData(err, parsedData){
    try {
        fs.writeFileSync(__dirname + '/' + jsonFileName, JSON.stringify(dataGrouper(parsedData, ["endpoint"]),null,2), 'utf-8');    

        if (nconf.get('summary')) {
            fs.writeFileSync(__dirname + '/' + nconf.get('summary'), JSON.stringify(dataGrouper(parsedData, ["endpoint"], true),null,2), 'utf-8');    
        }
    } catch (err) {
        throw err;
    }
}

var _ = require('underscore');

var dataGrouper = (function() {
    var group = function(data, names, summaryOnly) {
        var stems = keys(data, names);
       
        return (typeof summaryOnly == 'undefined' || summaryOnly === false)  ? _.map(stems, function(stem) {
            var vls = _.map(_.where(data, stem), function(item) {
                    return _.omit(item, names);
                });
            
            var maxVal = {};
            maxVal.max = max(vls);

            var minVal = {};
            minVal.min = min(vls);

            var avgVal = {};
            avgVal.avg = sum(vls) / vls.length;

            var medianVal = {};
            medianVal.median = med(vls);

            var errVal = {};
            errVal.errors = sumErrors(vls) / vls.length; 

            return {
                key: _.extend({}, stem, maxVal, minVal, avgVal, medianVal, errVal),
                vals: vls
            };
        }) : _.map(stems, function(stem) {
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

            return {
                key: _.extend({}, stem, maxVal, minVal, avgVal, medianVal, errVal),
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