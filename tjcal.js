var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googlePeople = google.people('v1');
var googleAuth = require('google-auth-library');
var moment = require('moment');
moment().format();
var TJBot = require('tjbot');
var config = require('./config');
var NatLangUnd = require('watson-developer-cloud/natural-language-understanding/v1');
var userName = ''; 
var email = '';
var googleMapsClient = require('@google/maps').createClient(config.mapsKey);
// If modifying these scopes, delete your previously saved credentials
// at TOKEN_PATH
var SCOPES = ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/contacts.readonly','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile'];
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
	//Listen for a command
	tj.listen(function(msg) {
			tj.pauseListening(); //Blocks asynchronous convos
			console.log('Listening to ' + msg);
			tj.shine('orange');
			tj.converse(WORKSPACEID, msg, function(response){
				var context = tj._conversationContext[WORKSPACEID];
				var obj = tj.speak(response.object.output.text + '');
				if (obj) obj.then(function() {tj.resumeListening();tj.shine('blue');}); // [+ ''] Turns it into string so TJ actually speaks - dont listen until after done speaking
				//Avoids responding to itself.
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
						tj.resumeListening();
						tj.shine('blue');});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();
						tj.shine('blue');});
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
						tj.resumeListening();
						tj.shine('blue');});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();
						tj.shine('blue');});
						 }
					});
				} else if (response.object.output.action == 'recommendKnowingWhere') {
					tj.pauseListening();
					tj.shine('pink');
					console.log('Making recommendations with location...');
					var timeMin = moment(context.minDate.value);
					var timeMax = moment(context.maxDate.value);
					context.location = response.object.input.text.trim();
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
						tj.resumeListening();
						tj.shine('blue');});
						} else {
						 tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
						tj.resumeListening();});
						tj.shine('blue');
						 }
					});
				} else if (response.object.output.action == 'addEvent') {
					tj.pauseListening();
					tj.shine('pink');
					
					console.log('adding event');
					var timeData = moment(context.timeData);
					console.log(context.startTime + '');
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
					//Make TJ Dance - He is excited after all!
					tj.wave();
					tj.wave();
					tj.wave();
					tj.wave();
					tj.resumeListening();
					tj.shine('blue');
						
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
								tj.resumeListening();tj.shine('blue');});
							} else {
								tj.speak('Sorry about this. I couldn\'t garner enough data to make a recommendation. Try another recommendation, or try again after you use your calendar more.').then(function(){
								tj.resumeListening();tj.shine('blue');});
							}
						});
					} else {
						//Our search query didn't yield any results, or we have an error.
						tj.speak('Unfortunately, I couldn\'t find anything for you. Try to have a shorter statement when I ask you to clarify.').then(function(){
						tj.resumeListening();tj.shine('blue');});
					 }
					});
						
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
		string += people[i].names[0].displayName
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
      //Add user name to token. So we exclude user from invite list. 
      googlePeople.people.get({
		  auth: oauth2Client,
		  resourceName: 'people/me',
		  'requestMask.includeField': 'person.names,person.email_addresses'
		  }, function(err, response) {
			 console.log(response);
			//Store name and email to token
			if (response.names && response.names[0].displayName)
				token.userName = response.names[0].displayName;
			if (response.emailAddresses && response.emailAddresses[0].value)
				token.email = response.emailAddresses[0].value;
			console.log('userName = ' + token.userName);
			console.log('email = ' + token.email);
		storeToken(token);  
		callback(oauth2Client);
	  });
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
			var importantText = response.items[i].summary + ' ' + response.items[i].description;
			var parameters = {
		  'text': importantText,
			'features': {
				'entities': {
					'people': true, 
					'limit': 10
					}
				}
			};

			/*natural_language_understanding.analyze(parameters, function(err, result) {
				if (err) {
				//	console.log('error:', err); Errors are frequent. Often too many requests. Temporarily disabled until we find a better solution.
				}else {
					if (result.entities) {
					for (var l = 0; l < result.entities.length; l++) {
						if (result.entities[l].type == 'Person') {
							var person = {
								displayName: result.entities[l].text
								};
								console.log(person);
							addEventToPerson(person, eventId);
						}
						
					}
					}
				}
			});*/
		}
		try {
			creds = JSON.parse(fs.readFileSync(TOKEN_PATH));
			userName = creds.userName;
			email = creds.email;
			creds.events = events;
			fs.writeFileSync(TOKEN_PATH, JSON.stringify(creds));
		} catch (err) {
			console.log(err);
		}
		});
		

		
	
		/*Supposed to break up each event for its own JSON file and add it to collection in 
		Discovery. Add Document does not work:
		//https://github.com/watson-developer-cloud/node-sdk/issues/397*
		for (var i = 0; i < response.items.length;i++) {
			fs.writeFileSync('Event' + i +'.json', JSON.stringify(response.items[i]));
		var file = fs.readFileSync('Event' + i +'.json');
		console.log('Adding Document');
		/*discovery.addDocument({environment_id:'', 
		collection_id:'',
		configuration_id:'', 
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
	location = location.toLowerCase(); //Don't worry about case, especially with TTS
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
					if (event.location.toLowerCase().indexOf(location) !== -1) {
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
			recs.push(people[i]);
	}
	return recs;
}

/**
*	Recommend when event should be held based on where it is.
*	@param {location} location Where event will be held
*/
function recommendWhenFromWhere(auth, location, timeMin, timeMax, callback){
	location += '';//Turn into string just in case
	location = location.toLowerCase();
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
				if (event.location.toLowerCase().indexOf(location) !== -1) {
					var foundStartTime = false;
					console.log(event.start.dateTime);
					var startTimeMoment = moment(event.start.dateTime);
					var startTime = startTimeMoment.format('HH:mm');
					if (startTime) {
					for (var j = 0; j < startTimes.length; j++) {
						if (startTimes[j].startTime.indexOf(startTime) !== -1) {
							startTimes[j].freq++;
							foundStartTime = true;
							break;
						}
					}
					if (!foundStartTime) {
						
						var startTimeObj = {
							startTime: startTime,
							freq: 1,
							min: startTimeMoment.hour() * 60 + startTimeMoment.minute()
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
							endTimes[j].freq++;
							foundEndTime = true;
							break;
						}
					}
					if (!foundEndTime) {
						var endTimeObj = {
							endTime: endTime,
							freq: 1,
							min: endTimeMoment.hour() * 60 + endTimeMoment.minute()
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
	//Rank times by distance from average time.
	//Find average time
	var averageStartTime = 0;
	var numTimes = 0;
	for (var i = 0; i < startTimes.length; i++) {
		for (var j = 0; j < startTimes[i].freq; j++) {
			numTimes++;
			averageStartTime += startTimes[i].min;
		}
	}
	averageStartTime /= numTimes;
	//Rank times by distance from average time.
	//Find average time
	var averageEndTime = 0;
	numTimes = 0;
	for (var i = 0; i < endTimes.length; i++) {
		for (var j = 0; j < endTimes[i].freq; j++) {
			numTimes++;
			averageEndTime += endTimes[i].min;
		}
	}
	averageEndTime /= numTimes;
	//Give score as difference between time and average
	for (var i = 0; i < startTimes.length; i++) {
		startTimes[i].score = Math.abs(startTimes[i].min - averageStartTime);
	}
	for (var i = 0; i < endTimes.length; i++) {
		endTimes[i].score = Math.abs(endTimes[i].min - averageEndTime);
	}
	startTimes.sort(compare);
	endTimes.sort(compare);
	if (startTimes && startTimes.length >= 1 && endTimes && endTimes.length >= 1 && startTimes[startTimes.length - 1].min > endTimes[endTimes.length - 1].min) {
		//Simpson's paradox. Somehow, the best startTime is AFTER the end time. Let's just switch em.
		var tempTime = startTimes[startTimes.length - 1];
		startTimes[startTimes.length - 1] = endTimes[endTimes.length - 1];
		startTimes[startTimes.length - 1].startTime = startTimes[startTimes.length - 1].endTime; 
		endTimes[endTimes.length - 1] = tempTime;
		endTimes[endTimes.length - 1].endTime = endTimes[endTimes.length - 1].startTime;
		
	}
	if (startTimes && startTimes.length >= 1 && endTimes && endTimes.length >= 1) {
		//Return last elements: we want a LOW score here.
		var timing = {
		startTime : startTimes[startTimes.length - 1].startTime,
		endTime : endTimes[endTimes.length - 1].endTime
		};
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
							startTimes[k].freq++;
							foundStartTime = true;
							break;
						}
					}
					if (!foundStartTime) {
						var startTimeObj = {
							startTime: startTime,
							freq: 1,
							min: startTimeMoment.hour() * 60 + startTimeMoment.minute()
						};
						startTimes.push(startTimeObj);
					}
					var foundEndTime = false;
					var endTimeMoment = moment(event.end.dateTime);
					var endTime = endTimeMoment.format('HH:mm');
					for (var l = 0; l < endTimes.length; l++) {
						if (endTimes[l].endTime == endTime) {
							endTimes[l].freq++;
							foundEndTime = true;
							break;
						}
					}
					if (!foundEndTime) {
						var endTimeObj = {
							endTime: endTime,
							freq: 1,
							min: endTimeMoment.hour() * 60 + endTimeMoment.minute()
						};
						endTimes.push(endTimeObj);
					}
				} catch(err) {
					console.log(err);
				}
			}
		}
	}
	
	//Rank times by distance from average time.
	//Find average time
	var averageStartTime = 0;
	var numTimes = 0;
	for (var i = 0; i < startTimes.length; i++) {
		for (var j = 0; j < startTimes[i].freq; j++) {
			numTimes++;
			averageStartTime += startTimes[i].min;
		}
	}
	averageStartTime /= numTimes;
	//Rank times by distance from average time.
	//Find average time
	var averageEndTime = 0;
	numTimes = 0;
	for (var i = 0; i < endTimes.length; i++) {
		for (var j = 0; j < endTimes[i].freq; j++) {
			numTimes++;
			averageEndTime += endTimes[i].min;
		}
	}
	averageEndTime /= numTimes;
	//Give score as difference between time and average
	for (var i = 0; i < startTimes.length; i++) {
		startTimes[i].score = Math.abs(startTimes[i].min - averageStartTime);
	}
	for (var i = 0; i < endTimes.length; i++) {
		endTimes[i].score = Math.abs(endTimes[i].min - averageEndTime);
	}
	startTimes.sort(compare);
	endTimes.sort(compare);
	if (startTimes && startTimes.length > 1 && endTimes && endTimes.length > 1 && startTimes[startTimes.length - 1].min > endTimes[endTimes.length - 1].min) {
		//Simpson's paradox. Somehow, the best startTime is AFTER the end time. Let's just switch em.
		var tempTime = startTimes[startTimes.length - 1];
		startTimes[startTimes.length - 1] = endTimes[endTimes.length - 1];
		startTimes[startTimes.length - 1].startTime = startTimes[startTimes.length - 1].endTime; 
		endTimes[endTimes.length - 1] = tempTime;
		endTimes[endTimes.length - 1].endTime = endTimes[endTimes.length - 1].startTime;
		
	}
	if (startTimes && startTimes.length > 1 && endTimes && endTimes.length > 1) {
		var timing = {
		startTime : startTimes[startTimes.length - 1].startTime,
		endTime : endTimes[endTimes.length - 1].endTime
		};
		console.log(timing);
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
	googleMapsClient.places({query:queryString, type:type},function(err,response){
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
