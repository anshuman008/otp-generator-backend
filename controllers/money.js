const mongoose = require("mongoose");

const User = require("../models/user");
const Log = require("../models/log");

// create a function to create a in-hold transaction
let createInHoldTransaction = async (
  userID,
  amount,
  otpGenerratedFor,
  countryName,
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

    const userLog = await Log.find({ userID: user._id, status: 'in_process' });
    userLog.forEach((log) => {
      moneyToUse -= log.amount;
    });

    if (moneyToUse < amount) {
      return { error: "No money found" };
    }
    // create a log
    const log = new Log({ userID, amount, otpGenerratedFor, countryName, phoneNumber });
    
    // add log to user's inHold array

    // user.money.inHold.push({ logID: log._id, amount });
    await user.save();
    await log.save().then(res => {

      // setTimeout(async () => {
      //   res.updateStatus()
      //   console.log(user.money, 'money')
      //   const logs = await Log.find({ userID: req.user._id });
      //   await userData.save()
      // },5000)
    });
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
    // const user = await User.findById(log.userID);
    // if (!user) {
    //   return null;
    // }
    // user.money.inAccount -= log.amount;
    // const newData = user.money.inHold.filter((log) => {
    //   return log.logID.toString() !== logID.toString();
    // });
    // await newData.save();
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
    // const user = await User.findById(log.userID);
    // if (!user) {
    //   return null;
    // }
    // user.money.inHold = user.money.inHold.filter((log) => {
    //   return log.logID.toString() !== logID.toString();
    // });
    // await user.save();
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
