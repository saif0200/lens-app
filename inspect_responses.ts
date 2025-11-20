import OpenAI from 'openai';
const client = new OpenAI({apiKey: 'test'});
console.log('client.responses keys:', Object.keys(client.responses));
console.log('client.responses prototype:', Object.getPrototypeOf(client.responses));
// Try to see if there is a create method and what it takes
// @ts-ignore
if (client.responses.create) {
    console.log('client.responses.create exists');
    console.log(client.responses.create.toString());
}
