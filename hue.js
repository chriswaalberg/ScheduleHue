var http = require('http');
var schedule = require('node-schedule');
var SunCalc = require('suncalc');
var settings = require('./settings');
var config = require('./config');

var BRIDGEIP = null;
var SUNTIMES = {};
var SUNBASEDSCHEDULES = [];

// We don't use promises, because the bridge IP will definitely be known by the time the first schedule hits.
getBridgeIP();
scheduleTimeBasedJobs();
scheduleSunBasedJobs();
schedule.scheduleJob({ hour: 2 }, scheduleSunBasedJobs);

// scheduleTimeBasedJobs and scheduleSunBasedJobs could have been combined,
// which would mean both sun based jobs and time based jobs would we rescheduled every night.
// But hey, fuck it, whatever.
function scheduleTimeBasedJobs() {
	for (var i = 0; i < config.rules.length; i++) {
		if (config.rules[i].if.schedule) {
			// TODO BUG It seems the last state in the config.rules is always the one being executed...?!
			var _if = config.rules[i].if;
			var _then = config.rules[i].then;
			schedule.scheduleJob(config.rules[i].if.schedule, function() {
				runJob(_if, _then);
			});
			console.log(' -- Time based schedule job set at: ' + JSON.stringify(config.rules[i].if.schedule));
		}
	}
	console.log(' -- All time based schedule jobs set.');
}

function scheduleSunBasedJobs() {
	// Order of SunTimes properties (example times are from april 20th)
	// nadir: 				01:42
	// nightEnd: 			04:20
	// nauticalDawn: 	05:13
	// dawn: 					05:59
	// sunrise: 			06:36
	// sunriseEnd: 		06:40
	// goldenHourEnd: 07:22
	// solarNoon: 		13:42
	// goldenHour: 		20:03
	// sunsetStart: 	20:45
	// sunset: 				20:49
	// dusk: 					21:25
	// nauticalDusk: 	22:12
	// night: 				23:05

  // There is a subtle difference between lightStart and dakrStart:
  // lightStart is the first moment when it's completely light,
  // darkStart is the first moment when it starts getting dark.
  // This seems to be the most logical for now with the currently thought of rules.
	var _sunTimes = SunCalc.getTimes(new Date(), settings.lat, settings.long);
	SUNTIMES.lightStart = new Date(_sunTimes.sunriseEnd);
	SUNTIMES.darkStart = new Date(new Date(_sunTimes.sunsetStart) - 30 * 60000); // Subtract 30 minutes, to really get the moment when it starts getting dark.

	// Cancel yesterday's sun based schedules.
	for (var i = 0; i < SUNBASEDSCHEDULES.length; i++) {
		SUNBASEDSCHEDULES[i].cancel();
	}
	SUNBASEDSCHEDULES = [];

	for (var i = 0; i < config.rules.length; i++) {
		if (!config.rules[i].if.schedule) {
			var _if = config.rules[i].if;
			var _then = config.rules[i].then;
			var _schedule = null;
			_schedule = {
        hour: SUNTIMES[_if.outsideIs + "Start"].getHours(),
        minute: SUNTIMES[_if.outsideIs + "Start"].getMinutes()
      };
			SUNBASEDSCHEDULES.push(schedule.scheduleJob(_schedule, function() {
				runJob(_if, _then);
			}));
			console.log(' -- Sun based schedule job set at: ' + JSON.stringify(_schedule));
		}
	}
	console.log(' -- All sun based schedule jobs set.');
}

// runJob first checks if we are ready to go. If all lights are green, then we set the state of each lights in the rule.
function runJob(_if, _then) {
	console.log(' -- runJob:')
	console.log(' -- -- if: ' + JSON.stringify(_if));
	console.log(' -- -- then: ' + JSON.stringify(_then));

	// It should never happen that we don't have a bridge IP here, just to be sure.
	if (BRIDGEIP == null) {
		getBridgeIP();
		setTimeout(function() {
			runJob(_if, _then);
		}, 10000);
		console.log(' -- Postponed job, because the bridge IP is unknown.');
		return;
	}

  // If there is a sun based 'if', then we check if it's 'true'.
	var now = new Date();
	var outsideIsDark = now < SUNTIMES.lightStart || now > SUNTIMES.darkStart;
	var outsideIsLight = now > SUNTIMES.lightStart && now < SUNTIMES.darkStart;
	if ((_if.outsideIs == "light" && outsideIsDark)	|| (_if.outsideIs == "dark" && outsideIsLight)) {
		console.log(' -- Not running scheduled job, because it\s not ' + _if.outsideIs + ' right now.');
		return;
	}

	var state = null;
  // If _then is an array, we randomly select one of the child rules.
	if (Array.isArray(_then)) {
		var min = 0;
		var max = _then.length - 1;
		var index = Math.floor(Math.random()*(max-min+1)+min);
		state = _then[index];
	} else {
		state = _then;
	}

  // If the _then state applies to all lights, we set the state to the lights one by one.
	if (state.all) {
		for (var i = 0; i < LIGHTS.length; i++) {
			setLightState(i+1, state.all);
		}
	}
  // Else we go through each individual given light state and set it to the light in question.
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
	    path: '/api/' + settings.username + '/lights/' + light + '/state',
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
            console.log(' -- BridgeIP found: ' + BRIDGEIP);
        });
    });

    req.on('error', function(err) {
        // TODO
        console.log(' -- ERROR: No bridge found: ' + err);
    });

    req.end();
}
