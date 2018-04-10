var fs = require('fs');
var readline = require('readline');

module.exports = function (file) {
	var self = this;
	
	this.addRecord = function (key, data, cb) {
		fs.appendFile(file, key + "\n" + JSON.stringify(data) + "\n", (err) => {
			if (err) throw err;
			
			cb();
		});
	};
	
	
	
	this.queryKey = function (key, cb) {
		fs.stat(file, function (err) {
			var data = [];
			
			if (err) {
				cb(data);
				return;
			}
			
				
			var lineReader = readline.createInterface({
				input: fs.createReadStream(file)
			});
			
			var lineCount = 0;
			var addToData = false;
			
			lineReader.on('line', function (line) {
				if (lineCount%2 === 0 && line === key) {
					addToData = true;
				}
				else if (addToData) {
					data.push(JSON.parse(line));
					
					addToData = false;
				}
				
				lineCount++;
			});
			
			lineReader.on('close', function () {
				cb(data);
			});
		});
		
	};
	
	this.lastFromKeys = function (cb) {
		fs.stat(file, function (err) {
			var data = {};
			
			if (err) {
				cb(data);
				return;
			}

			var lineReader = readline.createInterface({
				input: fs.createReadStream(file)
			});

			var lineCount = 0;
			var addToKey = false;
			
			lineReader.on('line', function (line) {
				if (lineCount%2 === 0) {
					addToKey = line;
				}
				else if (addToKey) {
					data[addToKey] = line;
				}
				
				lineCount++;
			});
			
			lineReader.on('close', function () {
				for (var i in data) {
					data[i] = JSON.parse(data[i]);
				}
				
				cb(data);
			});
		});
	};
};



/*
datFile.addRecord("abc", {"date": new Date(), "value": "abc"}, function () {
	console.log("add");
	datFile.queryKey("abc", function (d) {
		console.log("queryKey");
		console.log(d);
		datFile.lastFromKeys(function (d) {
			console.log("lastFromKeys");
			console.log(d);
		});
	});	
});
*/