var lights = [1, 2, 3, 4]; //TODO Get the lights from the hue API? Not very useful though, since the lights are hard code into the config.rules as well.
var states = {
  "bright": {
    "1": { "on": true, "bri": 254, "ct": 403 },
    "2": { "on": true, "bri": 254, "ct": 403 },
    "3": { "on": true, "bri": 254, "ct": 403 },
    "4": { "on": true, "bri": 254, "xy": [ 0.4186, 0.1813 ] }
  },
  "chill": [
    { // Based on Goldee's Sunrise
      "1": { "on": true, "bri": 200, "hue": 8031, "sat": 203 },
      "2": { "on": true, "bri": 231, "hue": 7990, "sat": 146 },
      "3": { "on": true, "bri": 254, "hue": 7962, "sat": 106 },
      "4": { "on": true, "bri": 239, "hue": 10922, "sat": 196 }
    },
    { // Based on Goldee's Inspiration
      "1": { "on": true, "bri": 246, "hue": 13388, "sat": 54 },
      "2": { "on": true, "bri": 254, "hue": 2781, "sat": 31 },
      "3": { "on": true, "bri": 237, "hue": 12988, "sat": 67 },
      "4": { "on": true, "bri": 254, "hue": 3298, "sat": 41 }
    },
    { // Based on Goldee's Energize
      "1": { "on": true, "bri": 254, "hue": 38228, "sat": 185 },
      "2": { "on": true, "bri": 254, "hue": 34099, "sat": 81 },
      "3": { "on": true, "bri": 254, "hue": 43690, "sat": 35 },
      "4": { "on": true, "bri": 254, "hue": 38228, "sat": 185 }
    },
    { // Based on Goldee's Volcano Flow
      "1": { "on": true, "bri": 180, "hue": 47502, "sat": 254 },
      "2": { "on": true, "bri": 186, "hue": 49664, "sat": 207 },
      "3": { "on": true, "bri": 220, "hue": 9123, "sat": 254 },
      "4": { "on": true, "bri": 180, "hue": 47502, "sat": 254 }
    },
    { // Based on Goldee's Green Forest
      "1": { "on": true, "bri": 165, "hue": 20265, "sat": 189 },
      "2": { "on": true, "bri": 254, "hue": 22714, "sat": 170 },
      "3": { "on": true, "bri": 183, "hue": 23540, "sat": 188 },
      "4": { "on": true, "bri": 200, "hue": 23489, "sat": 165 }
    },
    { // Based on Goldee's Waterfall of the Gods
      "1": { "on": true, "bri": 150, "hue": 49180, "sat": 188 },
      "2": { "on": true, "bri": 80, "hue": 42804, "sat": 147 },
      "3": { "on": true, "bri": 254, "hue": 55550, "sat": 162 },
      "4": { "on": true, "bri": 218, "hue": 52902, "sat": 172 }
    },
    { // Based on Goldee's Autumn Park
      "1": { "on": true, "bri": 180, "hue": 6941, "sat": 213 },
      "2": { "on": true, "bri": 100, "hue": 2005, "sat": 206 },
      "3": { "on": true, "bri": 200, "hue": 11448, "sat": 165 },
      "4": { "on": true, "bri": 254, "hue": 10922, "sat": 208 }
    },
    { // Based on Goldee's Misty Secret
      "1": { "on": true, "bri": 209, "hue": 61416, "sat": 196 },
      "2": { "on": true, "bri": 230, "hue": 51052, "sat": 196 },
      "3": { "on": true, "bri": 230, "hue": 4154, "sat": 162 },
      "4": { "on": true, "bri": 224, "hue": 63732, "sat": 194 }
    },
    { // Based on Goldee's Aurora Glow
      "1": { "on": true, "bri": 163, "hue": 45531, "sat": 254 },
      "2": { "on": true, "bri": 160, "hue": 23681, "sat": 231 },
      "3": { "on": true, "bri": 86, "hue": 45613, "sat": 254 },
      "4": { "on": true, "bri": 211, "hue": 47128, "sat": 254 }
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
  }
];

exports.lights = lights;
exports.states = states;
exports.rules = rules;