var lights = [1, 2, 3, 4]; //TODO Get the lights from the hue API? Not very useful though, since the lights are hard code into the config.rules as well.
var states = {
  "bright": {
    "all": { "on": true, "bri": 219, "hue": 33849, "sat": 44 }
  },
  "chill": [
    {
      "1": { "on": true, "bri": 225, "hue": 52168, "sat": 176 },
      "2": { "on": true, "bri": 254, "hue": 55550, "sat": 162 },
      "3": { "on": true, "bri": 190, "hue": 51316, "sat": 179 },
      "4": { "on": true, "bri": 94, "hue": 43647, "sat": 152 }
    }
  ],
  "off": { "all": { "on": false } }
};
var rules = [
  {
    "if": { "schedule": { hour: 7, minute: 30 }, "outsideIs": "dark" },
    "then": states["bright"]
  },
  {
    "if": { "outsideIs": "light" },
    "then": states["off"]
  },
  {
    "if": { "outsideIs": "dark" },
    "then": states["chill"]
  },
  {
    "if": { "schedule": { hour: 17, minute: 45 } },
    "then": states["bright"]
  },
  {
    "if": { "schedule": { hour: 19, minute: 15 }, "outsideIs": "dark" },
    "then": states["chill"]
  },
  {
    "if": { "schedule": { hour: 19, minute: 15 }, "outsideIs": "light" },
    "then": states["off"]
  },
  {
    "if": { "schedule": { hour: 0, minute: 0 } },
    "then": states["off"] // TODO slowly fade out lights
  },
  // TEST
  // {
  //   "if": { "schedule": { hour: 14, minute: 15 }, "outsideIs": "light" },
  //   "then": states["chill"]
  // }
];

exports.lights = lights;
exports.states = states;
exports.rules = rules;