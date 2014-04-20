var http = require('http');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');

var BRIDGEIP = null;
var LIGHTS = [1, 2, 3, 4]; //TODO lampen ophalen? Nier per sé nuttig, aangezien de config ook per lamp hard coded is.
var USERNAME = "USERNAME";
var SUNTIMES = {};
var SUNBASEDSCHEDULES = [];
var STATES = {
	"bright": {
		"all": { "on": true, "bri": 219, "hue": 33849, "sat": 44 }
	},
	"chill": [
		{
			"1": { "on": true, "bri": 219, "hue": 13849, "sat": 44 },
			"2": { "on": true, "bri": 219, "hue": 23849, "sat": 44 },
			"3": { "on": true, "bri": 219, "hue": 33849, "sat": 44 },
			"4": { "on": true, "bri": 219, "hue": 43849, "sat": 44 } 
		},
		{
			"1": { "on": true, "bri": 100, "hue": 13849, "sat": 24 },
			"2": { "on": true, "bri": 100, "hue": 23849, "sat": 24 },
			"3": { "on": true, "bri": 100, "hue": 33849, "sat": 24 },
			"4": { "on": true, "bri": 100, "hue": 43849, "sat": 24 }
		}
	],
	"off": { "all": { "on": false } }
};

// ochtend
// if "het is 7.30 uur" en "het is nog donker" then "lampen boven de tafel vol aan"
// if "het is niet meer donker" then "alle lampen uit"

// avond
// if "het wordt donker" then "alle lampen aan, random avondprogramma"
// if "het is 18.00 uur" then "lampen boven de tafel vol aan"
// if "het is 19.15 uur" en "het is donker" then "alle lampen aan, random avondprogramma"
// if "het is 19.15 uur" en "het is licht" then "alle lampen uit"

// nacht
// if "het is 0.00 uur" then "langzaam alle lampen uit"

var config = [
	{
		"if": { "schedule": { hour: 7, minute: 30 }, "outsideIs": "dark" },
		"then": STATES["bright"]
	},
	{
		"if": { "outsideIs": "light" },
		"then": STATES["off"]
	},
	{
		"if": { "outsideIs": "dark" },
		"then": STATES["chill"]
	},
	{
		"if": { "schedule": { hour: 17, minute: 45 } },
		"then": STATES["bright"]
	},
	{
		"if": { "schedule": { hour: 19, minute: 15 }, "outsideIs": "dark" },
		"then": STATES["chill"]
	},
	{
		"if": { "schedule": { hour: 19, minute: 15 }, "outsideIs": "light" },
		"then": STATES["off"]
	},
	{
		"if": { "schedule": { hour: 0, minute: 0 } },
		"then": STATES["off"]
	}
];

// We gebruiken geen promises, omdat het bridge IP echt wel bekend is tegen de tijd dat de eerste scheduled job van start gaat.
getBridgeIP();
scheduleTimeBasedJobs();
scheduleSunBasedJobs();
schedule.scheduleJob({ hour: 2 }, scheduleSunBasedJobs);

// scheduleTimeBasedJobs en scheduleSunBasedJobs hadden op zich ook gecombineerd kunnen worden,
// en beide elke dag opnieuw ingesteld kunnen worden. Maar ach, fuck it, whatever.
function scheduleTimeBasedJobs() {
	for (var i = 0; i < config.length; i++) {
		if (config[i].if.schedule) {
			var _if = config[i].if;
			var _then = config[i].then;
			schedule.scheduleJob(config[i].if.schedule, function() {
				runJob(_if, _then);
			});
			console.log(' -- Time based schedule job set at: ' + JSON.stringify(config[i].if.schedule));
		}
	}
	console.log(' -- All time based schedule jobs set.');
}

