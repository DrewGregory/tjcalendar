var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googlePeople = google.people('v1');
var googleAuth = require('google-auth-library');
var DiscoveryV1 = require ('watson-developer-cloud/discovery/v1');
var NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
var moment = require('moment');
moment().format();
var TJBot = require('tjbot');
var config = require('./config');
var NatLangUnd = require('watson-developer-cloud/natural-language-understanding/v1');
//var quickstart = require('./quickstart');

//TODO: Make these config variables someday...
var cutOffEndHour = 21;
var cutOffStartHour = 8;
var people = [];
var userName = '';
var googleMapsClient = require('@google/maps').createClient({
	key: 'AIzaSyBZ2na0fTHkeA8YIjwdCEOBTvOc5apcmaM'
});
var locations = [];
var locTypes = [];

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/calendar-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/calendar','https://www.googleapis.com/auth/contacts.readonly'];
//(process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/'
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH || process.env.HOMEPATH || process.env.USERPROFILE) + '/.credentials/';//It's a hidden directory. Yeah, we're fancy.
var TOKEN_PATH = TOKEN_DIR + 'tjcal-auth.json';
//sudo pcmanfm
console.log(TOKEN_DIR);
//obtain credentials
var credentials = config.credentials;

//obtain user-specific config
var WORKSPACEID = config.conversationWorkspaceId;

var hardware = ['microphone','speaker'];

var tjConfig = {
	log: {
		level:'verbose'
	}
};



/*
 * Set Up TJBot
 * We only begin this function once the authentication process has finished.
 * */
var setUpTJBot = function (authentication) {
	//instantiate our TJBot!
	var tj = new TJBot(hardware, tjConfig, credentials);
	var isListening = true;
	//Listen for a command
	tj.listen(function(msg) {
		if (isListening) {
			isListening = false; //Blocks asynchronous convos
			tj.converse(WORKSPACEID, msg, function(response){
				tj.speak(response.object.output.text + ''); //Turns it into string so TJ actually speaks
				console.log(tj._conversationContext[WORKSPACEID]);
				if(response.object.output.action + '' === 'recommend_time') {
					//Recommending time!!
					console.log(tj._conversationContext[WORKSPACEID]);
				}
				isListening = true; //Now the listener is ready to listen. We do not want asynchronous convos.
			});
		}
		
	});
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

/******TestCode**********
function runTestCode(auth) {
//function recommendFreeTime (auth, timeFrame, timeMin, timeMax, numRecs) {
	console.log('Hello! Between which dates can this event be?');
	timeMin = moment();
	timeMax = moment().add(3, 'weeks');
	console.log('Great! How long will this event be?')
	timeFrame = 3; //3 hours
	numRecs = 3; //Reasonable amount of recs
	var response = recommendFreeTime(auth, timeFrame, timeMin,timeMax, numRecs);
	console.log(response);
	//Yes
	console.log('Awesome! Which timeframe would work best for you?');
	//Somehow get times. Use quickadd?
	console.log('Sweet! Do you know which people to invite?');
	//No
	console.log('Not a problem! Name one person and how many other people.');
	//Rachel Bellamy, 2 people
	var rec2 = recommendPeople('Rachel', 3);
	console.log(rec2.msg);
	console.log('Name which people, by number, you would like to invite.');
	//1,2
	console.log('Got it! I will invite 1 & 2. Do you want to try a previous place?');
	//Yeah.
	var attendees = [rec2.attendees[0], rec2.attendees[1], {name:'Rachel', events: []}];
	var recLoc = recommendPastPlaces(attendees, 3);
	console.log(recLoc.msg);

}*/




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
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
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
function recommendFreeTime (auth, timeFrame, timeMin, timeMax, numRecs) {
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
		var freeTimes = []; //Array of free time frames, separated by day
		var numBusyTimeSlots = response.calendars.primary.busy.length;
		var startTime = response.calendars.primary.busy[0].start === timeMin ? 
		response.calendars.primary.busy[0].end : timeMin;
		 //index for busy array
		for (var i = 0; i < numBusyTimeSlots; i++) {
			var endTime = moment(response.calendars.primary.busy[i].start).clone();
			if (endTime.date() !== startTime.date()) {
				//Separating free slot into individual days...
				var endTimeFirstDay = startTime.clone().hour(21).minute(0);
				if (fixTimesWithCutOffs(startTime, endTimeFirstDay) && 
				checkTimeFrame(startTime, endTimeFirstDay, timeFrame)) {
					var timeSlotFirstDay = {
						startTime: startTime,
						endTime: endTimeFirstDay
					}
					freeTimes.push(timeSlotFirstDay);
				}
				for (var j = 1; j < endTime.date() - startTime.date(); j++) {
					var tempStartTime = startTime.clone().add(j,'days').hour(cutOffStartHour).minute(0);
					var tempEndTime = startTime.clone().add(j,'days').hour(cutOffEndHour).minute(0);
					if (checkTimeFrame(tempStartTime, tempEndTime, timeFrame)) {
						var timeSlot = {
							startTime : tempStartTime,
							endTime: tempEndTime
						};
						freeTimes.push(timeSlot);
					}
				}
				var startTimeLastDay = endTime.clone().hour(cutOffStartHour).minute(0);
				if (fixTimesWithCutOffs(startTimeLastDay, endTime) 
				&& checkTimeFrame(startTimeLastDay, endTime, timeFrame)) {
					var timeSlotLastDay = {
						startTime : startTimeLastDay,
						endTime : endTime
					}
					freeTimes.push(timeSlotLastDay);
				}
			} else {
				//No separation needed.
				if (fixTimesWithCutOffs(startTime, endTime) &&
				checkTimeFrame(startTime, endTime, timeFrame)) {
					var timeSlot = {
						startTime : startTime,
						endTime : endTime
					}
					freeTimes.push(timeSlot);
				}
					
			}
			startTime = moment(response.calendars.primary.busy[i].end).clone();
		}
		var responseMsg = respondWithFreeTime(freeTimes, numRecs);
		console.log(responseMsg);
	});
}

