/**
  * get arguments and validate them!
  **/
var processArguments = {
	"verbose": false,
};

if (process.argv[2]) {
	try {
		var data = JSON.parse(process.argv[2]);
		
		for (var i in processArguments) {
			if (data[i]) {
				processArguments[i] = data[i];
			}
		}
		
		for (var i in data) {
			if (!processArguments[i]) {
				console.log("undefined key: " + i);
			}
		}
		
	}
	catch (e) {
		console.log("expected argument to be JSON");
	}
}


processArguments.verbose = (processArguments.verbose === true);



/**
  * default init
  **/
var fs = require('fs');

var hardwarePath = "../hardware/";  



/**
  * GET HARDWARE CONFIG DEFINITION
  **/
var hardwareConfigForms = {};
function getHardwareConfig (name) {
	fs.stat(hardwarePath + name + "/wizard.json", function (err) {
		var config = {};
		if (!err) {
			config = require(hardwarePath + name + "/wizard.json");
		}
		
		hardwareConfigForms[name] = config;
	});
}

function scanHardwarePath () {
	fs.readdir(hardwarePath, function (err, data) {
		if (!err) {
			hardwareConfigForms = {};
			
			for (var i = 0; i < data.length; i ++) {
				getHardwareConfig(data[i]);
			}
			
			if (dataUpdate) {
				dataUpdate({
					"hardwareConfigForms": hardwareConfigForms
				});
			}
		}
	});
}

scanHardwarePath();



/**SPAWN JS FILE**/
var initJsFile = require("./source/initJsFile.js");

/**
  * INIT DATABASE
  **/
var sqlite3 = require('sqlite3').verbose();

var db = new sqlite3.Database('../home-ui.db');



function validateTable (tableName, columns, cb) {
	var sql = [];
		sql.push("CREATE TABLE IF NOT EXISTS `" + tableName + "` (");
		
		var colSql = [];
		for (var column in columns) {
			colSql.push("`" + column + "` " + columns[column]);
		}
		
		sql.push(colSql.join(",\n"));
		
		sql.push(")");
		
	db.run(sql.join("\n"));
	
	var alterQuery = [];
	db.each("PRAGMA table_info(" + tableName + ")", function(err, row) {
		if (err) {
			throw err;
		}
		
		if (row.name !== "id") {
			if (columns[row.name]) {
				var sqlTypeString = row.type;
				
				if (columns[row.name] !== sqlTypeString) {
					console.log("NOTICE CAN'T MODIFY COLUMN", tableName + "." + row.name);
					//db.run("ALTER TABLE " + tableName + " MODIFY COLUMN " + row.name + " " + columns[row.name]);
				}
				
				delete columns[row.name];
			}
			else {
				console.log("NOTICE CAN'T REMOVE DANGLING COLUMN", tableName + "." + row.name);
			}
		}
	}, function () {		
		for (var column in columns) {
			db.run("ALTER TABLE " + tableName + " ADD COLUMN " + column + " " + columns[column]);
		}
		
		cb();
	});
}

function validateTables (tables, cb) {
	var count = 0;
	var expCount = 1;
	
	function checkCb () {
		count ++;
		if (count === expCount) {
			cb();
		}
	};
	
	for (var i in tables) {
		expCount ++;
		validateTable(i, tables[i], checkCb);
	}
	
	checkCb();
}

var activeHardware = {};
var activeHardwareProcess = {};
function startHardwareInterface (hardwareId) {
	var data = activeHardware[hardwareId];
	
	activeHardwareProcess[hardwareId] = initJsFile("../hardware/" + data.type + "/index.js", {
		"config": data,
		"onOutputEvent": function (log, error) {
			if (!log) {
				return;
			}
			
			db.run("INSERT INTO hardwareLogs(hardware_id, date, data, error) VALUES (?, ?, ?, ?)", [
				hardwareId,
				parseInt(new Date().getTime() / 1000),
				log,
				(error? 1 : 0)
			]);
			
		},
		"verbose": processArguments.verbose
	});
}

var deviceValues = {};

db.serialize(function () {
	validateTables({
		"hardware": {
			"name": "VARCHAR(255)",
			"type": "VARCHAR(255)",
			"config": "TEXT"
		},
		"hardwareLogs": {
			"hardware_id": "INT(11)",
			"date": "INT(11)",
			"data": "TEXT",
			"error": "INT(1)"
		}
	}, function () {
		db.all("SELECT rowid, name, type, config FROM hardware", function (err, hardware) {
			for (var i = 0; i < hardware.length; i ++) {
				activeHardware[hardware[i].rowid] = {
					"name": hardware[i].name,
					"type": hardware[i].type,
					"config": JSON.parse(hardware[i].config)
				};
				
				startHardwareInterface(hardware[i].rowid);
			}
			 
			dataUpdate({
				"activeHardware": activeHardware
			});
		});
	});
	
	
	validateTables({
		"device": {
			"name": "VARCHAR(255)",
			"group": "VARCHAR(255)",
			"type": "VARCHAR(255)"
		},
		"deviceValues": {
			"deviceId": "INT(11)",
			"timestamp": "INT(11)",
			"value": "INT(3)",
			
		}
	}, function () {
		var initQuery = ["SELECT device.rowid, `name`, `group`, `type`, deviceValues.value FROM device"];
		initQuery.push("INNER JOIN deviceValues ON deviceValues.deviceId = device.rowid");
		initQuery.push("INNER JOIN (select max(rowid) as maxrowid from deviceValues group by deviceId) lastItem ON lastItem.maxrowid = deviceValues.rowid");
		
		db.all(initQuery.join(" "), function (err, devices) {
			for (var i = 0; i < devices.length; i ++) {
				deviceValues[devices[i].rowid] = {
					"name": devices[i].name,
					"type": devices[i].type,
					"group": devices[i].group,
					"value": devices[i].value
				};
			}
							
			dataUpdate({
				"deviceValues": deviceValues
			});
		});
	});
});

