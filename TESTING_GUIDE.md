# AppFlowy Testing Guide

This guide provides test credentials and instructions for testing the AppFlowy application.

## 📋 Test Credentials

### Standard Test Users

| # | Email | Password | Username | Display Name |
|---|-------|----------|----------|--------------|
| 1 | `testuser@example.com` | `Test@123456` | testuser | Test User |
| 2 | `john.doe@example.com` | `JohnDoe@789` | john_doe | John Doe |
| 3 | `jane.smith@example.com` | `JaneSmith@321` | jane_smith | Jane Smith |

## 🚀 Testing Instructions

### Method 1: Browser Login (Recommended)

1. **Start the development server** (if not already running):
   ```bash
   cd /Volumes/work disk/Codes/Tracker/AppFlowy-Web
   npm run dev
   ```

2. **Open your browser** and navigate to: 
   `http://localhost:3001`

3. **Find the login/signup form** (usually in the top-right corner)

4. **Enter credentials**:
   - Email: `testuser@example.com`
   - Password: `Test@123456`

5. **Click the login button** and observe:
   - If successful, you should be logged in
   - If not, check the console for errors (F12 > Console)

### Method 2: Using Test Login Page

A pre-configured test page is available at:
`/Volumes/work disk/Codes/Tracker/AppFlowy-Web/test_login.html`

Open this file in your browser - it will auto-fill the form with test credentials.

### Method 3: API Testing (Advanced)

Run the API test script to verify backend connectivity:
```bash
node test_api.mjs
```

This will check if the server is responding and show which credentials are ready for testing.

## 🔍 Troubleshooting

### Common Issues

1. **Server not running**: Make sure you've started the dev server with `npm run dev`
2. **Port conflict**: If port 3001 is in use, try killing the process:
   ```bash
   pkill -9 -f vite
   ```
3. **Build errors**: Run `npm install` if you see dependency errors
4. **CORS issues**: The dev server should handle CORS automatically

### Checking Server Status

```bash
curl -s http://localhost:3001 | head -5
```

Should return HTML content if the server is running.

## 📝 Notes

- These credentials are for **testing purposes only**
- The actual AppFlowy application may have different authentication requirements
- Passwords should contain at least one special character and be 8+ characters long
- Email addresses use the `@example.com` domain which is reserved for testing

## 🎯 Quick Test Checklist

- [ ] Server started with `npm run dev`
- [ ] Browser opened to `http://localhost:3001`
- [ ] Login form found and credentials entered
- [ ] Login button clicked
- [ ] Result observed (success or error message)

## 📞 Support

If you encounter issues:
1. Check the browser console for errors (F12 > Console)
2. Review the server logs in your terminal
3. Verify all dependencies are installed (`npm install`)
4. Try a different browser if the issue persists