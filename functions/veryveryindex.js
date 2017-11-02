
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var Swagger = require('swagger-client');
var open = require('open');
var rp = require('request-promise');
var replytoId;

//var directLineSecret = 'ioB5_QxSUV4.cwA.0Mw.05cCZPbi9EuJ6a91-103WwluccCgL12xWqb_927-OwE';

//var directLineClientName = 'DirectLineClient';
var directLineSpecUrl = 'https://docs.botframework.com/en-us/restapi/directline3/swagger.json';



exports.junebot_communication = functions.database
.ref('firebase_v4_diagnostic/threads/{thredId}/messages/{pushID}')
.onCreate(event => {

  const post = event.data.val();
  const pushID = event.params.pushID;
  const thredId = event.params.thredId;
  const payload = post.payload;
  const directLineSecret = post.directLineSecret;
  const conversationIdforthread = post.conversationId;
  const lifetimeRefreshToken = 30 * 60 * 1000;
  const intervalRefreshToken = lifetimeRefreshToken / 2;

  console.log("directLineSecret : "+ directLineSecret);

  // robot이면 나간다.
  if (post.isbot==1) {
    //  console.log("it is robot! out!");
    return
  }
  var botId;
  //어떤 Bot인지 읽는다. Bot의 Node ID를 읽는다.
  //thread의 bot이 누구인지 저장한다.
  const usersAtTread = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/users');
  usersAtTread.once('value').then(snap =>{
    snap.forEach(childSnap=>{
      var key = childSnap.key;
      if(key!==post["user-firebase-id"]){
        botId = key;
        console.log("botId : "+ botId);
      }
    }
  )
});


//미리 봇이 쓸 자리를 만들어 놓는다.
var newPostKey = event.data.ref.parent.push().key;
var pollInterval = 1000;
var directLineClient = rp(directLineSpecUrl)
.then(function (spec) {
  // client
  return new Swagger({
    spec: JSON.parse(spec.trim()),
    usePromise: true
  });
})
.then(function (client) {
  // add authorization header to client
  client.clientAuthorizations.add('AuthorizationBotConnector', new Swagger.ApiKeyAuthorization('Authorization', 'Bearer ' + directLineSecret, 'header'));
  return client;
})
.catch(function (err) {
  console.error('Error initializing DirectLine client', err);
});

if (conversationIdforthread == null){
  // once the client is ready, create a new conversation
  var directsend = directLineClient.then(function (client) {
    client.Conversations.Conversations_StartConversation()                          // create conversation
    .then(function (response) {
      return response.obj.conversationId;
    })                            // obtain id
    .then(function (conversationId) {
      //  console.log("conversationId : ", conversationId);
      admin.database().ref('firebase_v4_diagnostic/threads/'+ thredId +'/details/').update({ conversationId: conversationId });

      sendMessages(client, conversationId,payload,pushID,thredId);             // start watching console input for sending new messages to bot
    //  pollMessages(client, conversationId);

      // start polling messages from bot
    });
  });
} else {
  console.log("conversationIdforthread :" + conversationIdforthread);
  var directsend = directLineClient.then(function(client){
    sendMessages(client, conversationIdforthread,payload,pushID,thredId);
    //console.log("replyToId ar if : " + replyToId );          // start watching console input for sending new messages to bot
  //  pollMessages(client, conversationIdforthread);
  });

}


// send message
function sendMessages(client, conversationId,payload,pushID,thredId) {

  client.Conversations.Conversations_PostActivity(
    {
      conversationId: conversationId,
      activity: {
        textFormat: 'plain',
        text: payload,
        type: 'message',
        from: {
          id: thredId, //thredId
          name: pushID //pushId
        }
      }
    }).then(function(response){
      console.log("replytoId at sendMessages : " + response.obj.id);
        return pollMessages(client, conversationIdforthread,response.obj.id);
    }

    )
    .catch(function (err) {
      console.error('Error sending message:', err);
    });

  }



  // Poll Messages from conversation using DirectLine client
  function pollMessages(client, conversationId, replytoId) {
    console.log('Starting polling message for conversationId: ' + conversationId);
    var watermark = null;
    var count =0;
    var senderId = null;
    var repeat = setInterval( function(replytoId){
      count++;

      if(count==2){
        clearInterval(repeat);
      };
      //  console.log("count : ", count);
      client.Conversations.Conversations_GetActivities({ conversationId: conversationId, watermark: watermark })
      .then(function (response) {
        watermark = response.obj.watermark;          // use watermark so subsequent requests skip old messages

        return response.obj.activities;
      })
      .then(printMessages,replytoId);
    }
    , 250)

  }

  function printMessages(activities,replytoId) {
    console.log("replytoId at printMessages : " + replytoId);
    if (activities && activities.length) {
      // ignore own messages
      activities = activities.filter(function (m) { return m.from.id !== thredId }); //특정 thredId에서 내가 보낸건 거른다.
      activities = activities.filter(function (m) { return m.from.id == replytoId });
      if (activities.length) {
        activities.forEach(printMessage);
        count = 5;
      }
    }
  }

  function printMessage(activity) {
    console.log("activity : " , activity);
    var datum = Date.parse(activity.localTimestamp);

    //var newPostKey = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId).push().key;

    console.log("newkey : " + newPostKey);

    if (activity.text) {
      var botMessage ={
        payload : activity.text,
        isbot : 1,
        type : 0,
        date : datum,
        ["user-firebase-id"]  : botId,
        directLineSecret: directLineSecret
      };
      var lastupadate ={
        ["last-message-added"]  : datum
      }
      var updates = {};
      // updates['firebase_v4_diagnostic/threads/'+ thredId +'/details'] = lastupadate;
      // //시간만 update
      // admin.database().ref().update(updates);
      //시간만 update
      admin.database().ref('firebase_v4_diagnostic/threads/'+ thredId +'/details/').update({["last-message-added"]  : datum });
      // console.log("botmessage: "+ botMessage);
      console.log("thredId: "+ thredId);
      return admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/messages/'+newPostKey).set(botMessage);
    }

    if (activity.attachments) {
      activity.attachments.forEach(function (attachment) {
        switch (attachment.contentType) {
          case "application/vnd.microsoft.card.hero":
          renderHeroCard(attachment);
          break;

          case "image/png":
          console.log('Opening the requested image ' + attachment.contentUrl);
          open(attachment.contentUrl);
          break;
        }
      });
    }
  }


  return

});
