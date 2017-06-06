var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googlePeople = google.people('v1');
var googleAuth = require('google-auth-library');
var DiscoveryV1 = require ('watson-developer-cloud/discovery/v1');
var moment = require('moment');
moment().format();
var TJBot = require('tjbot');
var config = require('./config');
var NatLangUnd = require('watson-developer-cloud/natural-language-understanding/v1');
//var quickstart = require('./quickstart');
var userName = 'Drew Gregory'; //TODO:replace with people.get('people/me');
var email = 'djgregny@gmail.com';
//TODO: Make these config variables someday...
var cutOffEndHour = 21;
var cutOffStartHour = 8;
//var people = [];
var googleMapsClient = require('@google/maps').createClient({
	key: 'AIzaSyBZ2na0fTHkeA8YIjwdCEOBTvOc5apcmaM'
});
var locations = [];
var locTypes = [];
//4/CpeukA727qLOLbUITQ5lpfR3hORaHV5qx-zVmXoKvI8
// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/contacts.readonly'];
//var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';This line generates a directory location that is system - independent.
var TOKEN_DIR = '/home/pi/.tj-cal-credentials/'; //Change this directory if you are running on a system other than a Raspberry Pi.
var TOKEN_PATH = TOKEN_DIR + 'tjcal-auth.json';
//sudo pcmanfm opens hidden/root directories.
//obtain credentials
var credentials = config.credentials;

//obtain user-specific config
var WORKSPACEID = config.conversationWorkspaceId;

var hardware = ['microphone','speaker','led', 'servo'];

var tjConfig = {
	log: {
		level:'verbose'
	}
};


/*
 * Set Up TJBot
 * We only begin this function once the authentication process has finished.
 * */
