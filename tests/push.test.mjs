import {test} from 'node:test';import assert from 'node:assert/strict';import {validPushEndpoint} from '../netlify/functions/daily-reminders.mjs';
test('push sender only accepts known HTTPS browser push endpoints',()=>{
 for(const url of ['https://fcm.googleapis.com/fcm/send/test','https://updates.push.services.mozilla.com/wpush/v2/test','https://web.push.apple.com/Q/test','https://wns2.notify.windows.com/w/?token=x'])assert.equal(validPushEndpoint(url),true);
 for(const url of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.com/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x','https://evil.example/x'])assert.equal(validPushEndpoint(url),false);
});
