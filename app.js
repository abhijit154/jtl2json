var xpath = require('xpath')
      , dom = require('xmldom').DOMParser
      , fs = require('fs');
	
//layer0
fs.readFile(__dirname + '/foo.xml', 'utf-8', function(err, data) {
	var doc = new dom().parseFromString(data);
	var nodes = xpath.select("//httpSample", doc);

	nodes.forEach(function(entry) {
	    var tmpdoc = new dom().parseFromString(entry.toString());
	    var raw = xpath.select1("//@lb", tmpdoc).value + ';'  
	    		+ xpath.select1("//@lt", tmpdoc).value + ';' 
	    		+ xpath.select1("//@s", tmpdoc).value + ';' 
	    		+ xpath.select1("//@rc", tmpdoc).value + ';\n';
    	
    	fs.appendFileSync('rawdata.csv', raw, 'utf-8',function (err) {
  			if (err) throw err;
		});
	});
});
//layer1
fs.readFile(__dirname + '/rawdata.csv', 'utf-8', gotFile);

function gotFile(err, data) {
    var lines = data.replace().split("\n");
    var res = [];
    //ToDo: refactor hardcode ?
    lines.forEach(function(line){
        var valArr = line.split(",");
        var piece = {};
        piece.endpoint = valArr[0];
        piece.latency = valArr[1];
        piece.succesful = valArr[2];
        piece.rc = valArr[3];
        res.push(piece);       
    });

    parsedData(null, res);
}

function parsedData(err, parsedData){
	console.log(JSON.stringify(dataGrouper(parsedData, ["endpoint"]),null,2));
}

var _ = require('underscore');

var dataGrouper = (function() {
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

    var group = function(data, names) {
        var stems = keys(data, names);
        return _.map(stems, function(stem) {
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
        });
    };

	var max = function(items){
		return _.reduce(items, function(memo, item) {
                return Math.max(memo, Number(item.latency)); //ToDo: recfactor hardcode 
            }, Number.NEGATIVE_INFINITY);
	}

	var min = function(items) {
		return _.reduce(items, function(memo, item) {
                return Math.min(memo, Number(item.latency)); //ToDo: recfactor hardcode 
            }, Number.POSITIVE_INFINITY);

	}

    var med = function(items) {
    	items = _.toArray(items);
     	items = _.sortBy(items, function(item) { return Number(item.latency) });
     	//ToDo: refactor hardcode
   		return items.length > 0 ? (items.length & 1) ? Number(items[items.length>>>1].latency) : (Number(items[(items.length>>>1)-1].latency) + Number(items[items.length>>>1].latency))/2  : null;
	}

	var sum = function(items) {
		return _.reduce(items, function(memo, item) {
			//ToDo: refactor hardcode
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
