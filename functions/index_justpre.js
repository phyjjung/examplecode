const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var rp = require('request-promise');
var replytoId;
var last_watermark;
var help_comment = ["h","H","help","Help"];

exports.junebot_communication = functions.database
.ref('firebase_v4_diagnostic/threads/{thredId}/messages/{pushID}')
.onCreate(event => {

  const post = event.data.val();
  const pushID = event.params.pushID;
  const thredId = event.params.thredId;
  const payload = post.payload;
  const directLineSecret = post.directLineSecret;
  const authorizationForHeader = 'Bearer '+directLineSecret;
  const conversationIdforthread = post.conversationId;
  const userdate = post.date;
  // var prewartermark = post.wartermark;





  // robot이면 나간다.
  if (post.isbot==1) {
    return
  } else {

  if(help_comment.includes(payload)){

    //미리 봇이 쓸 자리를 만들어 놓는다.
    var newPostKey = event.data.ref.parent.push().key;
    //firebase servertime
    var datum = userdate+2;
    //어떤 Bot인지 읽는다. Bot의 Node ID를 읽는다.
    //thread의 bot이 누구인지 저장한다.
    var botId;
    const usersAtTread = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/users');
    return  usersAtTread.once('value').then(snap =>{
      snap.forEach(childSnap=>{
        var key = childSnap.key;
        if(key!==post["user-firebase-id"]){
          botId = key;
        };
      });
        const bot_HelpComment = admin.database().ref('firebase_v4_diagnostic/bots/'+botId+'/bot_help');
        return bot_HelpComment.once('value').then(function(snap){
          console.log("help_comment : " + snap.val());
          return  admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/messages/'+newPostKey).set({
            payload : snap.val(),
            isbot : 1,
            type : 0,
            date : datum,
            ["user-firebase-id"]  : botId,
            directLineSecret: directLineSecret
          });
        })
      }
    )
  }else{
    //어떤 Bot인지 읽는다. Bot의 Node ID를 읽는다.
    //thread의 bot이 누구인지 저장한다.
    var botId;
    const usersAtTread = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/users');
    usersAtTread.once('value').then(snap =>{
      snap.forEach(childSnap=>{
        var key = childSnap.key;
        if(key!==post["user-firebase-id"]){
          botId = key;
        }
      })
    }
    )

    var prewartermark;
    const getLastwatermark = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/details/watermark');
    getLastwatermark.once('value').then(function(snapshot){
      prewartermark = snapshot.val();
    })

    //미리 봇이 쓸 자리를 만들어 놓는다.
    var newPostKey = event.data.ref.parent.push().key;
    //header작성

    if (conversationIdforthread == null){

      var options = {
        method: 'POST',
        uri: 'https://directline.botframework.com/v3/directline/conversations',
        headers: {
          'Authorization': authorizationForHeader
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options).then(function(response){

        admin.database().ref('firebase_v4_diagnostic/threads/'+ thredId +'/details/').update({
          conversationId: response.conversationId
        });
        //message를 날림.
        return response.conversationId;
      }).then(function(conversationId){
        //message를 날림.
        var optionsforsend = optionforSend(conversationId,authorizationForHeader,payload,thredId);
        rp(optionsforsend).then(function(response){
          //읽음
          var count =0;
          //var watermark = null;
          var recievedActivity = null;
          var optionread = optionForRead(conversationIdforthread,authorizationForHeader,0);
          var repeat = setInterval(function(replytoId){
            count++;
            if(count==3){
              clearInterval(repeat);
            };
            rp(optionread).then(function(responsefromRead){
              return printMessages(responsefromRead.obj.activities,response.id);
            });
          },250);

        });
      })
    } else{

      var options = optionforSend(conversationIdforthread,authorizationForHeader,payload,thredId);
      //sendMessages 부분
      rp(options).then(function(response){

        var count =0;
        var recievedActivity = null;
        var optionread = optionForRead(conversationIdforthread,authorizationForHeader,prewartermark);
        var repeat = setInterval(function(replytoId){
          count++;
          if(count==3){
            clearInterval(repeat);
          };

          rp(optionread).then(function(responsefromRead){

            return printMessages(responsefromRead,response.id);
          });
        },250);

      });

    }

  }
}

function optionforSend(conversationIdforthread,authorizationForHeader,payload,thredId) {
  return {
    method: 'POST',
    uri: 'https://directline.botframework.com/v3/directline/conversations/'+conversationIdforthread+'/activities',
    headers: {
      'Authorization': authorizationForHeader
    },
    body :{
      'type' : 'message',
      'from' : { 'id' : thredId},
      'text' : payload
    },
    json: true // Automatically parses the JSON string in the response
  };
}

function optionForRead (conversationIdforthread,authorizationForHeader,prewartermark){
  console.log("prewartermark : " +prewartermark);
  return {
    method:'GET',
    uri: 'https://directline.botframework.com/v3/directline/conversations/'+conversationIdforthread+'/activities?watermark='+prewartermark,
    headers: {
      'Authorization': authorizationForHeader
    },
    json: true // Automatically parses the JSON string in the response
  }
}

function printMessages (response,replytoId){
  //console.log("in printmessage, replytoId :" + replytoId);
  //console.log("in printmessage, activities :" + response);


  var activities_ = response.activities;
  var recieved_watermark = response.watermark;
  //  console.log("in printmessage...., activities_ :" + activities_);
  console.log("in printmessage...., watermark :" + recieved_watermark);
  if (activities_ && activities_.length) {
    activities_ = activities_.filter(function (m) { return m.from.id !== thredId });
    activities_ = activities_.filter(function (m) { return m.replytoId !== replytoId });
    //    console.log("id !== thredId... activities :" + activities_);
    printMessage(activities_[activities_.length-1],recieved_watermark);
    // if(activities_.replytoId = replytoId){
    //   clearInterval(repeat);
    // }
  }

}

function printMessage(activity,recieved_watermark) {
  console.log("activity : " , activity);

  var datum = Date.parse(activity.localTimestamp);

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
    admin.database().ref('firebase_v4_diagnostic/threads/'+ thredId +'/details/').update({["last-message-added"]  : datum, watermark : recieved_watermark });
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

});
