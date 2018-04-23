 
const http = require('http');
const querystring = require('querystring');

module.exports.requestApi = function (uri, method, data, cb) {
	if (method === undefined) {
		method = "GET"
	}
	
	if (data === undefined) {
		data = {};
	}
	
	var req = http.request({
		host: "::1",
		port: 8123,
		path: "/api/" + uri,
		method: method,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		}
	}, (res) => {
		var body = "";
		
		res.setEncoding('utf8');
		res.on('data', (chunk) => {
			body += chunk;
		});
		
		res.on('end', () => {
			if (cb) {
				var data = null;
				
				try {
					data = JSON.parse(body);
				}
				catch (e) {
					console.log("Unexpected result:", body, querystring.stringify(data));
					
					return;
				}
				
				cb(null, data);
			}
		});
	});
	
	req.on('error', (e) => {
		if (cb) {
			cb({
				"httperror": e.message
			});
		}
	});

	
	req.write(querystring.stringify(data));
	req.end();
} 

var net = require('net');
var tcpSocket = false;

deviceChangeEvents = [];

module.exports.onDeviceChange = function (id, cb) {
	if (tcpSocket === false) {
		tcpSocket = new net.Socket();

		tcpSocket.connect(8124, '127.0.0.1', function() {
			
		});
		
		var dataBuffer = "";
		tcpSocket.on('data', function(data) {
			dataBuffer += data.toString("UTF-8");
			
			var lines = dataBuffer.split("\r\n");
			
			for (var i = 0; i < lines.length; i ++) {
				var json = false;
				try {
					json = JSON.parse(lines[0]);
				}
				catch (e) {
					console.log("Unexpected result:", body, querystring.stringify(data));
					
					break;
				}
				
				if (json.deviceValues) {
					for (var i2 = 0; i2 < deviceChangeEvents.length; i2 ++) {
						for (var id in json.deviceValues) {
							if (deviceChangeEvents[i2].id == id) {
								deviceChangeEvents[i2].cb(json.deviceValues[id]);
								break;
							}
						}
					}
				}
			}
			
			dataBuffer = lines.slice(i).join("\r\n");
			
			
		});
	}
	
	deviceChangeEvents.push({
		id: id,
		cb: cb
	});
}

