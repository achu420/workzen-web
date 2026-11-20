// Test Credential Generator for AppFlowy
// Run with: node generate_test_credentials.mjs

import crypto from 'crypto';

function generateTestCredentials() {
  const users = [
    { username: 'testuser', password: 'Test@123456', email: 'testuser@example.com', displayName: 'Test User' },
    { username: 'john_doe', password: 'JohnDoe@789', email: 'john.doe@example.com', displayName: 'John Doe' },
    { username: 'jane_smith', password: 'JaneSmith@321', email: 'jane.smith@example.com', displayName: 'Jane Smith' },
  ];

  console.log('='.repeat(60));
  console.log('AppFlowy Test Credentials Generator');
  console.log('='.repeat(60));
  console.log();

  users.forEach((user, index) => {
    console.log(`Test User ${index + 1}:`);
    console.log('-'.repeat(40));
    console.log(`  Email:     ${user.email}`);
    console.log(`  Password:  ${user.password}`);
    console.log(`  Username:  ${user.username}`);
    console.log(`  Name:      ${user.displayName}`);
    console.log();
  });

  console.log('='.repeat(60));
  console.log('Instructions:');
  console.log('='.repeat(60));
  console.log('1. Open your browser and navigate to: http://localhost:3001');
  console.log('2. Click on "Sign In" or "Login" button');
  console.log('3. Enter one of the email/password combinations above');
  console.log('4. Click the login button to test authentication');
  console.log();
  console.log('Note: These are test credentials for development purposes only.');
  console.log('      The actual AppFlowy application may have different auth requirements.');
  console.log('='.repeat(60));
}

// Generate and display credentials
generateTestCredentials();