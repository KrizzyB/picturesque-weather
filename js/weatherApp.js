/**
 * Created by B00137205
 */
var apiKey = "5a031cd3-07f2-4217-8520-58a0f1543e22";    //required for Met Office Datapoint

var gpsIcon = '<img src="img/gps.gif" height="32" width="32"/>';    //HTML to set when searching for GPS location
var searchIcon = '<img src="img/search.gif" height="32" width="32"/>';  //HTML to set when searching for a location

var locations;

// check if first boot
function firstBoot() {
    $("#overlay").css("display", "inherit");      //cover the screen while we work
    if (localStorage.tempFormat == null) {   //locationIndex does not exist in local storage
        console.log("First boot detected, setting up defaults.");
        localStorage.tempFormat = "c";          //set default temperature format to c
        localStorage.windFormat = "m";          //set default wind format to mph
        localStorage.statusMsg = "";            //prevent "undefined" being displayed as status
    } else {
        console.log("Not my first boot. Continuing...");
    }
}

// set up click events and buttons
function initialise() {
    $("#menu-button").click(function() {
        $("#menu").panel("open");
    });
    $("#menu").on("panelbeforeopen", function() {
        $('#flip-1').val(localStorage.tempFormat).slider("refresh"); //set temp format slider to current position
        $('#flip-2').val(localStorage.windFormat).slider("refresh"); //set wind format slider to current position
    });
    $( "#flip-1" ).bind( "change", function(event) {
        localStorage.tempFormat = event.currentTarget.value;
        updateDisplay();
    });
    $( "#flip-2" ).bind( "change", function(event) {
        localStorage.windFormat = event.currentTarget.value;
        updateDisplay();
    });

    $("#today").click(function() {
        window.location.href = "#3hourly";
        get3HourlyForecast(0, day[0].weatherType);
        return false;
    });
    $("#tomorrow").click(function() {
        window.location.href = "#3hourly";
        get3HourlyForecast(1, day[1].weatherType);
        return false;
    });
    $("#nextday").click(function() {
        window.location.href = "#3hourly";
        get3HourlyForecast(2, day[2].weatherType);
        return false;
    });
    $("#day4").click(function() {
        window.location.href = "#3hourly";
        get3HourlyForecast(3, day[3].weatherType);
        return false;
    });
    $("#day5").click(function() {
        window.location.href = "#3hourly";
        get3HourlyForecast(4, day[4].weatherType);
        return false;
    });

    $("#search-button").click(function() {
        window.location = "#search";
    });
    $("#location-button").click(function() {
        detectCoordinates();
    });
    $("#refresh-button").click(function() {
        findLocation(localStorage.lat, localStorage.long);
    });
}

// setup list view on search page
function initialiseLocationList() {
    for (var i=0; i<locations.length; i++) {
        $("#location-list").append('<li onclick="findLocation(' + "'" + locations[i].latitude + "', '" + locations[i].longitude + "'" + ')">' + locations[i].name + '</li>');
    }
    $("#location-list").trigger('listview');
    $("#location-list").hide();

    $("#locations-search").on( "keypress", function() {
        if ($(this).val().length >= 2) {
            $("#location-list").show();
        }
    });

    $("#location-list li").on( "click", function() {
        window.location.href = "#main";
        $("#locations-search").val("");
        $("#location-list").hide();
    });
}

// fetch locations from Met Office
function getLocations() {
    $("#loading").attr("src", "img/loading.gif");
    $.ajax({
        type: 'GET',
        crossDomain: true,
        url: "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/sitelist?res=daily&key="+ apiKey,
        success: function (feed) {
            console.log("Connected to Met Office. Downloading Locations.");
            locations = parseJSON(feed);
            console.log("Locations loaded into memory.");
            initialiseLocationList();
            detectCoordinates();
        },
        error: function() {
            console.log("Cannot load locations!");
            if (localStorage.timeCycle == null) {
                console.log("No previous forecasts available. App cannot start!");
                $( "#internet-error" ).popup( "open", {transition: 'fade'} );
                $("#loading").attr("src", "img/boot-error.png");    //display warning symbol if locations cannot be loaded
            } else {
                updateDisplay();
                console.log("Showing last displayed weather data.");
            }
        }
    });
}

