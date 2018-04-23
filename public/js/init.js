google.charts.load('current', {'packages':['corechart']});
google.charts.setOnLoadCallback(startApp);

function dataModel (data, name) {
	if (data === undefined) {
		data = [];
	}
	
	var currentData = data;
	var currentDataCheckSum = JSON.stringify(data);
	
	var evs = [];
	
	this.setData = function (newData) {
		var newDataCheckSum = JSON.stringify(newData);
		
		if (newDataCheckSum !== currentDataCheckSum) {
			currentData = newData;
			currentDataCheckSum = newDataCheckSum;
			
			for (var i = 0; i < evs.length; i ++) {
				evs[i](currentData);
			}
		}
	};
	
	this.getData = function () {
		return currentData;
	};
	
	this.onChange = function (cb) {
		evs.push(cb);
	};
}

var models = {
	"hardwareConfigForms": new dataModel([], "hardwareConfigForms"),
	"activeHardware": new dataModel([], "activeHardware"),
	"deviceGroups": new dataModel(),
	"deviceValues": new dataModel([], "deviceValues")
};



var formFieldViews = {
	"text": function (name, config, defaultValue) {
		var html = [];
		html.push('<div class="form-group">');
		html.push('<label for="formfield_' + name + '">' + (config.label? config.label : name) + '</label>');
		html.push('<input type="text" class="form-control" id="formfield_' + name + '" name="' + name + '" value="' + (defaultValue? defaultValue : "") + '">');
		html.push('</div>');
		
		return html.join('');
	},
	"select": function (name, config, defaultValue) {
		var html = [];
		html.push('<div class="form-group">');
		html.push('<label for="formfield_' + name + '">' + (config.label? config.label : name) + '</label>');
		html.push('<select id="formfield_' + name + '" name="' + name + '" class="form-control">');
		for (var i in config.options) {
			html.push('<option value="' + i + '">' + config.options[i] + '</option>');
		}
		html.push('</select>');
		html.push('</div>');
		
		return html.join('');
	}
};
function createFormFields (fields) {
	var html = [];
	
	for (var name in fields) {
		if (formFieldViews[fields[name].type]) {
			html.push(formFieldViews[fields[name].type](name, fields[name]));
		}
		else {
			console.log("no form field type: " + fields[name].type);
		}
	}
	
	return html.join('');
}

var formFieldEvents = {};
function createFormEvents (parEl, fields) {
	for (var name in fields) {
		if (formFieldEvents[name]) {
			formFieldEvents[name](parEl, name, fields[name]);
		}
	}
}

var formGetFieldData = {
	"default": function (formField) {
		return formField.value;
	},
	"select": function (formField) {
		return formField.options[formField.selectedIndex].value;
	}
};
function getFormData (formEl, fields) {
	var data = {};
	
	for (var name in fields) {
		var type = fields[name].type;
		if (!formGetFieldData[type]) {
			type = "default";
		}
		
		data[name] = formGetFieldData[type](formEl.find("[name='" + name + "']")[0]);
	}
	
	return data;
}