function scheduleSunBasedJobs() {
	// Volgorde van SunTimes properties (tijden zijn van 20 april)
	// nadir: 			01:42
	// nightEnd: 		04:20
	// nauticalDawn: 	05:13
	// dawn: 			05:59
	// sunrise: 		06:36
	// sunriseEnd: 		06:40
	// goldenHourEnd: 	07:22
	// solarNoon: 		13:42
	// goldenHour: 		20:03
	// sunsetStart: 	20:45
	// sunset: 			20:49
	// dusk: 			21:25
	// nauticalDusk: 	22:12
	// night: 			23:05

	// Er zit een subtiel verschil tussen lightStart en darkStart:
	// lightStart is het eerste moment dat het volledig licht is,
	// darkStart is het eerste moment dat het net donker begint te worden.
	// Dat is het meest logisch voor de tot nu toe bedachte programma's.
	var _sunTimes = SunCalc.getTimes(new Date(), 52.0642017, 4.2794736);
	SUNTIMES.lightStart = new Date(_sunTimes.sunriseEnd);
	SUNTIMES.darkStart = new Date(_sunTimes.sunsetStart);

	// Sun based schedules van gisteren annuleren.
	for (var i = 0; i < SUNBASEDSCHEDULES.length; i++) {
		SUNBASEDSCHEDULES[i].cancel();
	}
	SUNBASEDSCHEDULES = [];

	for (var i = 0; i < config.length; i++) {
		if (!config[i].if.schedule) {
			var _if = config[i].if;
			var _then = config[i].then;
			var _schedule = null;
			if (_if.outsideIs == "light") {
				_schedule = {
					hour: SUNTIMES.lightStart.getHours(),
					minute: SUNTIMES.lightStart.getMinutes()
				};
			} else if (_if.outsideIs == "dark") {
				_schedule = {
					hour: SUNTIMES.darkStart.getHours(),
					minute: SUNTIMES.darkStart.getMinutes() - 30
				};
			}
			SUNBASEDSCHEDULES.push(schedule.scheduleJob(_schedule, function() {
				runJob(_if, _then);
			}));
			console.log(' -- Sun based schedule job set at: ' + JSON.stringify(_schedule));
		}
	}
	console.log(' -- All sun based schedule jobs set.');
}

// runJob controleert eerst of we echt aan de slag mogen. Zo ja, dan zetten we de state van elke (relevante) lamp.
function runJob(_if, _then) {
	console.log(' -- runJob:')
	console.log(' -- -- if: ' + JSON.stringify(_if));
	console.log(' -- -- then: ' + JSON.stringify(_then));

	// Het kan in theorie nooit voorkomen dat we hier het bride IP niet weten, just to be sure.
	if (BRIDGEIP == null) {
		getBridgeIP();
		setTimeout(function() {
			runJob(_if, _then);
		}, 10000);
		console.log(' -- Postponed job, because the bridge IP is unknown.');
		return;
	}

	// Als er een sun based if meegegeven is, controleren we of die wel true is.
	var now = new Date();
	var outsideIsDark = now < SUNTIMES.lightStart || now > SUNTIMES.darkStart;
	var outsideIsLight = now > SUNTIMES.lightStart && now < SUNTIMES.darkStart;
	if ((_if.outsideIs == "light" && outsideIsDark)	|| (_if.outsideIs == "dark" && outsideIsLight)) {
		console.log(' -- Not running scheduled job, because it\s not ' + _if.outsideIs + ' right now.');
		return;
	}

	var state = null;
	// Als _then een array is, dan pakken we random één van de items (states).
	if (Object.prototype.toString.call( _then ) === '[object Array]') {
		var min = 0;
		var max = _then.length - 1;
		var index = Math.floor(Math.random()*(max-min+1)+min);
		state = _then[index];
	} else {
		state = _then;
	}

	// Als de _then state voor alle lampen geldt, zetten we één voor één de lampen op die state.
	if (state.all) {
		for (var i = 0; i < LIGHTS.length; i++) {
			setLightState(i+1, state.all);
		}
	}
	// Anders gaan we de individuele meegegeven states af en zetten die op de desbetreffende lamp.
	else {
		for (var key in state) {
			setLightState(key, state[key]);
		}
	}
}

function setLightState(light, state) {
	console.log(' -- setLightState: ' + light + ' ' + JSON.stringify(state));
	
	var options = {
	    host: BRIDGEIP,
	    port: 80,
	    path: '/api/' + USERNAME + '/lights/' + light + '/state',
	    method: 'PUT',
	    headers: {
	        'Content-Type': 'application/json'
	    }
	};
	var req = http.request(options, function(res)
    {
        var output = '';
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });
    });

    req.on('error', function(err) {
        // TODO
        console.log(' -- ERROR: Light state not set: ' + err);
    });

    req.write(JSON.stringify(state));
    req.end();
}

function getBridgeIP() {
	var options = {
	    host: 'www.meethue.com',
	    port: 80,
	    path: '/api/nupnp',
	    method: 'GET',
	    headers: {
	        'Content-Type': 'application/json'
	    }
	};
	var req = http.request(options, function(res)
    {
        var output = '';
        res.setEncoding('utf8');

        res.on('data', function (chunk) {
            output += chunk;
        });

        res.on('end', function() {
        	if (!JSON.parse(output) || !JSON.parse(output)[0] || !JSON.parse(output)[0].internalipaddress) {
        		console.log(' -- ERROR: No bridge found.');
        		return;
        	}
            BRIDGEIP = JSON.parse(output)[0].internalipaddress;
            console.log(' -- BridgeIP found.');
        });
    });

    req.on('error', function(err) {
        // TODO
        console.log(' -- ERROR: No bridge found: ' + err);
    });

    req.end();
}