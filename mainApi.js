 
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
				cb(null, JSON.parse(body));
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
		
		tcpSocket.on('data', function(data) {
			var json = false;
			try {
				json = JSON.parse(data);
			}
			catch (e) {
				
			}
			
			if (json.deviceValues) {
				for (var i = 0; i < deviceChangeEvents.length; i ++) {
					for (var id in json.deviceValues) {
						if (deviceChangeEvents[i].id == id) {
							deviceChangeEvents[i].cb(json.deviceValues[id]);
							break;
						}
					}
				}
			}
		});
	}
	
	deviceChangeEvents.push({
		id: id,
		cb: cb
	});
}