/**
	Adjusts the start and end times so that they are with the cutoff for a normal schedule
	(not too early in the morning or late at night)
*/
function fixTimesWithCutOffs(startTime, endTime) {
//TODO: Allow for customization of cutoffs.

	if (startTime.hour() < cutOffStartHour && endTime.hour() > cutOffStartHour)
		startTime.hour(cutOffStartHour).minute(0);
//	console.log(startTime);
	if (startTime.hour() < cutOffEndHour && endTime.hour() > cutOffEndHour)
		endTime.hour(cutOffEndHour).minute(0);
	//console.log(endTime);
	return startTime.hour() >= cutOffStartHour && endTime.hour() <= cutOffEndHour;
}

/**
	Verifies if this time slot is desirable for recommendations
	1) 	Duration is long enough
*/
function checkTimeFrame(startTime, endTime, timeFrame) {
	var duration = endTime.diff(startTime);
	return duration >= 1000 * 60 * 60 * timeFrame; 
}

/**
	Generates response string to be said by TJ when asked for availability
*/
function respondWithFreeTime(posTimes, numRecs) {
	if (posTimes.length === 0) {
		return 'Unfortunately, I could not find a good time slot for you.';
	}
	var recommendedTimeStrings = '';
	//Sort time slots based on duration
	posTimes = posTimes.sort(compareTimes);
	console.log(posTimes.toString());
	//Give maximum two recommendations. TODO: Allow for customization of recommendations/make them longer?
	posTimesMax = posTimes.length < numRecs ? posTimes.length : numRecs;
	for (var i = 0; i < posTimesMax; i++) {
		recommendedTimeStrings += posTimes[i].startTime.format('dddd MMMM Do') + ' from ' + 
		posTimes[i].startTime.format('h:mm A') + ' to '  + posTimes[i].endTime.format('h:mm A') + ' ';
		if (i < posTimesMax - 1)
			recommendedTimeStrings += 'or ';
	}
	return 'Would anytime ' + recommendedTimeStrings + 'work well for you?';
}

/**
Compares time slot durations. Used for sorting time slots.
*/
function compareTimes(time1, time2) {
	time1duration = time1.endTime.diff(time1.startTime);
	time2duration = time2.endTime.diff(time2.startTime);
	if (time1duration > time2duration)
		return -1;
	if (time1duration < time2duration)
		return 1;
	return 0;
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
	//Update People
	updatePeople(auth);
	//Download Calendar History and Update Events
	downloadCalendarHistory(auth, timeMin);
	//Add parameter for lastTimeUpdated
	credFile.lastTimeUpdated = moment().toISOString();
	//Update file withLastTimeUpdated
	fs.writeFileSync(TOKEN_PATH, JSON.stringify(credFile));
	
}

function updatePeople(auth) {
	//Get entire list of contacts
	
	//Store contacts in JSON file.
	
	//Go through Discovery, query names.
	//If names are 'containted' in 
	
}

function downloadCalendarHistory (auth) {
	 
	var calendar = google.calendar('v3');
	//Get first page of results.
	//TODO: Add pagination if 2500 events just isn't enough.
	calendar.events.list({
		auth: auth,
		calendarId: 'primary',
		timeMin: timeMin,
		maxResults:2500,
	}, function (err,response) {
		if (err) {
			console.log(err);
			return;
		}
		
		userName = response.items[0].creator.displayName; //TODO: Get displayName from token just in case creator isn't user (unlikely)
		
		//Write new/updated events to disk
		for (var i = 0; i < response.items.length;i++) 
			fs.writeFileSync(TOKEN_DIR + response.items[i].id + '.json', JSON.stringify(response.items[i]));
		for (var i = 0; i < response.items.length; i++) {
			try {
				if (response.items[i].attendees) {
					for (var j = 0; j < response.items[i].attendees.length; j++) {
						addPerson(response.items[i].attendees[j].displayName, response.items[i].id, response.items[i].attendees[j].email);
					}		
				}
			} catch(error) {
				//Means that attendees was null. We're fine. Relax.
			}
		}
		//Load people array from json
		try {
			people = JSON.parse(fs.readFileSync(TOKEN_DIR + 'people.json'));
		} catch(error) {
			//File doesn't exist yet
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
					var name = data.results[i].enriched_description.entities[j].text;
					addPerson(name, data.results[i].id);
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
					var name = data.results[i].enriched_summary.entities[j].text;
					addPerson(name, data.results[i].id);
				}
			}
		}
		//We are done adding people. Update JSON file.
		fs.writeFile(TOKEN_DIR+'people.json',JSON.stringify(people))
		
		runTestCode(auth);
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
		
	recommendFreeTime(auth, 2, moment(), moment().add(3,'days'), 4);
	recommendPeople('John Gregory', 3)
	setUpTJBot(auth);
	});
}

