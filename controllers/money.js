const mongoose = require("mongoose");

const User = require("../models/user");
const Log = require("../models/log");

// create a function to create a in-hold transaction
let createInHoldTransaction = async (
  userID,
  amount,
  otpGenerratedFor,
  phoneNumber
) => {
  // check if user has enough money in his account

  try {
    const user = await User.findOne({ _id: userID });
    if (!user) {
      console.log("user not found");
      return { error: "Not found" };
    }
    let moneyToUse = user.money.inAccount;
    user.money.inHold.forEach((log) => {
      moneyToUse -= log.amount;
    });
    if (moneyToUse < amount) {
      return { error: "No money found" };
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
};

// create a function to update a in-hold transaction and reduce the amount from user's total money
let successTransaction = async (logID, otp) => {
  console.log(logID, otp, 'otp')
  try {
    const log = await Log.findOne({phoneNumber : logID});
    if (!log) {
      return null;
    }
    log.status = "success";
    log.otp = otp;
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
};

let failTransaction = async (logID) => {
  try {
    const log = await Log.findOne({ phoneNumber: logID });
    if (!log) {
      return null;
    }
    log.status = "failed";
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
};

module.exports = {
  createInHoldTransaction,
  successTransaction,
  failTransaction,
};