var setUpTJBot = function (authentication){
	update(authentication);	
	//instantiate our TJBot!
	var tj = new TJBot(hardware, tjConfig, credentials);
	tj.wave();
	tj.shine('green');
	
	var isListening = true;
	//Listen for a command
	tj.listen(function(msg) {
			tj.pauseListening(); //Blocks asynchronous convos
			tj.converse(WORKSPACEID, msg, function(response){
				tj.shine('orange');
				var context = tj._conversationContext[WORKSPACEID];
				//console.log(response.object.entities);
				var obj = tj.speak(response.object.output.text + '')
				if (obj) obj.then(function() {tj.shine('blue');tj.resumeListening();}); // [+ ''] Turns it into string so TJ actually speaks - dont listen until after done speaking
				console.log(obj+ 'tjspeaks');
				//Avoids responding to itself.
				console.log(response.object.output);
				if(response.object.output.action + '' == 'recommendKnowingWho') {
					tj.pauseListening();
					tj.shine('pink');
					var peopleNames = context.invitees;
					var peopleInput = [];
					//Pair these names with people objects.
					var people = [];
					try {
						people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
						for (var j = 0; j < peopleNames.length; j++) {
							for (var i = 0; i < people.length; i++) {
								if (people[i].names) {
								for (var k = 0; k < people[i].names.length; k++) {
									if (people[i].names[k].displayName.indexOf(peopleNames[j]) !== -1 ) {
											peopleInput.push(people[i]);
											break;
									}
								}
								}
							}
						}
					} catch(err) {
						console.log(err); //Couldn't find people file..
					}
					var timeMin = moment(context.minDate.value);
					var timeMax = moment(context.maxDate.value)
					recommendWhenFromWho(authentication, peopleInput, timeMin, timeMax,  function(timing) {
						var location = recommendWhereFromWho(peopleInput);
						context.startTime = timing.startTime;
						context.endTime = timing.endTime;
						context.location = location.location;
						context.inviteList = peopleToString(peopleInput);
						context.printRecommendation = true;
						context.date = timing.date;
						context.timeData = timing.timeData;
						//Pass message to initiate print recommendation.
						//Send nonsense characters so Conversation doesn't think it has some intent
						if (context.inviteList && context.date && context.startTime && context.endTime && context.location) {
						tj.speak('My recommendation is to invite ' + context.inviteList  + ' on ' + context.date + ' from ' + context.startTime + 
						' to ' + context.endTime + ' at ' + context.location + '.  Does that work well for you?').then(function(){
						tj.resumeListening();});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();});
						 }
					});
				} else if (response.object.output.action == 'recommendKnowingWhen') {
					tj.shine('pink');
					tj.pauseListening();
					var timeMin = moment(context.minDate.value);
					var timeMax = moment(context.maxDate.value);
					//Change format from 09:00:00 to 09:00
					context.startTime = context.startTime.value.substring(0,context.startTime.value.lastIndexOf(':'));
					context.endTime = context.endTime.value.substring(0,context.endTime.value.lastIndexOf(':'));
					var timing = {
						startTime:context.startTime,
						endTime:context.endTime
						};
					recommendFreeTime(authentication, timing, timeMin, timeMax, function(timing) {
						context.date = timing.date;
						context.timeData = timing.timeData;
						context.invitees = recommendWhoFromWhen(timing, context.numberOfPeopleToInvite);
						context.inviteList = peopleToString(context.invitees);
						context.location = recommendWhereFromWhen(timing).location;
						context.printRecommendation = true;
						if (context.inviteList && context.date && context.startTime && context.endTime && context.location) {
						tj.speak('My recommendation is to invite ' + context.inviteList  + ' on ' + context.date + ' from ' + context.startTime + 
						' to ' + context.endTime + ' at ' + context.location + '.  Does that work well for you?').then(function(){
						tj.resumeListening();});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();});
						 }
					});
				} else if (response.object.output.action == 'recommendKnowingWhere') {
					tj.pauseListening();
					tj.shine('pink');
					console.log('Making recommendations with location...');
					var timeMin = moment(context.minDate.value);
					var timeMax = moment(context.maxDate.value);
					context.location = response.object.input.text.trim();
					console.log(context.location + 'location object');
					recommendWhenFromWhere(authentication, context.location, timeMin, timeMax, function(timing) {
						context.startTime = timing.startTime;
						context.endTime = timing.endTime;
						context.date = timing.date;
						context.timeData = timing.timeData;
						context.invitees = recommendWhoFromWhere(context.numberOfPeopleToInvite,context.location);
						context.inviteList = peopleToString(context.invitees);
						context.printRecommendation = true;
						if (context.inviteList && context.date && context.startTime && context.endTime && context.location) {
						tj.speak('My recommendation is to invite ' + context.inviteList  + ' on ' + context.date + ' from ' + context.startTime + 
						' to ' + context.endTime + ' at ' + context.location + '.  Does that work well for you?').then(function(){
						tj.resumeListening();});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();});
						 }
					});
				} else if (response.object.output.action == 'addEvent') {
					tj.pauseListening();
					tj.shine('pink');
					console.log('adding event');
					var timeData = moment(context.timeData);
					console.log(timeData);
					var startTimeHour = context.startTime.substring(0,context.startTime.indexOf(':'));
					var startTimeMinute = context.startTime.substring(context.startTime.indexOf(':') + 1);
					var timingStartTime = timeData;
					console.log(timingStartTime);
					var endTimeHour = context.endTime.substring(0,context.endTime.indexOf(':'));
					var endTimeMinute = context.endTime.substring(context.endTime.indexOf(':') + 1);
					var timingEndTime = timeData.clone().hour(endTimeHour).minute(endTimeMinute);
					var peopleNames = context.invitees;
					var peopleInput = [];
					var people = [];
					try {
						people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
						for (var j = 0; j < context.invitees.length; j++) {
							for (var i = 0; i < people.length; i++) {
								if (people[i].names) {
								for (var k = 0; k < people[i].names.length; k++) {
									if (people[i].names[k] && people[i].emailAddresses) {
									if (people[i].names[k].displayName.indexOf(peopleNames[j]) !== -1 ) {
											if (people[i].names[k] && people[i].emailAddresses[0]) {
											var personObj = {
												displayName: people[i].names[k],
												email: people[i].emailAddresses[0].value
											}
											peopleInput.push(personObj);
											break;
										}
									}
									}
								}
								}
							}
						}
					} catch(err) {
						console.log(err); //Couldn't find people file..
					}
					var calendar = google.calendar('v3');
					calendar.events.insert({
							auth:authentication,
							calendarId:'primary',
							resource: {
								start: {
									dateTime : timingStartTime.toISOString()},
								end: {
									dateTime: timingEndTime.toISOString()},
								summary: context.location + ' with ' +context.inviteList,
								description: 'Made With TJBot and TJCalendar!',
								location: context.location,
								attendees: peopleInput
								}
							},function(err, something){
								 if (err) {
								console.log('The API returned an error: ' + err);
								return;
								}
								console.log(something);
						});
						tj.resumeListening();
						
				} else if (response.object.output.action == 'findNewPlace') {
					tj.pauseListening();
					tj.shine('pink');
					findNewPlace(response.object.input.text, context.locationType, function(location) {
					if (location && location !== 'Bad Location') {
						var timeMin = moment(context.minDate.value);
						var timeMax = moment(context.maxDate.value);
						context.location = location;
						console.log(context.location + 'location object');
						//Change format from 09:00:00 to 09:00
					context.startTime = context.startTime.value.substring(0,context.startTime.value.lastIndexOf(':'));
					context.endTime = context.endTime.value.substring(0,context.endTime.value.lastIndexOf(':'));
						var timing = {
							startTime: context.startTime,
						endTime: context.endTime
						};
						console.log(timing);
					recommendFreeTime(authentication, timing, timeMin, timeMax, function(timing) {
						context.date = timing.date;
						context.timeData = timing.timeData;
						console.log(context.numberOfPeopleToInvite);
						context.invitees = recommendWhoFromWhen(timing, context.numberOfPeopleToInvite);
						context.inviteList = peopleToString(context.invitees);		
						context.printRecommendation = true;
						console.log(context.inviteList + ' ' + context.date + ' ' + context.startTime + ' ' + context.endTime + ' ' +context.location);
						if (context.date && context.startTime && context.endTime && context.location) {
						tj.speak('My recommendation is to invite ' + context.inviteList  + ' on ' + context.date + ' from ' + context.startTime + 
						' to ' + context.endTime + ' at ' + context.location + '.  Does that work well for you?').then(function(){
						tj.resumeListening();});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();});
						 }
					});
					} else {
						//Our search query didn't yield any results, or we have an error.
						tj.speak('Unfortunately, I couldn\'t find anything for you. Try to have a shorter statement when I ask you to clarify.').then(function(){
						tj.resumeListening();});
						
					 }
					});
						
				}
				else{
					
					
				}
			});
		
		
	});
}
/**
 * Transcribes list of people objects into string that will be said by TJBot
 * @param {[person]} people Array of people
 * Returns string
 */
function peopleToString(people) {
	var string = '';
	for (var i = 0; i < people.length; i++) {
		string += people[i].names[0].displayName + ', ';
		if (i == people.length - 2) {
			string += 'and '
		} 
	}
	return string;
}