//detects the current device location
function detectCoordinates() {
    console.log("Checking GPS coordinates...");
    $("#status-display").html(gpsIcon);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            showPosition(position);
        }, function(error) {
            console.log("GPS turned off.");
            $("#status-display").html(localStorage.statusMsg);
            $( "#gps-error" ).popup( "open", {transition: 'fade'} );
        },{timeout:5000});

    } else {
        console.log("Device not GPS enabled.");
        $("#status-display").html(localStorage.statusMsg);
        $( "#gps-error" ).popup( "open", {transition: 'fade'} );
    }

    function showPosition(position) {
        var currentLatitude = position.coords.latitude;
        var currentLongitude = position.coords.longitude;
        console.log("Current GPS coordinates found:");
        console.log(currentLatitude);
        console.log(currentLongitude);
        localStorage.lat = currentLatitude;
        localStorage.long = currentLongitude;
        findLocation(currentLatitude, currentLongitude);
    }
}

//converts gps coordinates to real place names
function findLocation(latitude, longitude) {
    var closest, standpoint;

    // where you are
    standpoint = new Location(null, "Your location", latitude, longitude);

    // just interested in the closest location in the list
    closest = getNearest(standpoint, locations);

    console.log("Location detected as: " + closest.location.name);

    localStorage.locationName = closest.location.name;

    getWeather(latitude, longitude, closest.location.id);
}

//get weather for found locationID
function getWeather(latitude, longitude, locationID) {
    $("#status-display").html(searchIcon);
    //Get daily weather forecast
    $.ajax({
        type: 'GET',
        url: "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/" + locationID + "?res=daily&key=" + apiKey + "&callback=?",
        timeout: 5000,
        success: function (weather) {
            localStorage["5dayForecast"] = JSON.stringify(weather.SiteRep.DV.Location.Period);
            console.log("Daily forecast received.");
            setTimeout(function() {
                getSunTimes(latitude, longitude);
            }, 1000);
        },
        error: function () {
            $( "#internet-error" ).popup( "open", {transition: 'fade'} );
            $("#status-display").html(localStorage.statusMsg);
            console.log("Cannot load daily weather feed!");
        }
    });

    //Get 3 hourly forecast
    $.ajax({
        type: 'GET',
        url: "http://datapoint.metoffice.gov.uk/public/data/val/wxfcs/all/json/" + locationID + "?res=3hourly&key=" + apiKey + "&callback=?",
        success: function (weather3hourly) {
            localStorage["3hourlyForecast"] = JSON.stringify(weather3hourly.SiteRep.DV.Location.Period);
            console.log("3 hourly forecast received.");
        },
        error: function () {
            $( "#internet-error" ).popup( "open", {transition: 'fade'} );
            $("#status-display").html(localStorage.statusMsg);
            console.log("Cannot load 3 hourly weather feed!");
        }
    });
}

//get sunrise and sunset time for location coordinates
function getSunTimes(latitude, longitude) {
    $.jsonp({
        type: 'GET',
        url: "http://api.sunrise-sunset.org/json?lat=" + latitude + "&lng=" + longitude + "&callback=?",
        callback: 'sunTimes',
        contentType: "application/jsonp",
        dataType: 'jsonp',
        success: function (sunTimes) {
            localStorage.sunTimes = JSON.stringify(sunTimes);
            localStorage.statusMsg = "Updated: " + getDateTime();
            console.log("Sun rise/set times received.");
            updateDisplay();
        },
        error: function () {
            $( "#internet-error" ).popup( "open", {transition: 'fade'} );
            $("#status-display").html(localStorage.statusMsg);
            console.log("Cannot load daily weather feed!");
        }
    });
}

