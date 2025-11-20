import OpenAI from 'openai';
console.log(Object.keys(new OpenAI({apiKey: 'test'})));
console.log(Object.keys(OpenAI));
