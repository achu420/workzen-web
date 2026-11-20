// Simple utility to generate dummy user credentials for testing
// Run with: node dummy_user_credentials.js

import crypto from 'crypto';

function generateDummyCredentials() {
  // Generate random but consistent-looking data
  const adjectives = ['Happy', 'Brave', 'Quick', 'Silent', 'Witty', 'Jolly', 'Keen', 'Eager'];
  const nouns = ['Fox', 'Bear', 'Wolf', 'Lion', 'Tiger', 'Leopard', 'Panther', 'Cougar'];

  // Generate random indices
  const adjIndex = Math.floor(Math.random() * adjectives.length);
  const nounIndex = Math.floor(Math.random() * nouns.length);
  
  const username = `${adjectives[adjIndex]}${nounIndex + 1}`;
  const password = generateRandomPassword(12);
  const email = `${username.toLowerCase()}@example.com`;

  return {
    username,
    password,
    email,
    displayName: `${adjectives[adjIndex]} ${nouns[nounIndex]}`
  };
}

function generateRandomPassword(length) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|{}[]:;<>?,./';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  return password;
}

// Generate and display credentials
console.log('Generated Dummy User Credentials:');
console.log('================================');
const creds = generateDummyCredentials();
console.log(`Username: ${creds.username}`);
console.log(`Password: ${creds.password}`);
console.log(`Email: ${creds.email}`);
console.log(`Display Name: ${creds.displayName}`);
console.log('\nNote: These are for testing purposes only.');