//update the display
function updateDisplay() {
    var date = new Date();
    var today = date.getDay();
    var timeLoad = JSON.parse(localStorage.sunTimes);
    $("#sunrise").text(formatTime(timeLoad.results.sunrise, date).time);
    $("#sunset").text(formatTime(timeLoad.results.sunset, date).time);

    // if current time is between sunrise & sunset then show daytime information
    if (((formatTime(timeLoad.results.sunset, date).hours + 1) > date.getHours()) && (formatTime(timeLoad.results.sunrise, date).hours < date.getHours())) {
        localStorage.timeCycle = "Day";
    } else { //if current time is not between sunrise & sunset then display night time information
        localStorage.timeCycle = "Night";
    }

    var weatherLoad = JSON.parse(localStorage["5dayForecast"]); // Parse string data to an array.
    day = [];
    if (localStorage.timeCycle == "Day") { //get daytime weather info
        $("#max-temp").css("display", "inherit"); //show daytime temperature
        for (var i = 0; i < 5; i++) {
            var x = new WeatherForecast(weatherLoad[i].Rep[0].Dm, weatherLoad[i].Rep[1].Nm, weatherLoad[i].Rep[0].W, weatherLoad[i].Rep[0].D, weatherLoad[i].Rep[0].S);
            day.push(x);
        }
    } else { // get night time weather info
        $("#max-temp").css("display", "none"); //hide daytime temperature
        var x = new WeatherForecast(weatherLoad[0].Rep[0].Dm, weatherLoad[0].Rep[1].Nm, weatherLoad[0].Rep[1].W, weatherLoad[0].Rep[1].D, weatherLoad[0].Rep[1].S);
        day.push(x);
        for (var i = 1; i < 5; i++) {
            var x = new WeatherForecast(weatherLoad[i].Rep[0].Dm, weatherLoad[i].Rep[1].Nm, weatherLoad[i].Rep[0].W, weatherLoad[i].Rep[0].D, weatherLoad[i].Rep[0].S);
            day.push(x);
        }
    }

    $("#max-temp").text(formatTemp(day[0].dayTemp));
    $("#min-temp").text(formatTemp(day[0].nightTemp));
    $("#today-weather").text(getWeatherType(day[0].weatherType).weatherType);
    $("#temperatures").css("background-image", "url(" + getWeatherType(day[0].weatherType).weatherIcon + ")");
    $("#wind-direction").attr("src", getWindDirection(day[0].windDirection));
    $("#wind-speed").text(formatWind(day[0].windSpeed));
    $("#town").text(localStorage.locationName);
    $("#main").css("background-image", "url(" + getWeatherType(day[0].weatherType).weatherBg + ")");

    $("#tomorrow-max-temp").text(formatTemp(day[1].dayTemp));
    $("#tomorrow-min-temp").text(formatTemp(day[1].nightTemp));
    $("#tomorrow-weather").text(getWeatherType(day[1].weatherType).weatherType);
    $("#tomorrow-icon").attr("src", getWeatherType(day[1].weatherType).weatherIcon);
    $("#tomorrow-name").text(getDayName((today+1)).day);
    $("#tomorrow-mininame").text(getDayName((today+1)).miniday);

    $("#nextday-max-temp").text(formatTemp(day[2].dayTemp));
    $("#nextday-min-temp").text(formatTemp(day[2].nightTemp));
    $("#nextday-weather").text(getWeatherType(day[2].weatherType).weatherType);
    $("#nextday-icon").attr("src", getWeatherType(day[2].weatherType).weatherIcon);
    $("#nextday-name").text(getDayName((today+2)).day);
    $("#nextday-mininame").text(getDayName((today+2)).miniday);

    $("#day4-max-temp").text(formatTemp(day[3].dayTemp));
    $("#day4-min-temp").text(formatTemp(day[3].nightTemp));
    $("#day4-weather").text(getWeatherType(day[3].weatherType).weatherType);
    $("#day4-icon").attr("src", getWeatherType(day[3].weatherType).weatherIcon);
    $("#day4-name").text(getDayName((today+3)).day);
    $("#day4-mininame").text(getDayName((today+3)).miniday);

    $("#day5-max-temp").text(formatTemp(day[4].dayTemp));
    $("#day5-min-temp").text(formatTemp(day[4].nightTemp));
    $("#day5-weather").text(getWeatherType(day[4].weatherType).weatherType);
    $("#day5-icon").attr("src", getWeatherType(day[4].weatherType).weatherIcon);
    $("#day5-name").text(getDayName((today+4)).day);
    $("#day5-mininame").text(getDayName((today+4)).miniday);

    $("#status-display").html(localStorage.statusMsg);
    $("#overlay").css("display", "none");
    $("#main-header").css("display", "inherit");
    $("#today").css("display", "inherit");
    $("#next-days").css("display", "inherit");
    console.log("Display Updated.");
}