/*Begin/Check Authenticcation Process*/
// Load client secrets from a local file.
	fs.readFile('client_secret.json', function processClientSecrets(err, content) {
	  if (err) {
	    console.log('Error loading client secret file: ' + err);
	    return;
	  }
	  // Authorize a client with the loaded credentials, then call the
	  // Google APIs.
		console.log('Authorizing Credentials....');
	  authorize(JSON.parse(content),setUpTJBot);
	});





/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials,callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
	console.log('Passing auth to TJBot js file...');
      callback(oauth2Client);//, google.calendar('v3'));
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
	 fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  console.log(JSON.stringify(token));
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/**
 * Lists the next 10 events on the user's primary calendar.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  var calendar = google.calendar('v3');
  calendar.events.list({
    auth: auth,
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime'
  }, function(err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }
    var events = response.items;
    if (events.length == 0) {
      console.log('No upcoming events found.');
    } else {
      console.log('Upcoming 10 events:');
      for (var i = 0; i < events.length; i++) {
        var event = events[i];
        var start = event.start.dateTime || event.start.date;
        console.log('%s - %s', start, event.summary);
      }
    }
  });
}

/**
* Recommends a time slot for an event.
* @param {Integer} timeFrame Amount of time, in hours, the event will need
* @param {moment} timeMin The earliest day with which we can plan the event.
* @param {moment} timeMax The latest day with which we can plan the event.
* @param {Integer} numRecs The number of recommendations we should make
*/
function recommendFreeTime (auth, timing, timeMin, timeMax, callback) {
	var calendar = google.calendar('v3');
	calendar.freebusy.query({
		auth: auth,
		resource: {
			timeMin: timeMin.toISOString(),
			timeMax: timeMax.toISOString(),
			items: [{
				id:'primary'
			}]
		}
	}, function(err, response) {
		if (err) {
			console.log(err);
			return;
		}
		var possibleDates = [];
		var numBusyTimeSlots = response.calendars.primary.busy.length;
		var startTime = moment(response.calendars.primary.busy[0].start) === timeMin ? 
		moment(response.calendars.primary.busy[0].end) : timeMin;
		for (var i = 0; i < numBusyTimeSlots; i++) {
			var endTime = moment(response.calendars.primary.busy[i].start);
			var possibleEvent = {};
			possibleEvent.start = {
				dateTime:startTime.toISOString()
				};
			possibleEvent.end = {
				dateTime:endTime.toISOString()
			}
			if (startTime.dayOfYear() !== endTime.dayOfYear()) {
				console.log('Different days...');
				console.log(startTime.dayOfYear() + ' ' + timing.endTime.substring(0,timing.endTime.indexOf(':')) +  ' ' + timing.endTime.substring(timing.endTime.indexOf(':') + 1));
				var newEndTime = startTime.clone().dayOfYear(startTime.dayOfYear()).hour(timing.endTime.substring(0,timing.endTime.indexOf(':'))).minute(timing.endTime.substring(timing.endTime.indexOf(':') + 1));
				console.log(newEndTime);
				var newPossibleEvent = {
					start: {
						dateTime : startTime.toISOString()
					},
					end: {
						dateTime: newEndTime.toISOString()
					}
				};
				if (timingFits(timing, newPossibleEvent)) {
					console.log(' new I should be free here:' + startTime.format('Do HH:mm') + ' - ' + newEndTime.format('Do HH:mm'));
				var obj = {
				 timeData : startTime,
				 date : startTime.format('dddd MMMM Do')
				};
				var randomIndex = Math.floor(Math.random() * possibleDates.length);
				//Randomly add event
				possibleDates.splice(randomIndex, 0, obj);
				}
				for (var j = 1; j <= endTime.diff(startTime,'days'); j++ ) {
					console.log(endTime.date() + ' ' +endTime.hour() + ':' +endTime.minute());
					console.log(moment().clone().hour(endTime.hour()).minute(endTime.minute()).diff(moment().clone().hour(timing.endTime.substring(0,timing.endTime.indexOf(':'))).minute(timing.endTime.substring(timing.endTime.indexOf(':') + 1))));
					if (j < endTime.diff(startTime,'days')  || moment().clone().hour(endTime.hour()).minute(endTime.minute()).diff(moment().clone().hour(timing.endTime.substring(0,timing.endTime.indexOf(':'))).minute(timing.endTime.substring(timing.endTime.indexOf(':') + 1))) >= -60 * 1000) {
					var jStartTime = startTime.clone().add(j,'days').hour(timing.startTime.substring(0,timing.startTime.indexOf(':'))).minute(timing.startTime.substring(timing.startTime.indexOf(':') + 1));
					var jEndTime = startTime.clone().add(j,'days').hour(timing.endTime.substring(0,timing.endTime.indexOf(':'))).minute(timing.endTime.substring(timing.endTime.indexOf(':') + 1));
					var jPossibleEvent = {
					start: {
						dateTime : jStartTime.toISOString()
					},
					end: {
						dateTime: jEndTime.toISOString()
					}
					}; 
					if (timingFits(timing, jPossibleEvent)) {
						console.log('j I should be free here:' + jStartTime.format('Do HH:mm') + ' - ' + jEndTime.format('Do HH:mm'));
					var obj = {
				 timeData : jStartTime,
				 date : jStartTime.format('dddd MMMM Do')
					};	
					var randomIndex = Math.floor(Math.random() * possibleDates.length);
					//Randomly add event
					possibleDates.splice(randomIndex, 0, obj);
					}
					}
				}
			} else {
				if (timingFits(timing, possibleEvent)) {
					console.log('I should be free here:' + startTime.format('Do HH:mm') + ' - ' + endTime.format('Do HH:mm'));
				if (startTime) {
				var obj = {
				timeData : startTime,
				 date : startTime.format('dddd MMMM Do')
				};
				}
				var randomIndex = Math.floor(Math.random() * possibleDates.length);
				//Randomly add event
				possibleDates.splice(randomIndex, 0, obj);
				}
			}
			
			startTime = moment(response.calendars.primary.busy[i].end);
		}
		//Check last window not caught by for loop
		var lastEndTime = timeMax;
		var lastPossibleEvent = {
					start: {
						dateTime : startTime.toISOString()
					},
					end: {
						dateTime: lastEndTime.toISOString()
					}
		};
		if (timingFits(timing, lastPossibleEvent)) {
					console.log('I should be free here:' + startTime.format('Do HH:mm') + ' - ' + lastEndTime.format('Do HH:mm'));
				if (startTime) {
				var obj = {
				timeData : startTime,
				 date : startTime.format('dddd MMMM Do')
				};
				}
				var randomIndex = Math.floor(Math.random() * possibleDates.length);
				//Randomly add event
				possibleDates.splice(randomIndex, 0, obj);
		}
		//Test Code TODO:Remove this
			for (var l = 0; l < possibleDates.length; l++) {
					console.log(possibleDates[l]);
			}
		
		timing.date = possibleDates[0].date;
		timing.timeData = possibleDates[0].timeData;
		//Pass random available date to timing object.
		callback(timing); //Pass timing object to callback function.
	});
	
}

