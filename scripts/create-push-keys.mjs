import webpush from 'web-push';
// Run on your own machine. Never commit the generated private key.
console.log(JSON.stringify(webpush.generateVAPIDKeys(),null,2));