function view_setup () {
	var modalsHtml = [];
	
	var html = [];
	html.push("<h1>Controller</h1>");
	html.push("<table class='table table-bordered controllersTable'></table>");
	html.push("<h1>Add controller</h1>");
	html.push("<div class='addHardwareForm'></div>");
	
	wrapper.html(html.join(""));
	
	wrapper.find(".controllersTable").each(function () {
		var htmlContainer = $(this);
		var modalContainer = $(modals.append("<div></div>")[0]);
		
		var simpleModal = [];
		simpleModal.push('<div class="modal fade" tabindex="-1" role="dialog">');
		simpleModal.push('<div class="modal-dialog modal-lg" role="document">');
		simpleModal.push('<form class="modal-content">');
		simpleModal.push('<div class="modal-header">');
		simpleModal.push('<h5 class="modal-title"></h5>');
		simpleModal.push('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>');
		simpleModal.push('</div>');
		simpleModal.push('<div class="modal-body">Loading...</div>');
		simpleModal.push('<div class="modal-footer">');
		simpleModal.push('</div>');
		simpleModal.push('</form>');
		simpleModal.push('</div>');
		simpleModal.push('</div>');
		simpleModal = simpleModal.join("")
		
		var renderHardwareTable = function () {
			var activeHardware = models.activeHardware.getData();
			
			var html = [];
			html.push("<tr>");
			html.push("<th>Id</td>");
			html.push("<th>Name</td>");
			html.push("<th>Type</td>");
			html.push("<th></td>");
			html.push("</tr>");
			for (var id in activeHardware) {
				html.push("<tr>");
				html.push("<td>" + id + "</td>");
				html.push("<td><a href='#' data-modal data-id='" + id + "'>" + activeHardware[id].name + "</td>");
				html.push("<td>" + activeHardware[id].type + "</td>");
				html.push("<td><a href='#' data-remove data-id='" + id + "'>RM</a></td>");
				html.push("</tr>");
			}
			
			htmlContainer.html(html.join(""));
			
			htmlContainer.find("a[data-id]").click(function () {
				var jObj = $(this);
				var id = $(this).data("id");
				
				if (jObj.data("remove") !== undefined) {
					$.ajax(baseUrl + "api/hardware/" + id, {
						"method": "DELETE"
					});
				}
				else if (jObj.data("modal") !== undefined) {
					var data = activeHardware[id];
					
					var modalIndex = modalContainer[0].children.length;
					
					modalContainer.append(simpleModal);
					
					var modal = $(modalContainer[0].children[modalIndex]);
					modal.modal();
					
					
					modal.find(".modal-title").html(data.name);
					
					/**
						CREATE MODAL
						
						POLL
							MODAL STILL EXISTS OTHERWISE STOP POLLING
							FOR UPDATES
							WHEN UPDATE RERENDER
					**/
					
					var hardwareLogs = new dataModel()
					
					var timer = false;
					function pollForUpdates () {
						if (!modal[0].parentNode) {
							window.clearTimeout(timer);
							return;
						}
						
						$.getJSON(baseUrl + "api/hardware/" + id + "/logs", function (data) {
							hardwareLogs.setData(data);
							
							timer = setTimeout(function () {
								pollForUpdates();
							}, 2000);
						});
					}
					
					hardwareLogs.onChange(function (data) {
						var html = [];
						html.push("<pre style='white-space: pre-wrap;'>");
						for (var i = 0; i < data.length; i ++) {
							var time = new Date(data[i].date * 1000);
							
							var dateStr = [];
								dateStr.push(time.getDate().toString().padStart(2, "0"));
								dateStr.push("-");
								dateStr.push((time.getMonth() + 1).toString().padStart(2, "0"));
								dateStr.push(" ");
								dateStr.push(time.getHours().toString().padStart(2, "0"));
								dateStr.push(":");
								dateStr.push(time.getMinutes().toString().padStart(2, "0"));
								
							if (data[i].error === 1) {
								html.push("<span style='color:red;'>");
							}
								
							html.push("<b>" + dateStr.join("") + "</b>&gt; " + data[i].data);
							
							if (data[i].error === 1) {
								html.push("</span>");
							}
							
							html.push("\n");
						}
						html.push("</pre>");
						modal.find(".modal-body").html(html.join(""));
					});
					
					pollForUpdates();
				}
				
				return false;
			});
		};
		
		models.activeHardware.onChange(renderHardwareTable);
		renderHardwareTable();
	});
	
	wrapper.find(".addHardwareForm").each(function () {
		var htmlContainer = $(this);
		var modalContainer = $(modals.append("<div></div>")[0]);
		
		var renderAddForm = function () {
			var hardwareConfig = models.hardwareConfigForms.getData();
			
			var defaultFormElements = {
				"name": {
					"type": "text"
				}
			};
			
			var html = [], modalsHtml = [];
			for (var name in hardwareConfig) {
				html.push("<a href='#' data-toggle='modal' data-target='#modal_" + name + "' class='btn btn-info'>" + name + "</a>");
				
				modalsHtml.push('<div class="modal" tabindex="-1" role="dialog" id="modal_' + name + '">');
				modalsHtml.push('<div class="modal-dialog" role="document">');
				modalsHtml.push('<form class="modal-content">');
				modalsHtml.push('<div class="modal-header">');
				modalsHtml.push('<h5 class="modal-title">' + name + '</h5>');
				modalsHtml.push('<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>');
				modalsHtml.push('</div>');
				modalsHtml.push('<div class="modal-body">');
				modalsHtml.push(createFormFields(defaultFormElements));
				
				modalsHtml.push(createFormFields(hardwareConfig[name]));
				modalsHtml.push('</div>');
				modalsHtml.push('<div class="modal-footer">');
				modalsHtml.push('<button type="submit" class="btn btn-primary">Save changes</button>');
				modalsHtml.push('<button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>');
				modalsHtml.push('</div>');
				modalsHtml.push('</form>');
				modalsHtml.push('</div>');
				modalsHtml.push('</div>');
			}
			htmlContainer.html(html.join(""));
			modalContainer.html(modalsHtml.join(""));
			
		
			
			function modalClosure(formEl, name) {
				createFormEvents(formEl, defaultFormElements);
				createFormEvents(formEl, hardwareConfig[name]);
					
				formEl[0].onsubmit = function () {
					var normalData = getFormData(formEl, defaultFormElements);
						normalData.type = name;
					
					if (normalData.name === "") {
						alert("please enter a name");
						return false;
					}
					
					normalData.config = getFormData(formEl, hardwareConfig[name]);
					
					$.ajax(baseUrl + "api/hardware", {
						"method": "POST",
						"data": normalData
					});
					
					formEl.find("button.close").click();
					
					return false;
				};
			}
			
			for (var name in hardwareConfig) {
				modalClosure($("#modal_" + name + " form"), name);
			}
		};
		
		models.hardwareConfigForms.onChange(renderAddForm);
		renderAddForm();
	});
}

