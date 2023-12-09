const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        default: 'User'
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String
    },
    isPasswordChanged: {
        type: Boolean,
        default: false
    },
    money: {
        inAccount: {
            type: Number,
            default: 0
        },
        inHold: [
            {
                logID: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true,
                    ref: 'Log'
                },
                amount: {
                    type: Number,
                    required: true
                },
                // exire after 5 minutes
                // expireAt: {
                //     type: Date,
                //     default: Date.now,
                //     index: { expires: 300 }
                // }
            }
        ]
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }]
});

userSchema.methods.toJSON = function () {
    const user = this;
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.tokens;
    delete userObject.isPasswordChanged;
    return userObject;
}

userSchema.methods.generateAuthToken = async function () {
    const user = this;
    const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET);
    user.tokens = user.tokens.concat({ token });
    await user.save();
    return token;
}

userSchema.statics.findByCredentials = async (email, password) => {
    const user = await User.findOne({ email });
    console.log('Received password:', password);
    console.log('Stored hashed password:', user.password);
    if (!user) {
        throw new Error('Unable not found');
    }

    let isMatch = false

    if (password == user.password) {
        isMatch = true
    }
    else if (bcrypt.compare(password, user.password)) {
        isMatch = true
    }

    if (!isMatch) {
        throw new Error('Unable to login');
    }
    return user;
}

userSchema.pre('save', async function (next) {
    const user = this;
    if (user.isModified('password') || user.isNew) {
        user.password = await bcrypt.hash(user.password, 8);
    }
    next();
}
);


const User = mongoose.model('User', userSchema);

module.exports = User;