/**
 * updates calendar and people data.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function update(auth) {
	var credFile  = JSON.parse(fs.readFileSync(TOKEN_PATH));
	//10 years worth of data is plenty!
	//Add parameter for lastTimeUpdated
	if(credFile.lastTimeUpdated)
		timeMin = credFile.lastTimeUpdated;
	else 
		timeMin = moment().clone().subtract(10,'years').toISOString(); //This must be the first time we downloaded data! How snazzy.
	
	//Get sync token that is used to fetch only updated contacts.
	var oldSyncToken = credFile.syncToken;
	//Update People
	//credFile.syncToken = 
	updatePeople(auth, oldSyncToken);
	//Add parameter for lastTimeUpdated
	credFile.lastTimeUpdated = moment().toISOString();
	//Update file withLastTimeUpdated
	fs.writeFileSync(TOKEN_PATH, JSON.stringify(credFile));
}

function updatePeople(auth, pageToken) {
	//Get entire list of contacts
	googlePeople.people.connections.list({
	auth: auth,
		resourceName:'people/me',
		pageSize: 500,
		pageToken: pageToken,
		//requestSyncToken:true,
		//syncToken: syncToken,
		'requestMask.includeField': 'person.names,person.email_addresses'
	},function(err, response){
		if(err) {
			console.log(err);
			return;
		} 
		var people = [];
		try {
			//people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
		} catch (err) {
			//File not found... Probably doesn't exist yet.
		}
		//Update people JSON file.
		for (var i = 0; i < response.connections.length; i++) {
			if (response.connections[i].names) { //We are not adding a contact without a name.
				/*var personExists = false;
				for (var j = 0; j < people.length; j++) {
					if (people[j]) {
						if (people[j].resourceName === response.connections[i].resourceName) {
							//Keep the event ids. Those are important
							response.connections[i].events = people[j].events;
							people[j] = response.connections[i];
							personExists = true;
							break;
						}
					}
				}
				if (!personExists) {
					response.connections[i].events = [];*/
					var person = response.connections[i];
					person.events = [];
					people.push(person);
				//}
			}
		}
		
		
		//TODO:Go through Discovery, query names.
		
		//If names are 'contained' in any of aliases, add event to person event array.
		//Store contacts in JSON file.
		fs.writeFileSync(TOKEN_DIR + 'people.json', JSON.stringify(people));
		if (response.nextPageToken) {
			//We haven't received all our results yet.
			console.log('Sending another people request...');
			updatePeople(auth,response.nextPageToken); //Ewww... recursion...
		} else {
		//Download Calendar History and Update 
		downloadCalendarHistory(auth);
		//return response.nextSyncToken; 
		}	
	});
}


