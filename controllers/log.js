const mongoose = require('mongoose');

const Log = require('../models/log');

let createLog = async (userID, amount, otpGenerratedFor, phoneNumber) => {
    console.log(userID, amount, otpGenerratedFor, phoneNumber, 'userID, amount, otpGenerratedFor, phoneNumber')
    const log = new Log({ userID, amount, otpGenerratedFor, phoneNumber });
    try {
        await log.save();
        return log;
    } catch (e) {
        return e;
    }
}

let updateLog = async (logID, status) => {
    try {
        const log = await Log.findById(logID);
        if (!log) {
            return null;
        }
        log.status = status;
        await log.save();
        return log;
    } catch (e) {
        return e;
    }
}

module.exports = { createLog, updateLog };