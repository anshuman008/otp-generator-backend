const mongoose = require('mongoose');

// Function to format date in IST and specified format
function getCurrentISTDate() {
    const offset = 5.5; // Indian time zone offset in hours
    let now = new Date();
    now.setHours(now.getHours() + offset);
    return now.toISOString()
        .replace(/T/, ',')   // replace T with a comma
        .replace(/\..+/, '') // delete the dot and everything after
        .replace(/-/g, '-')  // format to yyyy-mm-dd
        .replace(/:/g, ':'); // format time to hh,mm,ss
}

const logSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        default: 'in_process'
    },
    otpGenerratedFor: {
        type: String
    },
    phoneNumber: {
        type: String
    },
    otp: {
        type: String
    },
    createdAt: {
        type: String,
        default: getCurrentISTDate // Use the custom function for default value
    }
});

const Log = mongoose.model('Log', logSchema);

module.exports = Log;