var day = []; //array of WeatherForecasts for each day

function WeatherForecast(dayTemp, nightTemp, weatherType, windDirection, windSpeed) {
    this.dayTemp = dayTemp;
    this.nightTemp = nightTemp;
    this.weatherType = weatherType;
    this.windDirection = windDirection;
    this.windSpeed = windSpeed;
}

//dynamically creates 3hourly page content
function get3HourlyForecast(dayCode, weatherType) {
    day3Hourly = [];
    var weatherLoad = JSON.parse(localStorage["3hourlyForecast"]); // Parse string data to an array.
    for (var i=0; i<weatherLoad[dayCode].Rep.length ; i++) {
        var x = new WeatherForecast3Hourly(weatherLoad[dayCode].Rep[i].W, weatherLoad[dayCode].Rep[i].T, weatherLoad[dayCode].Rep[i].D, weatherLoad[dayCode].Rep[i].S, weatherLoad[dayCode].Rep[i].$ );
        day3Hourly.push(x);
    }
    $("#3hourly-content").html("");
    var today = new Date().getDay();
    $("#day-name").html(getDayName((today + dayCode)).day);
    $("#3hourly").css("background-image", "url(" + getWeatherType(weatherType).weatherBg + ")");
    for (var j=0; j<day3Hourly.length ; j++) {
        $("#3hourly-content").append('<div class ="three-hourly-forecast-div"> <table><tr><td class="tbl-time">' + getTime(day3Hourly[j].time) + '</td><td class ="tbl-weather-icon">' + '<img src="' + getWeatherType(day3Hourly[j].weatherType).weatherIcon + '" height="30" width=30"> </td><td class = "tbl-weather-type"> ' + getWeatherType(day3Hourly[j].weatherType).weatherType + '</td><td class="tbl-temp">' + formatTemp(day3Hourly[j].temp)+ '</td><td class="tbl-wind-direction"> <img src="' + getWindDirection(day3Hourly[j].windDirection) + '" height="30" width="30" class="tbl-wind-direction-img"> </td><td class="tbl-wind-speed">' + formatWind(day3Hourly[j].windSpeed) + '</td></tr></table> </div>');
    }
}

var day3Hourly = []; // array of 3 hourly WeatherForecats

function WeatherForecast3Hourly(weatherType, temp, windDirection, windSpeed, time) {
    this.weatherType = weatherType;
    this.temp = temp;
    this.windDirection = windDirection;
    this.windSpeed = windSpeed;
    this.time = time;
}

