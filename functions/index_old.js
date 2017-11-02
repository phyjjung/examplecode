const functions = require('firebase-functions');
var Swagger = require('swagger-client');
var open = require('open');
var rp = require('request-promise');

// config items
var pollInterval = 1000;
var printNumber = 0; //1번만 print한다.
var pollMax = 0; //5초간만 받는다.
var directLineSecret = 'ioB5_QxSUV4.cwA.0Mw.05cCZPbi9EuJ6a91-103WwluccCgL12xWqb_927-OwE';
var directLineClientName = 'DirectLineClient';
var directLineSpecUrl = 'https://docs.botframework.com/en-us/restapi/directline3/swagger.json';
var conversationId_firebase ="";




// once the client is ready, create a new conversation

//directLineClient.then(function (client) {
//    client.Conversations.Conversations_StartConversation()                          // create conversation
//        .then(function (response) {

//            conversationId_firebase = response.obj.conversationId;
//            console.log("conversationId : "+ conversationId_firebase);
//            return response.obj.conversationId;
//        })                            // obtain id
//        .then(function (conversationId) {
//            sendMessagesFromConsole(client, conversationId);                        // start watching console input for sending new messages to bot
//            pollMessages(client, conversationId);                                   // start polling messages from bot
//        });
//});
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.sanitiziedPost = functions.database
.ref('firebase_v4_diagnostic/threads/-KrJgKt8mqAXUyOLiVHe/messages/{pushID}')
.onWrite(event => {
  const post = event.data.val();
  if(post.sanitized){
    return
  }
  post.sanitized = true;
  console.log("어떤 걸 보내> :" + event.params.pushID);
  console.log(post);
  //post.payload 가 보내진 text임
  var directLineClient = rp(directLineSpecUrl).then(function (spec) {
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

  directLineClient.then(function (client) {
    client.Conversations.Conversations_StartConversation()                          // create conversation
    .then(function (response) {
      console.log("conversationId : " + response.obj.conversationId );
      return response.obj.conversationId;
    })                            // obtain id
    .then(function (conversationId) {
          sendMessagesFromConsole(client, conversationId,post.payload,directLineClientName,directLineClientName);                           // start watching console input for sending new messages to bot
          pollMessages(client, conversationId) ;                                   // start polling messages from bot
    })


  });




});



function sanitize(s){
  var sanitizedText = s;
  sanitizedText = sanitizedText.replace(/\bstupid\b/ig, "wonderful");
  return sanitizedText;
}

function sendMessagesFromConsole(client, conversationId,input,directLineClientName,directLineClientName) {
                // send message
                client.Conversations.Conversations_PostActivity(
                {
                  conversationId: conversationId,
                  activity: {
                    textFormat: 'plain',
                    text: input,
                    type: 'message',
                    from: {
                      id: directLineClientName,
                      name: directLineClientName
                    }
                  }
                })
                .catch(function (err) {
                  console.error('Error sending message:', err);
                });

            };


// Poll Messages from conversation using DirectLine client
function pollMessages(client, conversationId) {
  console.log('Starting polling message for conversationId: ' + conversationId);
  var watermark = null;
  var recievedActivity = null;

  var refreshIntervalId = setInterval(function () {


      console.log("pollMax : " + pollMax);

      if(pollMax>0){
        clearInterval(refreshIntervalId);
      };

      client.Conversations.Conversations_GetActivities({ conversationId: conversationId, watermark: watermark })
      .then(function (response) {
      console.log("client.conversation안임. response : " + response.obj)
                watermark = response.obj.watermark;                                 // use watermark so subsequent requests skip old messages
                return response.obj.activities;
              })
      .then(printMessages);
      }, pollInterval);
}

    // Helpers methods
    function printMessages(activities) {

      console.log(activities);
        if (activities && activities.length) {
            console.log("activities.length : "+ activities.length);
            // ignore own messages
            if(activities.length==2){
               printNumber++;
               console.log("printNumber in if activities.length : " + printNumber);
            };

            activities = activities.filter(function (m) { return m.from.id !== directLineClientName });
            pollMax++;
            console.log("after activities.length : "+ activities.length);
            if (activities.length && (printNumber==1) ) {
              console.log("printNumber in if activities.length && printNumber==1 : " + printNumber);
            activities.forEach(printMessage);

          }
        }
    }

function printMessage(activity) {
    console.log("printed :"+activity.text);



}
