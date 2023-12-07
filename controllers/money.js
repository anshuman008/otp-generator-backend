const mongoose = require('mongoose');

const User = require('../models/user');
const Log = require('../models/log');

// create a function to create a in-hold transaction
let createInHoldTransaction = async (userID, amount, otpGenerratedFor, phoneNumber) => {
    // check if user has enough money in his account
    try {
        console.log('first')
        const user = await User.findById(userID);
        if (!user) {
            console.log('user not found')
            return { error: 'Not found' };
        }
        if (user.money.inAccount < amount) {
            return { error: 'No money found' };
        }
        // create a log
        const log = new Log({ userID, amount, otpGenerratedFor, phoneNumber });
        await log.save();
        // add log to user's inHold array
        
        user.money.inHold.push({ logID: log._id, amount });
        await user.save();
        return log;
    } catch (e) {
        return e;
    }
}

// create a function to update a in-hold transaction and reduce the amount from user's total money
let successTransaction = async (logID) => {
    try {
        const log = await Log.findById(logID);
        if (!log) {
            return null;
        }
        log.status = 'success';
        await log.save();
        // reduce the amount from user's total money
        const user = await User.findById(log.userID);
        if (!user) {
            return null;
        }
        user.money.inAccount -= log.amount;
        user.money.inHold = user.money.inHold.filter((log) => {
            return log.logID.toString() !== logID.toString();
        });
        await user.save();
        return log;
    } catch (e) {
        return e;
    }
}

let failTransaction = async (logID) => {
    try {
        const log = await Log.findById(logID);
        if (!log) {
            return null;
        }
        log.status = 'failed';
        await log.save();
        // add the amount back to user's total money
        const user = await User.findById(log.userID);
        if (!user) {
            return null;
        }
        user.money.inHold = user.money.inHold.filter((log) => {
            return log.logID.toString() !== logID.toString();
        });
        await user.save();
        return log;
    } catch (e) {
        return e;
    }
}

module.exports = { createInHoldTransaction, successTransaction, failTransaction };