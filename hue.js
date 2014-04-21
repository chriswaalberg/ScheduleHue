var request = require('request');
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
// TODO Check which rule currently applies, and apply it.

// scheduleTimeBasedJobs and scheduleSunBasedJobs could have been combined,
// which would mean both sun based jobs and time based jobs would we rescheduled every night.
// But hey, fuck it, whatever.
function scheduleTimeBasedJobs() {
  for (var i = 0; i < config.rules.length; i++) {
    if (config.rules[i].if.schedule) {
      scheduleTimeBasedJob(config.rules[i]);
    }
  }
  console.log(' -- All time based schedule jobs set.');
}

function scheduleTimeBasedJob(rule) {
  var _if = rule.if;
  var _then = rule.then;
  schedule.scheduleJob(rule.if.schedule, function() {
    runJob(_if, _then);
  });
  console.log(' -- Time based schedule job set at: ' + JSON.stringify(rule.if.schedule));
}

function scheduleSunBasedJobs() {
  // Order of SunTimes properties (example times are from april 20th)
  // nadir:         01:42
  // nightEnd:      04:20
  // nauticalDawn:  05:13
  // dawn:          05:59
  // sunrise:       06:36
  // sunriseEnd:    06:40
  // goldenHourEnd: 07:22
  // solarNoon:     13:42
  // goldenHour:    20:03
  // sunsetStart:   20:45
  // sunset:        20:49
  // dusk:          21:25
  // nauticalDusk:  22:12
  // night:         23:05

  // There is a subtle difference between lightStart and dakrStart:
  // lightStart is the first moment when it's completely light,
  // darkStart is the first moment when it starts getting dark.
  // This seems to be the most logical for now with the currently thought of rules.
  var _sunTimes = SunCalc.getTimes(new Date(), settings.lat, settings.long);
  SUNTIMES.lightStart = new Date(_sunTimes.sunriseEnd);
  SUNTIMES.darkStart = new Date(new Date(_sunTimes.sunsetStart).getTime() - 30 * 60000); // Subtract 30 minutes, to really get the moment when it starts getting dark.

  // Cancel yesterday's sun based schedules.
  for (var i = 0; i < SUNBASEDSCHEDULES.length; i++) {
    SUNBASEDSCHEDULES[i].cancel();
  }
  SUNBASEDSCHEDULES = [];

  for (var i = 0; i < config.rules.length; i++) {
    if (!config.rules[i].if.schedule) {
      scheduleSunBasedJob(config.rules[i]);
    }
  }
  console.log(' -- All sun based schedule jobs set.');
}

function scheduleSunBasedJob(rule) {
  var _if = rule.if;
  var _then = rule.then;
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
  var now = new Date(new Date().getTime() + 1 * 60000); // We add one minute, because darkStart and lightStart can be milliseconds past the time we use to schedule the job. We could also use milliseconds for the schedules, but fuck it.
  var outsideIsDark = now < SUNTIMES.lightStart || now > SUNTIMES.darkStart;
  var outsideIsLight = now > SUNTIMES.lightStart && now < SUNTIMES.darkStart;
  console.log(now, SUNTIMES.lightStart, SUNTIMES.darkStart);
  if ((_if.outsideIs == "light" && outsideIsDark) || (_if.outsideIs == "dark" && outsideIsLight)) {
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
    for (var i = 0; i < config.lights.length; i++) {
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
  var url = 'http://' + BRIDGEIP + '/api/' + settings.username + '/lights/' + light + '/state';
  console.log(' -- setLightState: ' + url, JSON.stringify(state));

  request.put({url:url, json:state}, function (error, response, body) {
    if (response.statusCode == 200) {
      console.log(' -- Response: ', body);
    } else {
      console.log(' -- ERROR: Light state not set: ' + response.statusCode, body);
    }
  });
}

function getBridgeIP() {
  request('http://www.meethue.com/api/nupnp', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var json = JSON.parse(body);
      if (!json || !json[0] || !json[0].internalipaddress) {
        console.log(' -- ERROR: No bridge found.');
        return;
      }
      BRIDGEIP = json[0].internalipaddress;
      console.log(' -- BridgeIP found: ' + BRIDGEIP);
    }
  });
}