var viewRenderIconAndLabel = function (data) {
	var html = [];
	
	html.push('<i class="far fa-lightbulb"></i>');
	html.push('<a href="#">' + (data.label? data.label : data.name) + '</a>');
	
	return html.join("");
};

var view_fields = {
	"switch": {
		"html": function (id, data) {
			var switchHtml = [viewRenderIconAndLabel(data)];
			
			switchHtml.push('<input type="checkbox" ' + (data.value === 100? "checked" : "") + '>');
			
			return switchHtml.join("");
		},
		"rendered": function (domEl, id, data) {
			
			$(domEl).find("input").change(function () {
				this.disabled = true;
				
				$.ajax(baseUrl + "api/deviceValue/", {
					"method": "POST",
					"data": {
						id: id,
						value: this.checked? 100 : 0
					}
				});
			});
		}
	},
	"dimmer": {
		"html": function () {
			return "TODO";
		}
	},
	"select": {
		"html": function (id, data) {
			var switchHtml = [viewRenderIconAndLabel(data)];
			
			switchHtml.push("<select>");
			for (var key in data.options) {
				var label = data.options[key];
				
				switchHtml.push("<option value='" + key + "'" + (data.value && key === data.value.key? " selected" : "")  + ">" + label + "</option>");
			}
			
			switchHtml.push("</select>");
			
			return switchHtml.join("");
		},
		"rendered": function (domEl, id, data) {
			
			$(domEl).find("select").change(function () {
				this.disabled = true;
				
				$.ajax(baseUrl + "api/deviceValue/", {
					"method": "POST",
					"data": {
						id: id,
						value: JSON.stringify({
							"key": this.value,
							"label": data.options[this.value]
						})
					}
				});
			});
		}
	}
};