function downloadCalendarHistory (auth) { 
	var calendar = google.calendar('v3');
	//Get first page of results.
	//TODO: Add pagination if 2500 events just isn't enough.
	calendar.events.list({
		auth: auth,
		calendarId: 'primary',
		alwaysIncludeEmail: true,
		maxResults:2500,
	}, function (err,response) {
		if (err) {
			console.log(err);
			return;
		}
		
		var events = [];		
		//Write new/updated events to disk.
		userName = response.items[0].creator.displayName; //TODO: Get displayName from token just in case creator isn't user (//Write new/updated events to disk
		/*for (var i = 0; i < response.items.length;i++) {
		//Check if the event has a location, add a type parameter, if available, then write event object to disk.
		
		
		 if (event.location) {
			 console.log(event.location);
				googleMapsClient.places({
					query: event.location
				}, function(err,response) {
				if (err) { 
					console.log('Error' + response);
				} else {
					console.log('Success!');
					if (response.status == 200) {
					console.log(response.json.results);
					if (response.results[0].types[0]) {
						event.type = response.json.results[0].types[0];
					}
					}
					
				}
				
				});
			
			}
		
		
		}*/
		//Go through all events.
		//If attendees email matches a contact, add the event id to their events.
		for (var i = 0; i < response.items.length; i++) {
			var eventId = response.items[i].id;
			var event = response.items[i];
			events.push(eventId);
			try {
				if (response.items[i].attendees) {
					for (var j = 0; j < response.items[i].attendees.length; j++) {
						addEventToPerson(response.items[i].attendees[j], response.items[i].id);
					}		
				}
				fs.writeFileSync(TOKEN_DIR + eventId + '.json', JSON.stringify(event));
			} catch(error) {
				//Means that attendees was null. We're fine. Relax.
			}
		}
		try {
			creds = JSON.parse(fs.readFileSync(TOKEN_PATH));
			creds.events = events;
			fs.writeFileSync(TOKEN_PATH, JSON.stringify(creds));
		} catch (err) {
			console.log(err);
		}
		//Use Discovery queries for getting even more people (not listed as attendees but in summaries/descriptions)
		discovery = new DiscoveryV1({
			username: 'b2478ad1-d80a-4d8d-84f9-a4bfef3798ad',
			password: 'ZxNyjY1Jdca2', 
			version_date: DiscoveryV1.VERSION_DATE_2017_04_27
		});
		discovery.query(
		{environment_id:'3294a2c3-8012-47cd-b939-19ddd3325ddd', 
		collection_id:'50130334-f2e9-49aa-9aca-ec320a3898a0', 
		query: 'enriched_description.entities.type:person', count: 1000}, function(error, data) {
		
		//Look through description fields for names
		for (var i = 0; i < data.results.length; i++) {
			for (var j = 0; j < data.results[i].enriched_description.entities.length; j++) {
				if (data.results[i].enriched_description.entities[j].type === "Person") {
					var person = {
						name : data.results[i].enriched_description.entities[j].text
					};
					addEventToPerson(person, data.results[i].id);
				}
			}
		}
		discovery.query(
		{environment_id:'3294a2c3-8012-47cd-b939-19ddd3325ddd', 
		collection_id:'50130334-f2e9-49aa-9aca-ec320a3898a0', 
		query: 'enriched_summary.entities.type:person', count: 1000}, function(error, data) {
		//Look through description fields for names
		for (var i = 0; i < data.results.length; i++) {
			for (var j = 0; j < data.results[i].enriched_summary.entities.length; j++) {
				if (data.results[i].enriched_summary.entities[j].type === "Person") {
					var person = {
						name : data.results[i].enriched_summary.entities[j].text
					}
					addEventToPerson(person, data.results[i].id);
				}
			}
		}
		
		/***********
		 * TESTS
		 * ********/
		 //console.log(recommendWhenFromWhere('Fox Lane High School, Mt Kisco, NY 10549, United States')); WORKS
		 //console.log(recommendWhoFromWhere(3,'6 Flags Great Adventure New Jersey')); WORKS
		 //var testPeople = JSON.parse('[{"resourceName":"people/c4413104960845401765","etag":"%EgMBAgk=","names":[{"metadata":{"primary":true,"source":{"type":"CONTACT","id":"3d3e7f948bb44ea5"}},"displayName":"Alison Gregory","familyName":"Gregory","givenName":"Alison","displayNameLastFirst":"Gregory, Alison"},{"metadata":{"source":{"type":"PROFILE","id":"100273988944898949200"}},"displayName":"Alison Gregory","familyName":"Gregory","givenName":"Alison","displayNameLastFirst":"Gregory, Alison"}],"emailAddresses":[{"metadata":{"primary":true,"source":{"type":"CONTACT","id":"3d3e7f948bb44ea5"}},"value":"alisongregoryknipp@gmail.com","type":"other","formattedType":"Other"},{"metadata":{"source":{"type":"CONTACT","id":"3d3e7f948bb44ea5"}},"value":"alisongregoryknippny@gmail.com","type":"home","formattedType":"Home"},{"metadata":{"source":{"type":"CONTACT","id":"3d3e7f948bb44ea5"}},"value":"alisongregoryny@gmail.com","type":"other","formattedType":"Other"},{"metadata":{"source":{"type":"CONTACT","id":"3d3e7f948bb44ea5"}},"value":"Amgbedford@AOL.com","type":"other","formattedType":"Other"}],"events":["61i34c9o70q34b9k6sq38b9kc5j3cb9o68q34b9m6tj32o9o6gr6adb5ck","60p36oj6cgo6abb66ko3eb9k6os62b9o74q68bb668q3gdj5ccojaohk6k","uqd04n56onbof7rv6n7jcgqak4","j1a2gqoj85k4nk49ukc4tbjkgk","uoltnun16l2pv0m1vq0vui5i84","pn7jf8abnkradeagkigqq97nps","rv00bib7g01ovmeddos1mfg56s","6pj66dr56th3eb9jccq3eb9kc8om4b9o6oo3cb9p6gq3ichl6gqjgdb470","rhq1f0bu6h9vk0iv5fr6l9mic8","3qucct0v1r8mnpkv2bathi8gms"]}]');
		 //console.log(testPeople);
		 //console.log(recommendWhenFromWho(testPeople));WORKS
		 //console.log(recommendWhereFromWho(testPeople)); WORKS
		 //var timing = {
			// startTime:'19:00',
			 //endTime:'20:00'
		 //};
		 //console.log(recommendWhoFromWhen(timing,3));WORKS
		 //console.log(recommendWhereFromWhen(timing)); WORKS
		//We are done adding people. Update JSON file.		
		//runTestCode(auth);
		
		});
		//recommendPeople('Rachel', 3); //Really only works with first names.
		});
		

		
	
		/*Supposed to break up each event for its own JSON file and add it to collection in 
		Discovery. Add Document does not work:
		//https://github.com/watson-developer-cloud/node-sdk/issues/397*
		for (var i = 0; i < response.items.length;i++) {
			fs.writeFileSync('Event' + i +'.json', JSON.stringify(response.items[i]));
		var file = fs.readFileSync('Event' + i +'.json');
		console.log('Adding Document');
		/*discovery.addDocument({environment_id:'3294a2c3-8012-47cd-b939-19ddd3325ddd', 
		collection_id:'50130334-f2e9-49aa-9aca-ec320a3898a0',
		configuration_id:'1b46e4e9-ccc8-4478-8c6f-8dc1e2eb94dc', 
		file: {
	    value: JSON.stringify(response),
	    options: {
      	filename: 'Event' + i + '.json',
    	  contentType: 'application/json'
	    }
  		}},
		function(error, data) {
			if (error)
				console.log(error);
		});*
		}*/
		
		
		/*
		As a backup, find a way to parse information your own way!
		Ideas: Use Natural Language Understanding, extract fields which could contain important
		information (summary,description, attendees)
		var importantText = '';
		for (var i = 0; i < response.items.length; i++) {
		console.log(response.items[i]);
			importantText += response.items[i].summary + ' ' + response.items[i].description 
			+ ' ' + response.items[i].attendees.toString();
		}
		
		
		var natural_language_understanding = new NaturalLanguageUnderstandingV1({
	 	 'username': '89afb475-4549-422d-a0f0-4834a6c79a4f',
		  'password': 'XTIyoLjbz06C',
		  'version_date': '2017-02-27'
			});

		var parameters = {
		  'text': importantText,
		  'features': {
	    	'entities': {
		      'people': true, 
	    	  'limit': 10
	    	}
		  }
		};

		natural_language_understanding.analyze(parameters, function(err, result) {
  		if (err)
    		console.log('error:', err);
		  else
    		console.log(JSON.stringify(result, null, 2));
		});*/	
		
	//recommendFreeTime(auth, 2, moment(), moment().add(3,'days'), 4);
	//recommendPeople('John Gregory', 3)
	//setUpTJBot(auth);
	});
}


