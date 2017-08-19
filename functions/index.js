const functions = require('firebase-functions');
var Swagger = require('swagger-client');
var open = require('open');
var rp = require('request-promise');

// config items
var pollInterval = 1000;
var directLineSecret = 'ioB5_QxSUV4.cwA.0Mw.05cCZPbi9EuJ6a91-103WwluccCgL12xWqb_927-OwE';
var directLineClientName = 'DirectLineClient';
var directLineSpecUrl = 'https://docs.botframework.com/en-us/restapi/directline3/swagger.json';

function makeclient(directurl){
  
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
};


// once the client is ready, create a new conversation 
directLineClient.then(function (client) {
    client.Conversations.Conversations_StartConversation()                          // create conversation
        .then(function (response) {
            return response.obj.conversationId;
        })                            // obtain id
        .then(function (conversationId) {
            sendMessagesFromConsole(client, conversationId);                        // start watching console input for sending new messages to bot
            pollMessages(client, conversationId);                                   // start polling messages from bot
        });
});
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
                  console.log("어떤 걸 정화? :" + event.params.pushID);
                  console.log(post);
                  post.payload = sanitize(post.payload);
                  return event.data.ref.set(post);
                })

function sanitize(s){
  var sanitizedText = s;
  sanitizedText = sanitizedText.replace(/\bstupid\b/ig, "wonderful");
  return sanitizedText;
}
