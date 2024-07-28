const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 8081;
// Middleware to parse JSON
app.use(express.json());
// Static route for serving files
app.use('/files', express.static(path.join(__dirname, 'commands', 'tmp')));
// Route for handling Telegram Bot API
app.post('/bot:token/*', (req, res) => {
    // Logic to handle the request and respond accordingly
    // This is just a placeholder. Implement your logic here.
    res.status(200).send('Bot API route is working!');
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map