function addEventToPerson(person, eventId) {
	//Load person
	if (!person.displayName)
		person.displayName = 'Fake name'; //Not a name... but we need something to avoid errors.
	if (!person.email)
		person.email = 'bademail@baddomain.badcom' //Not an email ... but we need something to avoid errors.
	if (!(person.displayName === userName) && !(person.email === email)) {//Don't add the user
		var people = [];
		try {
			people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
		} catch(err) {
			console.log('This shouldn\'t happen: ' + err);
		}
		for (var i = 0; i < people.length; i++) {
			//For each person saved...
				for (var j = 0; j < people[i].names.length; j++) {
					if (people[i].names[j].displayName.indexOf(person.displayName) !== -1) {
						//We have a match! Add the id.
						people[i].events.push(eventId);
						fs.writeFileSync(TOKEN_DIR + 'people.json',JSON.stringify(people));
						return;
					}
				} 
		
			if (people[i].emailAddresses) {//Some contacts don't have email addresses
			for (var j = 0; j < people[i].emailAddresses.length; j++) {
				if (people[i].emailAddresses[j].value === person.email) {
					//We have a match! Add the id.
					people[i].events.push(eventId);
					fs.writeFileSync(TOKEN_DIR + 'people.json',JSON.stringify(people));
					return;
				}
			} 
			}
		}
	}
	//We didn't find a match. They must be not important.
}


/**
*Adds location to array.
*/
function addLocation(location) {
	//Check to see if location already exists in array
	for (var i = 0; i < locations.length; i++) {
		if (locations[i].name === location) {
			locations[i].score++;
			return;
		}	
	}
	//Didn't find a match. Let's add it instead.
	var locationEntry = {
		name: location,
		score: 1
	}
	locations.push(locationEntry);
}

/**
*Compares people/locations on 'score' for sorting
* @param {Object} p1 Object that has score
* @param {Object} p2 Object that has score
*/
function compare(p1, p2) {
	if (p1.score>p2.score)
		return -1;
	if (p1.score<p2.score)
		return 1;
	return 0;
}
/**
 * 	Recommends timeframe given a location and it's opening hours.
 * TODO: Figure out way to find place details, while considering API limitations.	
 * 
 */
function recommendWhenFromNewPlace() {

}



