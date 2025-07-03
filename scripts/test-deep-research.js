#!/usr/bin/env node

const BASE_URL = process.env.URL || 'http://localhost:8888';

console.log('🧪 Тестирование Deep Research...');
console.log(`🚀 Сервер: ${BASE_URL}`);
console.log('');

console.log('📋 Для тестирования выполните:');
console.log('');
console.log('1. Health Check:');
console.log(`   curl ${BASE_URL}/.netlify/functions/deep-research-health`);
console.log('');
console.log('2. Deep Research API:');
console.log(`   curl -X POST ${BASE_URL}/.netlify/functions/deep-research \\`);
console.log('        -H "Content-Type: application/json" \\');
console.log('        -d \'{"query":"машинное обучение","userId":"test-user","options":{"language":"ru"}}\'');
console.log('');
console.log('3. Чат с Deep Research:');
console.log(`   curl -X POST ${BASE_URL}/.netlify/functions/chat-stream \\`);
console.log('        -H "Content-Type: application/json" \\');
console.log('        -d \'{"message":"исследуй искусственный интеллект","sessionId":"test","mode":"researcher","language":"ru","streaming":false,"userId":"test-user"}\'');
console.log('');
console.log('📝 Примечание: Замените "test-user" на реальный UUID пользователя из базы данных');
console.log(''); 