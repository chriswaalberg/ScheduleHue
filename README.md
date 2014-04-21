# Time based and sunlight based schedules for Philips hue
With this NodeJS script you can configure time based and sunlight based schedules for your hue lights. Just enter your coordinates and username (read [the Philips hue API documentation](http://developers.meethue.com/gettingstarted.html) to register your username) and change the config JSON to your personal likings.

I hope the code is pretty self explanatory.

Examples of the possibilities:
 * Have all lights switch to a bright state at 7.00 o'clock, but only if it's still dark outside.
 * Have all lights turn off as soon as it's light outside.
 * Have all lights switch to a nice atmospheric state when it's starts getting dark outside.
 * Have the lights over the dinner table switch to a brighter state at 18.00 o'clock, but only if it's already dark outside.

I run this on a Mac mini, but it could also be run on a Raspberry Pi, I suppose. The best thing though, would be Philips adding this functionality to the bridge itself.

Have fun!
