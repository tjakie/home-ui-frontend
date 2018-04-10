const { spawn } = require('child_process');

var spawnCount = 0;
module.exports = function (file, options) {
	spawnCount ++;
	
	var myId = spawnCount + 0;
	var defaultOptions = {
		"config": {},
		"onOutputEvent": function () { },
		"verbose": false
	};
	
	for (var i in defaultOptions) {
		if (options[i]) {
			defaultOptions[i] = options[i];
		}
	}
	
	var result = {};
	
	
	var ps = true;
	var initProcess = function () {
		if (defaultOptions.verbose) {
			console.log("exec #" + myId + ": node", file, JSON.stringify(JSON.stringify(defaultOptions.config)));
		}
			
		ps = spawn("node", [file, JSON.stringify(defaultOptions.config)]);
		
		ps.stdout.on('data', (data) => {
			if (defaultOptions.verbose) {
				console.log("stdout #" + myId + ": " + data.toString('UTF8').trim());
			}
			
			defaultOptions.onOutputEvent(data.toString('UTF8').trim(), false);
		});

		ps.stderr.on('data', (data) => {
			if (defaultOptions.verbose) {
				console.log("stderr #" + myId + ": " + data.toString('UTF8').trim());
			}
			
			defaultOptions.onOutputEvent(data.toString('UTF8').trim(), true);
		});
		
		ps.on('close', (code) => {
			if (defaultOptions.verbose) {
				console.log("exec #" + myId + ": just stopped with code", code);
			}
			
			if (ps !== false) {
				defaultOptions.onOutputEvent(code !== null? "child process exited with code " + code : "RESTARTING PROCESS", true);
				
				if (code !== 0) {
					if (code !== null) {
						defaultOptions.onOutputEvent("WARNING: RESTARTING child process", true);
					}
					
					initProcess();
					return;
				}				
			}
		});
	};
	
	initProcess();
	
	result.kill = function () {
		if (ps !== false && ps !== true) {
			var sub = ps;
			ps = false;
			
			
			sub.kill();
		}
	};

	result.restart = function () {
		if (ps !== false && ps !== true) {
			ps.kill();
		}
	}

	return result;
};