function view_devices (filterOnGroup) {
	var htmlContainer = $(wrapper.append("<div></div>")[0]);
	
	function renderData () {
		if (!htmlContainer[0].parentNode) {
			return false;
		}
		
		var html = [];
	
		var deviceValues = models.deviceValues.getData();
		
		var showDevices = {};
		
		for (var id in deviceValues) {
			var mainGroup = deviceValues[id].group.split("-")[0];
			
			if (filterOnGroup === false || mainGroup === filterOnGroup) {
				var subGroup = deviceValues[id].group.split("-").slice(1).join("-");
				
				if (!showDevices[subGroup]) {
					showDevices[subGroup] = {};
				}
				
				showDevices[subGroup][id] = deviceValues[id];
			}
		}
		
		var groupsSorted = Object.keys(showDevices).sort();
		
		var entityChildIndexies = {};
		
		for (var i = 0; i < groupsSorted.length; i ++) {
			var groupName = groupsSorted[i];
			var groupLabel = groupName;
			if (groupLabel === "") {
				groupLabel = "";
				if (groupsSorted.length > 1) {
					groupLabel = "Others";
				}
				else if (filterOnGroup !== false) {
					groupLabel = filterOnGroup;
				}
			}
			
			html.push('<div class="group">');
			var childIndex = 0;
			if (groupLabel !== "") {
				html.push('<div class="head">' + groupLabel + '</div>');
				childIndex++;
			}
			
			for (var id in showDevices[groupName]) {
				html.push('<div class="entity">');
				
				if (view_fields[deviceValues[id].type]) {
					if (view_fields[deviceValues[id].type].html) {
						html.push(view_fields[deviceValues[id].type].html(id, deviceValues[id]));
					}
					else {
						html.push(view_fields[deviceValues[id].type](id, deviceValues[id]));
					}
				}
				else {
					html.push("Undefined fieldtype: " + deviceValues[id].type);
				}
					
				html.push('</div>');
				
				entityChildIndexies[id] = [i, childIndex];
				childIndex++;	
			}
		}
		
		htmlContainer.html(html.join(""));
		
		for (var id in entityChildIndexies) {
			if (view_fields[deviceValues[id].type] && view_fields[deviceValues[id].type].rendered) {
				var domElement = wrapper[0].children[entityChildIndexies[id][0]].children[entityChildIndexies[id][1]];
				
				view_fields[deviceValues[id].type].rendered(domElement, id, deviceValues[id]);
			}
		}
	}
	
	models.deviceValues.onChange(renderData);
	renderData();
}


function hashchange () {
	var currentHash = window.location.hash.substr(1);
	
	
	if (currentHash === "setup") {
		view_setup();
	}
	else {
		view_devices((currentHash? currentHash : false));
	}
}



var baseUrl, navbar, wrapper, modals, message, socket;
function startApp() {
	navbar = $("#navbar");
	wrapper = $("#wrapper");
	modals = $("#modals");
	message = $("#message");

	baseUrl = window.location.protocol + "//" + window.location.host + "/";
	
	socket = io.connect(baseUrl);

	socket.on("dataUpdate", function (data) {
		for (var i in data) {
			if (models[i]) {
				models[i].setData(data[i]);
			}
		}
	});

	socket.on("message", function (data) {
		var defaults = {
			"type": "danger",
			"message": "no message payload set"
		};
		
		for (var i in defaults) {
			if (!data[i]) {
				data[i] = defaults[i];
			}
		}
		
		var alertDiv = document.createElement("div");
			alertDiv.className = "alert alert-" + data.type;
			alertDiv.innerHTML = data.message;
		
		message.append(alertDiv);
			
		setTimeout(function () {
			message[0].removeChild(alertDiv);
		}, 5000);
	});
	
	
	var renderMenu = function () {
		var tabs = [""];
		
		var groups = models.deviceGroups.getData();
		for (var key in groups) {
			tabs.push(key);
		}
		
		tabs.push("setup");
		
		var html = [];
		for (var i = 0; i < tabs.length; i++) {
			html.push('<li class="nav-item">');
			html.push('<a class="nav-link" href="#' + encodeURIComponent(tabs[i]? tabs[i] : "") + '">' + (tabs[i]? tabs[i] : "All") + '</a>');
			html.push('</li>');
		}
		
		navbar.html(html.join(""));
	}
	
	
	models.deviceGroups.onChange(renderMenu);
	
	models.deviceValues.onChange(function (data) {
		var deviceGroups = {};
		if (data) {
			for (var id in data) {
				if (data[id].group) {
					var mainGroup = data[id].group.split("-")[0];
					
					if (deviceGroups[mainGroup] === undefined) {
						deviceGroups[mainGroup] = 0;
					}
				
					deviceGroups[mainGroup]++;
				}
			}
		}
		
		models.deviceGroups.setData(deviceGroups);
	});
	
	$( window ).on('hashchange', hashchange);
	hashchange();
	
	
}