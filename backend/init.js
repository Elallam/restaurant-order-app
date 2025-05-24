// temp_hash_password.js
const bcrypt = require('bcryptjs');
const password = 'adminpassword123'; // Choose a strong password
const saltRounds = 10;
bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error("Error hashing password:", err);
        return;
    }
    console.log('Username: adminuser'); // Choose a username
    console.log('Password Hash:', hash);
    // Now use this hash in your SQL INSERT statement
});