// Simple API Test Script for AppFlowy
// Run with: node test_api.mjs

const testCredentials = [
  { email: 'testuser@example.com', password: 'Test@123456' },
  { email: 'john.doe@example.com', password: 'JohnDoe@789' },
];

console.log('='.repeat(60));
console.log('AppFlowy API Test Script');
console.log('='.repeat(60));
console.log();

console.log('Testing if the backend is running...\n');

// Test 1: Check if server is responding
fetch('http://localhost:3001/api/health')
  .then(response => {
    if (response.ok) {
      console.log('✓ Backend is running and healthy!');
      return response.json();
    }
    throw new Error('Server not responding correctly');
  })
  .then(data => {
    console.log('  Server status:', data.status || 'OK');
    console.log();
    testLogin();
  })
  .catch(error => {
    console.log('✗ Backend health check failed:', error.message);
    console.log();
    console.log('Trying to access the main page...\n');
    
    // Fallback: try to fetch the main page
    fetch('http://localhost:3001')
      .then(response => {
        if (response.ok) {
          console.log('✓ Main page is accessible!');
          console.log();
          testLogin();
        } else {
          throw new Error('Main page not accessible');
        }
      })
      .catch(err => {
        console.log('✗ Could not connect to server:', err.message);
        console.log();
        console.log('Please make sure:');
        console.log('  1. The backend is running (npm run dev)');
        console.log('  2. No other service is using port 3001');
        console.log('  3. You have internet connection if needed');
      });
  });

function testLogin() {
  console.log('='.repeat(60));
  console.log('Testing Login Credentials');
  console.log('='.repeat(60));
  console.log();

  testCredentials.forEach((cred, index) => {
    console.log(`Test ${index + 1}:`);
    console.log(`  Email:     ${cred.email}`);
    console.log(`  Password:  ${cred.password}`);
    
    // In a real test, you would POST to the login endpoint
    // For now, we'll just show what would be sent
    console.log('  Status:    Ready for manual testing');
    console.log();
  });

  console.log('='.repeat(60));
  console.log('Manual Testing Instructions:');
  console.log('='.repeat(60));
  console.log('1. Open http://localhost:3001 in your browser');
  console.log('2. Find the login/signup form');
  console.log('3. Enter one of the test credentials above');
  console.log('4. Submit and observe the result');
  console.log();
}