//converts feed data to correct weathertype, weather icon and background
function getWeatherType(weatherCode) {
    var weatherType;
    var weatherIcon;
    var weatherBg;
    switch (weatherCode) {
        case "NA":
            weatherType = "Not Available";
            weatherIcon = "img/weather-icons/none.png";
            weatherBg = "img/backgrounds/default.jpg";
            break;
        case "0":
            weatherType = "Clear Night";
            weatherIcon = "img/weather-icons/clear_night.png";
            weatherBg = "img/backgrounds/clear_night.jpg";
            break;
        case "1":
            weatherType = "Sunny Day";
            weatherIcon = "img/weather-icons/sunny.png";
            weatherBg = "img/backgrounds/sunny.jpg";
            break;
        case "2":
            weatherType = "Partly Cloudy";
            weatherIcon = "img/weather-icons/cloudy_night.png";
            weatherBg = "img/backgrounds/cloudy_night.jpg";
            break;
        case "3":
            weatherType = "Partly Cloudy";
            weatherIcon = "img/weather-icons/partly_cloudy.png";
            weatherBg = "img/backgrounds/cloudy_day.jpg";
            break;
        case "5":
            weatherType = "Mist";
            weatherIcon = "img/weather-icons/foggy.png";
            weatherBg = "img/backgrounds/mist.jpg";
            break;
        case "6":
            weatherType = "Fog";
            weatherIcon = "img/weather-icons/foggy.png";
            weatherBg = "img/backgrounds/fog.jpg";
            break;
        case "7":
            weatherType = "Cloudy";
            weatherIcon = "img/weather-icons/overcast.png";
            weatherBg = "img/backgrounds/overcast.jpg";
            break;
        case "8":
            weatherType = "Overcast";
            weatherIcon = "img/weather-icons/overcast.png";
            weatherBg = "img/backgrounds/overcast.jpg";
            break;
        case "9":
            weatherType = "Light Rain Shower";
            weatherIcon = "img/weather-icons/night_rain.png";
            weatherBg = "img/backgrounds/rain_night.jpg";
            break;
        case "10":
            weatherType = "Light Rain Shower";
            weatherIcon = "img/weather-icons/rain.png";
            weatherBg = "img/backgrounds/rain.jpg";
            break;
        case "11":
            weatherType = "Drizzle";
            weatherIcon = "img/weather-icons/rain.png";
            weatherBg = "img/backgrounds/drizzle.jpg";
            break;
        case "12":
            weatherType = "Light Rain";
            weatherIcon = "img/weather-icons/rain.png";
            weatherBg = "img/backgrounds/rain.jpg";
            break;
        case "13":
            weatherType = "Heavy Rain Shower";
            weatherIcon = "img/weather-icons/heavy_rain.png";
            weatherBg = "img/backgrounds/heavy_rain.jpg";
            break;
        case "14":
            weatherType = "Heavy Rain Shower";
            weatherIcon = "img/weather-icons/heavy_rain.png";
            weatherBg = "img/backgrounds/heavy_rain.jpg";
            break;
        case "15":
            weatherType = "Heavy Rain";
            weatherIcon = "img/weather-icons/heavy_rain.png";
            weatherBg = "img/backgrounds/heavy_rain.jpg";
            break;
        case "16":
            weatherType = "Sleet Shower";
            weatherIcon = "img/weather-icons/rain_snow.png";
            weatherBg = "img/backgrounds/sleet.jpg";
            break;
        case "17":
            weatherType = "Sleet Shower";
            weatherIcon = "img/weather-icons/rain_snow.png";
            weatherBg = "img/backgrounds/sleet.jpg";
            break;
        case "18":
            weatherType = "Sleet";
            weatherIcon = "img/weather-icons/rain_snow.png";
            weatherBg = "img/backgrounds/sleet.jpg";
            break;
        case "19":
            weatherType = "Hail Shower";
            weatherIcon = "img/weather-icons/ice.png";
            weatherBg = "img/backgrounds/hail.jpg";
            break;
        case "20":
            weatherType = "Hail Shower";
            weatherIcon = "img/weather-icons/ice.png";
            weatherBg = "img/backgrounds/hail.jpg";
            break;
        case "21":
            weatherType = "Hail";
            weatherIcon = "img/weather-icons/ice.png";
            weatherBg = "img/backgrounds/hail.jpg";
            break;
        case "22":
            weatherType = "Light Snow Shower";
            weatherIcon = "img/weather-icons/snow_night.png";
            weatherBg = "img/backgrounds/light_snow_day.jpg";
            break;
        case "23":
            weatherType = "Light Snow Shower";
            weatherIcon = "img/weather-icons/snow_sun.png";
            weatherBg = "img/backgrounds/snow_night.jpg";
            break;
        case "24":
            weatherType = "Light Snow";
            weatherIcon = "img/weather-icons/snow.png";
            weatherBg = "img/backgrounds/light_snow_day.jpg";
            break;
        case "25":
            weatherType = "Heavy Snow Shower";
            weatherIcon = "img/weather-icons/heavysnow.png";
            weatherBg = "img/backgrounds/heavy_snow_night.jpg";
            break;
        case "26":
            weatherType = "Heavy Snow Shower";
            weatherIcon = "img/weather-icons/heavysnow.png";
            weatherBg = "img/backgrounds/heavy_snow_day.jpg";
            break;
        case "27":
            weatherType = "Heavy Snow";
            weatherIcon = "img/weather-icons/heavysnow.png";
            weatherBg = "img/backgrounds/snow_day.jpg";
            break;
        case "28":
            weatherType = "Thunder Shower";
            weatherIcon = "img/weather-icons/rain_thunder.png";
            weatherBg = "img/backgrounds/thunder_night.jpg";
            break;
        case "29":
            weatherType = "Thunder Shower";
            weatherIcon = "img/weather-icons/rain_thunder_sun.png";
            weatherBg = "img/backgrounds/thunder_day.jpg";
            break;
        case "30":
            weatherType = "Thunder";
            weatherIcon = "img/weather-icons/rain_thunder.png";
            weatherBg = "img/backgrounds/thunder_night.jpg";
            break;
    }
    return {
        weatherType: weatherType,
        weatherIcon: weatherIcon,
        weatherBg: weatherBg
    };
}