/**
*	Recommends who to invite based on where event is.
*	@param {Integer} numRecs number of people to invite
*	@param {location} location where event will be 
*	Returns array of recommended people
*/
function recommendWhoFromWhere(numRecs, location) {
	location += ''; //Turn into string?
	var people = [];
	try {
		people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
	} catch (err) {
		//File doesn't exist yet....shouldn't happen
		console.log(err);
	}
	for (var i = 0; i < people.length; i++) {
		people[i].score = 0;
		if (people[i].events) {
			for (var j = 0; j < people[i].events.length; j++) {
				try {
					var event = JSON.parse(fs.readFileSync(TOKEN_DIR + people[i].events[j] +'.json' ));
					if (event.location) {
					if (event.location.indexOf(location) !== -1) {
						console.log(people[i].score + 'score');
						if (people[i].score)
							people[i].score++;
						else
							people[i].score = 1;
					}
					}
				} catch(err) {
					//Event doesn't exist. Also shouldn't happen.
					console.log(err);
				} 
			} 
		}
	}
	people.sort(compare);
	//TODO: Filter out items with score of 0
	var recs = [];
	console.log(people[people.length - 1]);
	if (people.length > numRecs) {
		for (var i = 0; i < numRecs; i++)
			recs.push(people[i].names);
	}
	return recs;
}
//4/6mNt5VgJdbUdv3Q8k44UboGQWjjkMCa_IIAYHmPQFBQ
/**
*	Recommend when event should be held based on where it is.
*	@param {location} location Where event will be held
*/
function recommendWhenFromWhere(auth, location, timeMin, timeMax, callback){
	var eventIds = [];
	try {
		eventIds = JSON.parse(fs.readFileSync(TOKEN_PATH)).events;
	}
	catch (err) {
		//Creds file doesn't exist. shouldn't happen.
		console.log(err);
	}
	var startTimes = [];
	var endTimes = [];
	if (eventIds) {
		for (var i = 0; i < eventIds.length; i++) {
			try {
				var event = JSON.parse(fs.readFileSync(TOKEN_DIR + eventIds[i] +'.json' ));
				if (event.location) {
					event.location = event.location.toLowerCase();
				if (event.location.indexOf(location) !== -1) {
					var foundStartTime = false;
					console.log(event.start.dateTime);
					var startTimeMoment = moment(event.start.dateTime);
					var startTime = startTimeMoment.format('HH:mm');
					if (startTime) {
					for (var j = 0; j < startTimes.length; j++) {
						if (startTimes[j].startTime.indexOf(startTime) !== -1) {
							startTimes[j].score++;
							foundStartTime = true;
							break;
						}
					}
					if (!foundStartTime) {
						var startTimeObj = {
							startTime: startTime,
							score: 1
						}
						startTimes.push(startTimeObj);
					}
					}
					var foundEndTime = false;
					var endTimeMoment = moment(event.end.dateTime);
					var endTime = endTimeMoment.format('HH:mm');
					if (endTime) {
					for (var j = 0; j < endTimes.length; j++) {
						if (endTimes[j].endTime.indexOf(endTime) !== -1) {
							endTimes[j].score++;
							foundEndTime = true;
							break;
						}
					}
					if (!foundEndTime) {
						var endTimeObj = {
							endTime: endTime,
							score: 1
						}
						endTimes.push(endTimeObj);
					}
					}
				}
			}
			} catch(err) {
			 //Event doesn't exist. Also shouldn't happen.
			console.log(err);
			}		
		}
	}
	startTimes.sort(compare);
	endTimes.sort(compare);
	console.log(startTimes[0]);
	console.log(endTimes[0]);
	if (startTimes && startTimes.length >= 1 && endTimes && endTimes.length >= 1) {
		var timing = {
		startTime : startTimes[0].startTime,
		endTime : endTimes[0].endTime
		}
		recommendFreeTime(auth, timing, timeMin, timeMax, callback);
	}
}


/**
*	Recommends where event should be based on who is attending.
*	@param {[people]} people Who will be attending
*/
function recommendWhereFromWho(people) {
	var places = [];
	for (var i = 0; i < people.length; i++) {
		if (people[i].events) {
		for (var j = 0; j<people[i].events.length; j++) {
			var place = 'asdf';
			try {
				place = JSON.parse(fs.readFileSync(TOKEN_DIR + people[i].events[j] + '.json')).location;
				var foundPlace = false;
				for (var k = 0; k < places.length; k++) {
					if (places[k].location.indexOf(place + '') !== -1) {
						places[k].score++;
						foundPlace = true;
						break;
					}
				}
				if (!foundPlace && place) {
					var placeObj = {
					location : place,
					score: 1
					}
					places.push(placeObj);
				}
			} catch(err) {
				console.log(err);
			}
		}
		}
	}
	places.sort(compare);
	if (places && places.length > 1)
		return places[0];
}

/**
*	Recommends when (what time) event should be held based on who is attending
*	@param {[people]} people who will be attending
*/
function recommendWhenFromWho (auth,  people, timeMin, timeMax, callback) {
	var startTimes = [];
	var endTimes = [];
	for (var i = 0;  i < people.length; i++){
		if (people[i].events) {
			for (var j = 0; j < people[i].events.length; j++) {
				try {
					var event = JSON.parse(fs.readFileSync(TOKEN_DIR + people[i].events[j] +'.json' ));
					var foundStartTime = false;
					var startTimeMoment = moment(event.start.dateTime);
					var startTime = startTimeMoment.format('HH:mm') + '';
					console.log(startTime + i + j);
					for (var k = 0; k < startTimes.length; k++) {
						if (startTimes[k].startTime == startTime) {
							startTimes[k].score++;
							foundStartTime = true;
							break;
						}
					}
					if (!foundStartTime) {
						var startTimeObj = {
							startTime: startTime,
							score: 1
						}
						startTimes.push(startTimeObj);
					}
					var foundEndTime = false;
					var endTimeMoment = moment(event.end.dateTime);
					var endTime = endTimeMoment.format('HH:mm');
					for (var l = 0; l < endTimes.length; l++) {
						if (endTimes[l].endTime == endTime) {
							endTimes[l].score++;
							foundEndTime = true;
							break;
						}
					}
					if (!foundEndTime) {
						var endTimeObj = {
							endTime: endTime,
							score: 1
						}
						endTimes.push(endTimeObj);
					}
				} catch(err) {
					console.log(err);
				}
			}
		}
	}
	startTimes.sort(compare);
	endTimes.sort(compare);
	if (startTimes && startTimes.length > 1 && endTimes && endTimes.length > 1) {
		var timing = {
		startTime : startTimes[0].startTime,
		endTime : endTimes[0].endTime
		}
		console.log(timing);
		console.log(timeMin.toISOString() + timeMax.toISOString());
		recommendFreeTime(auth, timing, timeMin, timeMax, callback);
	}
}

