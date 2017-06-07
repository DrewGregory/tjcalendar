# TJ Calendar
App that enables TJBot to be your personal planner. Uses Google Calendar.
## Features
- Converses with user in a friendly, understandable way
- Provides recommendations about the timing, location, and invitees for an event based on your Google Calendar history.
- If the user chooses, adds the event to the user's Google Calendar

![Image Here](https://github.com/DrewGregory/tjcalendar/blob/master/TJCalendar%20Flowchart.png)
## Hardware Setup
Required Hardware (links in instructables):
- Raspberry Pi 3
- USB Microphone (note: you may want one with a cord. "See Considerations")
- Speaker (preferably Bluetooth)
- NeoPixel LED Light
Please refer to this [instructable](http://www.instructables.com/id/Build-TJ-Bot-Out-of-Cardboard/) to build your own TJBot.
Next, you will need to configure your Raspberry Pi's audio. Please visit this [instructable](http://www.instructables.com/id/Build-a-Talking-Robot-With-Watson-and-Raspberry-Pi/) (Steps 1, 2, and 3) for configuring your Raspberry Pi's audio.  
## Installation
*All of these services have at least a free plan. Some APIs have usage limits that can be expanded via a paid plan.*
This app uses:
- [Watson Conversation](https://www.ibm.com/watson/developercloud/conversation.html)
- [Watson Text to Speech](https://www.ibm.com/watson/developercloud/text-to-speech.html)
- [Watson Speech to Text](https://www.ibm.com/watson/developercloud/speech-to-text.html)
- [Watson Natural Language Understanding](https://www.ibm.com/watson/developercloud/natural-language-understanding.html)
- [Google Calendar](https://developers.google.com/google-apps/calendar/)
- [Google People](https://developers.google.com/people/)
- [Google Maps](https://developers.google.com/maps/)

Make sure all the Raspberry Pi and Node software is up to date (can take about 30 min):
```
sudo apt-get update

sudo apt-get dist-upgrade

curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -

sudo apt-get install -y nodejs

sudo apt-get install alsa-base alsa-utils libasound2-dev
```

Begin by cloning this repository: ~ git clone https://github.com/DrewGregory/tjcalendar.git ~

Next, enter the directory: `cd tjcalendar`

Install necessary modules: `npm install`

Create a config file: `cp config.default.js config.js`

Edit the file and input your credentials: `sudo nano config.js` or open with text editor.
### Note about inputting your credentials (Recommendation: Not Necessary).
For security and ease, I often access my credentials on a separate computer and then transfer the credentials to the Raspberry Pi. **Manually typing the credentials into the config file is enormously error prone.** I would recommend takign remote control of your Pi from your comptuer via SSH and/or VNC.
- SSH requires you to be on the same network as your Pi. It also requires a minimal ability to traverse IP addresses. To learn more, visit https://www.raspberrypi.org/documentation/remote-access/ssh/
- VNC often works in conjunction with SSH, but VNC Viewer allows you to remotely control your Pi without IP addresses and via a separate network. To install VNC Viewer, visit: https://www.realvnc.com/download/viewer/windows/ and https://www.realvnc.com/download/vnc/raspberrypi/. For more information, visit [here](https://www.realvnc.com/products/vnc/).
### Acessing IBM Bluemix Credentials
Please refer to the [instructable](http://www.instructables.com/id/Build-a-Talking-Robot-With-Watson-and-Raspberry-Pi/) above (Step 5). *Note: You will have to add the Natural Language Understanding credentials as well.*
### Accessing Google Calendar and People credentials.
Since this recipe accesses your Google Calendar and Contacts, you will need to pass OAuth2 tokens. These tokens verify your right to access user information. To begin this process, visit this [quickstart] (https://developers.google.com/google-apps/calendar/quickstart/nodejs) (Step 1). You should have a client_secret.json file at the end of this step in your recipe directory (tjcalendar).
### Accessing Google Maps Credentials:
Visit this [page](https://developers.google.com/maps/documentation/javascript/get-api-key) to add the API Key to your project. **Note: This API key should be registered in the same project that has your OAuth2 client id.**
## Run!
To run the application, run `sudo node tjcal` from a terminal in the directory (`cd tjcalendar`).
The first time you run this application, you will have to sign into your Google account with the given link in the terminal. SSH/VNC can be particularly helpful in this scenario as well. Once you finish signing in, copy the resulting token in the browser and paste it into the terminal. Then press Enter. If the token is entered correctly, you will no longer have to enter your token on successive executions of the recipe. It will be saved locally on the Pi.
## Considerations
If you have any questions, please contact me at djgregny@gmail.com or submit an issue to this repository.
To revise/improve this recipe, feel free to fork it, make your revisions, and submit a pull request to this repository.
Improvement Ideas:
- Make chatbot even more dynamic to changes in recommendations (Watson Conversation)
- Improve efficacy of updating data
- Improve recommendations for new locations. (Consider using place.details in Google Maps)
- Use different Calendar API