//converts wind direction into icon
function getWindDirection(windCode) {
    var windDirection;
    switch (windCode) {
        case "N":
            windDirection = "img/wind-icons/wind-n.png";
            break;
        case "E":
            windDirection = "img/wind-icons/wind-e.png";
            break;
        case "S":
            windDirection = "img/wind-icons/wind-s.png";
            break;
        case "W":
            windDirection = "img/wind-icons/wind-w.png";
            break;
        case "NNE":
        case "NE":
        case "ENE":
            windDirection = "img/wind-icons/wind-ne.png";
            break;
        case "ESE":
        case "SE":
        case "SSE":
            windDirection = "img/wind-icons/wind-se.png";
            break;
        case "SSW":
        case "SW":
        case "WSW":
            windDirection = "img/wind-icons/wind-sw.png";
            break;
        case "WNW":
        case "NW":
        case "NNW":
            windDirection = "img/wind-icons/wind-nw.png";
            break;
    }
    return windDirection;
}

//converts day number into correct name
function getDayName(day) {
    var week = [{day:"Sunday", miniday: "Sun"}, {day:"Monday", miniday: "Mon"}, {day:"Tuesday", miniday: "Tue"}, {day:"Wednesday", miniday: "Wed"}, {day:"Thursday", miniday: "Thu"}, {day:"Friday", miniday: "Fri"}, {day:"Saturday", miniday: "Sat"}];
    if (day > 6) {
        day = day-7;
    }
    return week[day];
}

//converts 3hourly feed times into correct format
function getTime(timeCode) {
    var time;
    switch (timeCode) {
        case "0":
            time = "00:00";
            break;
        case "180":
            time = "03:00";
            break;
        case "360":
            time = "06:00";
            break;
        case "540":
            time = "09:00";
            break;
        case "720":
            time = "12:00";
            break;
        case "900":
            time = "15:00";
            break;
        case "1080":
            time = "18:00";
            break;
        case "1260":
            time = "21:00";
            break;
    }
    return time;
}

//formats 12 hour time to 24 hour time
function formatTime(time, today) {
    var hours = Number(time.match(/^(\d+)/)[1]);
    var minutes = Number(time.match(/:(\d+)/)[1]);
    var AMPM = time.match(/\s(.*)$/)[1];
    if(AMPM == "PM" && hours<12) hours = hours+12;
    if(AMPM == "AM" && hours==12) hours = hours-12;
    var sHours = hours.toString();
    var sMinutes = minutes.toString();
    if(hours<10) sHours = "0" + sHours;
    if(minutes<10) sMinutes = "0" + sMinutes;
    //adjust for local time.
    sHours = sHours - (today.getTimezoneOffset()/60);
    return {
        time: (sHours + ":" + sMinutes),
        hours: sHours,
        mins: Number(sMinutes)
    };
}

//formats temperature to Celsius or Fahrenheit
function formatTemp(temp) {
    if (localStorage.tempFormat == "c") {
        return temp + String.fromCharCode(176) + "C";
    } else {
        var tempF = temp * 9/5 + 32;
        return Math.round(tempF) + String.fromCharCode(176) + "F";
    }
}

//formats wind into MPH or KPH
function formatWind(wind) {
    if (localStorage.windFormat == "m") {
        return wind + " mph";
    } else {
        var windK = wind * 1.609344;
        return Math.round(windK) + " kph";
    }
}

//gets current time for the status message
function getDateTime() {
    var date = new Date();
    var hours = date.getHours();
    var minutes = date. getMinutes();
    if (hours < 10) {
        hours = "0" + hours;
    }
    if (minutes < 10) {
        minutes = "0" + minutes;
    }
    return hours + ":" + minutes;
}

//run on start
$(document).ready(function() {
    firstBoot();
    initialise();
    getLocations();
});