/**
*	Recommends people based on the timing of the event
*	@param {Timing} timing Object containing start and end time.
*	@param {Integer} numRecs The number of people to recommend
*/
function recommendWhoFromWhen (timing, numRecs) {
 	var people = [];
	try {
		people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
	} catch (err) {
		//File doesn't exist yet....shouldn't happen
		console.log(err);
	}
	for (var i = 0; i < people.length; i++) {
		people[i].score = 0;
		if (people[i].events) {
			for (var j = 0; j < people[i].events.length; j++) {
				try {
					var event = JSON.parse(fs.readFileSync(TOKEN_DIR + people[i].events[j] +'.json' ));
					if (timingFits(timing, event)) {
						if (people[i].score)
							people[i].score++;
						else
							people[i].score = 1;
						//console.log('It fit:' + people[i].score);
					}
				} catch(err) {
					//Event doesn't exist. Also shouldn't happen.
					console.log(err);
				}
				 
			} 
		}
	}
	people.sort(compare);
	//TODO: Filter out items with score of 0
	var recs = [];
	if (people.length > numRecs) {
		for (var i = 0; i < numRecs; i++)
			//console.log(people[i].names);
			recs.push(people[i]);
	}
	return recs;
	
}

/**
*	Checks if the designated start time and end time are contained within the event time
*	@param {Timing} timing object containing designated start and end times.
*	@param {Google Event} event The event object
*/
function timingFits (timing, event) {
		if (timing && event && timing.startTime && timing.endTime && event.start && event.end) {
		try {
		var startTimeHour = timing.startTime.substring(0,timing.startTime.indexOf(':'));
		var startTimeMinute = timing.startTime.substring(timing.startTime.indexOf(':') + 1);
		var timingStartTime = moment().clone().hour(startTimeHour).minute(startTimeMinute);
		var endTimeHour = timing.endTime.substring(0,timing.endTime.indexOf(':'));
		var endTimeMinute = timing.endTime.substring(timing.endTime.indexOf(':') + 1);
		var timingEndTime = moment().clone().hour(endTimeHour).minute(endTimeMinute);
		var eventStartTimeString = moment(event.start.dateTime).format('HH:mm');
		//console.log(event.start.dateTime + eventStartTimeString);
		var eventStartTimeHour = eventStartTimeString.substring(0,eventStartTimeString.indexOf(':'));
		var eventStartTimeMinute = eventStartTimeString.substring(eventStartTimeString.indexOf(':') + 1);
		var eventStartTime = moment().clone().hour(eventStartTimeHour).minute(eventStartTimeMinute);
		var eventEndTimeString = moment(event.end.dateTime).format('HH:mm');
		var eventEndTimeHour = eventEndTimeString.substring(0,eventEndTimeString.indexOf(':'));
		var eventEndTimeMinute = eventEndTimeString.substring(eventEndTimeString.indexOf(':') + 1);
		var eventEndTime = moment().clone().hour(eventEndTimeHour).minute(eventEndTimeMinute);
		//console.log(timing.startTime + ' - ' + eventStartTimeString + timingStartTime.diff(eventStartTime));
		//console.log(eventEndTimeString + ' - ' + timing.endTime + eventEndTime.diff(timingEndTime));
		return timingStartTime.diff(eventStartTime) >= -60 * 1000 && eventEndTime.diff(timingEndTime) >= -60 * 1000; //If it is within a minute, then we are good.
		} catch (err) {
			//Probably a formatting error. Oopsies.
			console.log(err);
		}	
	}
	return false;
}

/**
* Recommends a location based on the timing of the event.
* @param {Timing} timing object that contains start and end times.
*/
function recommendWhereFromWhen (timing) {
	var eventIds = [];
	try {
		eventIds = JSON.parse(fs.readFileSync(TOKEN_PATH)).events;
	}
	catch (err) {
		//Creds file doesn't exist. shouldn't happen.
		console.log(err);
	}
	var locations = [];
	for (var i = 0; i < eventIds.length; i++) {
		try {
			var event = JSON.parse(fs.readFileSync(TOKEN_DIR + eventIds[i] + '.json'));
			if (event.location) {
			if (timingFits(timing,event)) {
				var locationObj = {
					location:event.location,
					score:1
				}
				var foundLocation = false;
				for (var j = 0; j < locations.length; j++) {
					if (locations[j].location.indexOf(locationObj.location) !== -1) {
						locations[j].score++;
						console.log(locations[j]);
						foundLocation = true;
						break;
					}
				}	
				if (!foundLocation) {
					locations.push(locationObj);
				}
			}
			}
		} catch (err) {
			//Event file not found??
			console.log(err);
		}
	}
	locations.sort(compare);
	return locations[0];
}

function findNewPlace (queryString, type, callback){
	googleMapsClient.places({query:queryString},function(err,response){
		if (!err) {
			console.log(response.json);
			if (response.json.results[0].formatted_address)
			callback(response.json.results[0].formatted_address);
			else 
			callback('Bad Location');
		} else {
			console.log(err);
			callback('Bad Location');
		}
	});
}
