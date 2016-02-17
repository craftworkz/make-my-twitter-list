var Twitter = require('twitter');
var express = require('express');
var mongoose = require('mongoose');
var app = express();

var port = process.env.VCAP_APP_PORT || process.env.PORT || 8080;
var consumer_key = process.env.TWITTER_CONSUMER_KEY;
var consumer_secret = process.env.TWITTER_CONSUMER_SECRET;
var access_token_key = process.env.TWITTER_ACCESS_TOKEN_KEY;
var access_token_secret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
var twitter_list_id = process.env.TWITTER_LIST_ID;
var mongo_url = process.env.MONGO_URL;
var interval = process.env.INTERVAL;
 
var client = new Twitter({
  consumer_key: consumer_key,
  consumer_secret: consumer_secret,
  access_token_key: access_token_key,
  access_token_secret: access_token_secret
});

mongoose.connect(mongo_url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("Connected to mongodb");
});

var Member = mongoose.model('Member', mongoose.Schema({
    id: Number,
    screen_name: String,
    processed: Boolean
}));

var alreaydMembers = [];
client.get('lists/members', {list_id : twitter_list_id}, function(error, tweets, response) {
   for (var i = 0; i <  tweets.users.length; i++) {
       alreaydMembers.push(tweets.users[i].id);
   }
   
   console.log("Members in twitter list : " + alreaydMembers.length);
});

client.stream('statuses/filter', {track: 'IBMInterConnect'}, function(stream) {
  stream.on('data', function(tweet) {
    if(alreaydMembers.indexOf(tweet.user.id) < 0) {
        var member = new Member({id:tweet.user.id, screen_name:tweet.user.screen_name, processed: false});
     
        member.save(function (err, member) {
         	if (err) return console.error(err);
            alreaydMembers.push(tweet.user.id);
            console.log("User added: " + member.screen_name);
        });
    }
  });
 
  stream.on('error', function(error) {
    throw error;
  });
});

var seconds = interval,
    the_interval = seconds * 1000;

setInterval(function () {
    process.nextTick(function () {
        var memberMap = [];
        var q = Member.find({processed: false}).limit(99);
        
        q.exec(function(err, members) {
           members.forEach(function(member) {
             memberMap.push(member.screen_name);
             member.processed = true;
             member.save(function (err, member) {
                if (err) return console.error(err);
             }); 
           });
           
           if (memberMap.length > 0) {
                client.post('lists/members/create_all', {list_id: twitter_list_id, screen_name: memberMap.toString()}, function(error, tweet, response){
                    if (err) return console.error(err);
                        console.log("Members added to twitter list : " + memberMap);
                });
           } else {
               console.log("No new members found to process");
           }
        });
    });
}, the_interval);

var server = app.listen(port);