/**
*Recommends other people you should invite to event, based on one person you want to invite.
* @param person: person who will determine who else to invite by association
* @param numOfPeople: the number of people TJ will recommend
*/
function recommendPeople(personName, numOfPeople) {
		//Find events associated with that person
		var events = [];
		for (var i = 0; i < people.length; i++) {
			if (people[i].name.indexOf(personName) !== -1) {
				events = people[i].events;
				break;
			}
		}	
		//Go through each person, assign frequencies.
		for (var i = 0; i < people.length; i++) {
			people[i].score = 0;
			if (people[i].name !== personName) {
				for (var j = 0; j < people[i].events.length; j++) {
					if (events.indexOf(people[i].events[j]) !== -1) 
						people[i].score++; //You want a high score (It means you're popular)!
				}
			}
		}
		//Now sort people from highest frequency to lowest frequency!
		people = people.sort(compare);
		var attendees = [];
		var responseString = 'I would recommend inviting ';
		for (var i = 0; i < numOfPeople; i++) {
			attendees.push(people[i]);
			if(!people[i].name)
				people[i].name = people[i].email;
			responseString += people[i].name + ' ';
			if (i === numOfPeople - 2) 
				responseString += 'and ';
		}

		responseString += 'to the event.';
		var resObj = {
			msg: responseString,
			attendees: attendees
		};
		return resObj;
}	


function addPerson(name, eventId, email) {
	if (name)
		if (name.trim().indexOf(' ') !== -1);//Full name, let's just get first name
			name = name.substring(0,name.trim().indexOf(' '));
	if (name !== userName.substring(0,userName.indexOf(' '))) {//Don't want to recommend ourselves!
	//TODO:Read from JSON file, not store in RAM
	//TODO: Group names that refer to same people (first name vs. full name) together
	//Traverse through list of people, check if name already exists.
		for (var i = 0; i < people.length; i++) {
			if (people[i].name === name && name) {
				people[i].events.push(eventId);
				if (email && !people[i].email)  //We have an email and the person doesn't have one yet.
					people[i].email = email;
				return;
			}
			if (people[i].email === email && email) {//We have a match! Merely add the eventID
				people[i].events.push(eventId);
				if (name && !people[i].name)  //We have a name and the person doesn't have one yet.
					people[i].name = name;
				return;
			}
		
		}
	//No match. Create new person!
		if (name || email) {
			var person = {
			name: name,
			email: email,
			events: [eventId]
			}
			people.push(person);
		} 
	}
}

/**
*Recommends locations for event based on time of day.
* For now, I will count on Discovery working.
*/
function recommendPastPlaces(attendees, numRecs) {
	// Geocode an address.
	/*googleMapsClient.geocode({
	  address: location
	}, function(err, response) {
  		if (!err) {
    	var coords = response.json.results[0].geometry.location;
  		}
	})*/
	//Generate array of past places attendees have been to. In addition, keep array of place types.
	for (var i = 0; i < attendees.length; i++) {
		for (var j = 0; j < attendees[i].events.length; j++) {
			//Load event
			var event = JSON.parse(fs.readFileSync(TOKEN_DIR + attendees[i].events[j] + '.json'));
			if (event.location) { //location is defined for this event
				addLocation(event.location);
			}
		}
	}
	//Sort from highest score to lowest.
	locations.sort(compare);
	var recLocs = [];
	var responseString = 'These past places have worked well: ';
	var max = numRecs > locations.length ? locations.length: numRecs;
	for (var i = 0; i < numRecs; i++) {
		if (locations[i]) {
			recLocs.push(locations[i])
			responseString += locations[i].name + ' ';
			if (i === numRecs - 2) 
				responseString += 'and ';
		}
	}
	responseString += '. Which one do you want?';
	var recObj = {
		msg: responseString,
		locations : recLocs
	};
	return recObj;
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






			/*if (response.object.intents[0]) {
				var intent = response.object.intents[0].intent;
				console.log(intent);
					if (intent === 'add_event') {
						tj.speak('Adding event!');
						calendar.events.quickAdd({
							auth:authentication,
							calendarId:'primary',
							text:msg
							},function(err, something){
								 if (err) {
								console.log('The API returned an error: ' + err);
								return;
								}
								console.log(something);
						});	
					} else if (intent === 'check_available') {
				
					}
			} else
				tj.speak('I\'m sorry. I do not know what you mean.');	*/
