const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URL, {
}).then(() => {
    console.log('MongoDB successfully connected heloo. Database URL:', process.env.MONGODB_URL);
}).catch(error => {
    console.log('Error establishing MongoDB connection. Error:', error.message);
});