/**webserver**/
var bodyParser = require("body-parser");
var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(8123);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'))

io.on('connection', function (socket) {
	socket.emit("dataUpdate", {
		"activeHardware": activeHardware,
		"hardwareConfigForms": hardwareConfigForms,
		"deviceValues": deviceValues
	});
});

function dataUpdate (data) {
	io.emit("dataUpdate", data);
	
	netBroadcast(JSON.stringify(data));
}

/**
  * internal update socket
  **/
var net = require("net");

var clients = [];
function netBroadcast(message) {
	for (var i = 0; i < clients.length; i++) {
		clients[i].write(message);
	}
}
  
var server = net.createServer(function(socket) {
	socket.name = socket.remoteAddress + ":" + socket.remotePort;
	
	socket.on("error", function (err) {
		for (var i = 0; i < clients.length; i ++) {
			if (clients[i] === socket) {
				clients.splice(i, 1);
				break;
			}
		}
	});

	
	clients.push(socket);
}).listen("8124");

  
/**
  * api 
  **/
app.delete("/api/hardware/:id", function (req, res) {
	var id = req.params.id;
	//TODO verify is number
		
	if (activeHardwareProcess[id]) {
		activeHardwareProcess[id].kill();
		delete activeHardwareProcess[id];
	}

	delete activeHardware[id];

	db.run("DELETE FROM hardware WHERE rowid = " + id);

	dataUpdate({
		"activeHardware": activeHardware
	});

	res.end("true");
});

app.post("/api/hardware/", function (req, res) {
	var data = req.body;
	//TODO verify the data
	
	if (data.name && data.type && data.config) {		
		db.run("INSERT INTO hardware(name, type, config) VALUES (?, ?, ?)", [
			data.name,
			data.type,
			JSON.stringify(data.config)
		]);

		db.all("SELECT max(rowid) as id FROM hardware", function (err, res) {
			activeHardware[res[0].id] = data;
			startHardwareInterface(res[0].id);
			
			dataUpdate({
				"activeHardware": activeHardware
			});
		});
		
		res.end("true");
	}
	res.end("false");
});

app.get("/api/hardware/:id/logs", function (req, res) {
	var id = req.params.id;
	
	db.all("SELECT date, data, error FROM hardwareLogs WHERE hardware_id = ? AND date >= ? ORDER BY rowid DESC", [
		id,
		(parseInt(new Date().getTime() / 1000) - 86400)
	], function (err, result) {
		res.end(JSON.stringify(result));
	});
});

app.post("/api/device/", function (req, res) {
	var data = req.body;
	//TODO verify the data
	
	for (var id in deviceValues) {
		if (deviceValues[id].name === data.name && deviceValues[id].type === data.type) {
			res.end(id);
			return;
		}
	}
	
	db.run("INSERT INTO device(`name`, `type`, `group`) VALUES (?,?, '')", [
		data.name,
		data.type
	]);
	
	db.all("SELECT rowid FROM device WHERE name = ? AND type = ?", [
		data.name,
		data.type
	], function (err, result) {
		if (result.length > 0) {
			db.run("INSERT INTO deviceValues(deviceId, value, timestamp) VALUES(?,?,?)", [
				result[0].rowid,
				0,
				parseInt(new Date().getTime() / 1000)
			]);
			
					
			deviceValues[result[0].rowid] =  {
				"name": data.name,
				"type": data.type,
				"group": '',
				"value": 0
			};
								
			dataUpdate({
				"deviceValues": deviceValues
			});
		
			res.end(result[0].rowid + "");
		}
		else {
			console.log("ERROR ON ADDING THE DEVICE");
			
			res.end("false");
		}
	});
});

app.get("/api/deviceValue/:id", function (req, res) {
	var id = req.params.id;
	
	if (deviceValues[id] !== undefined) {
		res.end(JSON.stringify(deviceValues[id].value));
	}
	res.end("false");
});

app.post("/api/deviceValue/", function (req, res) {
	var data = req.body;
	//TODO verify the data
	
	if (data.id && deviceValues[data.id] !== undefined) {
		if (data.value) {
			data.value = parseInt(data.value);
		}
		else {
			data.value = NaN;
		}
		
		if (!isNaN(data.value)) {			
			if (deviceValues[data.id] !== data.value) {
				db.run("INSERT INTO deviceValues(deviceId, value, timestamp) VALUES(?,?,?)", [
					data.id,
					data.value,
					parseInt(new Date().getTime() / 1000)
				]);

				deviceValues[data.id].value = data.value;
			
				dataUpdate({
					"deviceValues": deviceValues
				});
			}
		
			res.end("true");
			return;
		}
	}
	res.end("false");
});

app.get("/api/scanControllers/", function (req, res) {
	scanHardwarePath();
	
	res.end("true");
});

