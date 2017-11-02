global.XMLHttpRequest = require('./node_modules/xhr2');
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
var _botframeworkDirectlinejs = require('botframework-directlinejs');

var directLine = new _botframeworkDirectlinejs.DirectLine({
  secret: 'ioB5_QxSUV4.cwA.0Mw.05cCZPbi9EuJ6a91-103WwluccCgL12xWqb_927-OwE',
});

exports.junebot_communication = functions.database
.ref('firebase_v4_diagnostic/threads/{thredId}/messages/{pushID}')
.onCreate(event => {
  var userIdatBotchannel;
  var conversationIdforthread;
  var pushID;
  var thredId;
  var root;
  var botId;
  //const userID = post.user-firebase-id;
  const post = event.data.val();
  pushID = event.params.pushID;
  thredId = event.params.thredId;
  root = event.data.ref.root;

  console.log("pushID : " + pushID);
  console.log("thredId : " + thredId);
  console.log("messages : " + post.payload);
  console.log("isbot : "+post.isbot);
  console.log("firebase-id : "+ post["user-firebase-id"]);
  // robot이면 나간다.
  if (post.isbot==1) {
    console.log("it is robot! out!");
    return
  }

 //thread의 bot이 누구인지 저장한다.
  const usersAtTread = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/users');
  usersAtTread.once('value').then(snap =>{
    snap.forEach(childSnap=>{
      var key = childSnap.key;
      if(key!==post["user-firebase-id"]){
        botId = key;
        console.log("key : "+ key);
      }

    }
  )
  });



  admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/details').once('value').then(function(snapshot){
    conversationIdforthread = snapshot.val().conversationId;
    console.log("inthread onversation Id : " + conversationIdforthread);


    if (conversationIdforthread){
      console.log("insideif");


      const dl = new DirectLine({
          secret: 'ioB5_QxSUV4.cwA.0Mw.05cCZPbi9EuJ6a91-103WwluccCgL12xWqb_927-OwE',
          conversationId: conversationIdforthread
      });
      directLine.postActivity({
        from: { id: conversationIdforthread, name: pushID }, // required (from.name is optional) userID가 PushID임
        type: 'message',
        text: post.payload
      }).subscribe(function (id) {
        return
      }, function (error) {
        return console.log("Error posting activity", error);
      }
    )

    directLine.activity$.filter(function (activity) {
      return activity.type === 'message'&& activity.replyToId ===conversationIdforthread;
    }).subscribe(function (message) {
      var datum = Date.parse(message.localTimestamp);
      //시간변환
      console.log("시간변환 : " + datum);
      //var newPostKey = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId).push().key;
      var newPostKey = event.data.ref.parent.push().key;
      console.log("newkey : " + newPostKey);
      var botMessage = {
        payload:message.text,
        type:0,
        isbot : 1, //bot이면 1
        date : datum,
        ["user-firebase-id"]  : botId
      };
      var lastupadate ={
        ["last-message-added"]  : datum
      }
      console.log("message  :", message);
      //var updates = {};
      updates['firebase_v4_diagnostic/threads/'+ thredId +'/details'] = lastupadate;
      //admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/details').set(lastupadate);
      //시간만 update
      admin.database().ref().update(lastupadate);
      return admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/'+newPostKey).set(botMessage);
      //return event.data.ref.parent.child(newPostKey).set(botMessage);//console.log("message  :", message);

    })

  }
  else{
    console.log("elsif")


    directLine.postActivity({
      from: { id: 'pushID', name: pushID }, // required (from.name is optional) userID가 PushID임
      type: 'message',
      text: post.payload
    }).subscribe(function (id) {
      console.log("Id  :", id);
      var conversationIdnumber = {
        conversationId : id
      };
      admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/details').update(conversationIdnumber);
      return conversationIdforthread = id;
    }, function (error) {
      return console.log("Error posting activity", error);
    }
  )

}

directLine.activity$.filter(function (activity) {
  return activity.type === 'message'&& activity.replyToId ===conversationIdforthread;
}).subscribe(function (message) {
  var datum = Date.parse(message.localTimestamp);
  //시간변환
  console.log("시간변환 : " + datum);
  //var newPostKey = admin.database().ref('firebase_v4_diagnostic/threads/'+thredId).push().key;
  var newPostKey = event.data.ref.parent.push().key;
  console.log("newkey : " + newPostKey);
  var botMessage = {
    payload:message.text,
    type:0,
    isbot : 1, //bot이면 1
    date : datum,
    ["user-firebase-id"]  : botId
  };
  var lastupadate ={
    ["last-message-added"]  : datum,
    conversationId : conversationIdforthread
  }
  console.log("message  :", message);
  // var updates = {};
  updates['firebase_v4_diagnostic/threads/'+ thredId +'/details'] = lastupadate;
  //admin.database().ref('firebase_v4_diagnostic/threads/'+thredId+'/details').set(lastupadate);
  admin.database().ref().update(updates);
  return event.data.ref.parent.child(newPostKey).set(botMessage);//console.log("message  :", message);

})


})



//한번 쓴거면 나간다.
// if (post.sanitized){
//   return
// }
//한번 쓴거라고 마크함.
// var postData = {
//   sanitized: true,
// };
// event.data.ref.update(postData);

//  var threadbotId;






return

});
