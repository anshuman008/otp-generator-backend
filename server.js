require("dotenv").config();
require("./db/mongoose");
const express = require("express");
const axios = require("axios");
const serverless = require("serverless-http");
const app = express();
const jwt = require("jsonwebtoken");
const cors = require("cors");
const session = require("express-session");
const { serviceMap } = require("./data/data_maps");
const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Replace with the actual domain where your frontend is hosted
    methods: ["GET", "POST"],
  },
}); // Add WebSocket support

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const serviceRoutes = require("./routes/service");
// const userAuthMiddleware = require("./middleware/user_auth");

const user_auth = require("./middleware/user_auth");
const {
  createInHoldTransaction,
  failTransaction,
  successTransaction,
} = require("./controllers/money");
const User = require("./models/user");
const Log = require("./models/log");

const apiKey = "5cfea7ce31c588a9513f10b528b7fe14";

const corsOptions = {
  origin: "http://localhost:3000", // Replace with your actual frontend domain
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(express.json());
app.use(cors(corsOptions));
const secretKey = generateRandomString(32);
app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
  })
);

const userAuthMiddleware = async (socket, next) => {
  try {
    if (socket.handshake.auth && socket.handshake.auth.token) {
      const token = socket.handshake.auth.token;

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({
        _id: decoded._id,
        "tokens.token": token,
      });
      if (!user) {
        throw new Error();
      }
      socket.request.user = user;
      next();
    } else {
      throw new Error("Authorization token is missing");
    }
  } catch (error) {
    console.error("Authentication error:", error.message);
    next(new Error("Authentication failed"));
  }
};

io.use((socket, next) => {
  userAuthMiddleware(socket, next);
});

let otpInterval;
let resendOtpInterval;
let elapsedTime = 0;

io.on("connection", (socket) => {
  socket.on("getNumber", async (data) => {
    try {
      const { service, country, amount, countryName } = data;

      const response = await axios.get(
        `https://api.grizzlysms.com/stubs/handler_api.php`,
        {
          params: {
            api_key: apiKey,
            action: "getNumber",
            service,
            country,
          },
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          withCredentials: true,
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
      const userId = socket.request.user._id;
      const numberSequence = response.data.split(":").pop().substring(2);
      const activationId = response.data.split(":")[1];

      const handleTransaction = await createInHoldTransaction(
        userId,
        amount,
        serviceMap.get(service),
        countryName,
        numberSequence
      );
      // Before this timeout need to start interval for getOtp
      otpInterval = setInterval(() => {
        getOtp(numberSequence, activationId, socket);
        elapsedTime += 1000;
        if (elapsedTime >= 60000) {
          clearInterval(otpInterval);
        }
      }, 1000);
      setTimeout(async () => {
        clearInterval(otpInterval);
        const paramsData = { id: activationId, phoneNumber: numberSequence };
        await handleCancel(paramsData);
      }, 300000);

      if (handleTransaction.error) {
        socket.emit("responseA", { error: handleTransaction.error });
      } else {
        socket.emit("responseA", { data: response.data });
      }
    } catch (error) {
      console.log(error, "err");
      socket.emit("responseA", { error: "Internal Server Error" });
    }
  });

  const handleCancel = async (data) => {
    console.log("cancel called");
    try {
      const { id, phoneNumber } = data;

      if (!id) {
        socket.emit("responseC", { error: "Missing 'id' parameter" });
        return;
      }
      if (!phoneNumber) {
        socket.emit("responseC", { error: "Missing 'phoneNumber' parameter" });
        return;
      }
      const response = await fetch(
        `https://api.grizzlysms.com/stubs/handler_api.php?api_key=${apiKey}&action=setStatus&id=${id}&status=8&forward=$forward`
      );

      console.log(response.data, "res");
      if (response.status === 200) {
        await failTransaction(phoneNumber);
        socket.emit("cancelOperation", { data: true, number: phoneNumber });
      }
    } catch (error) {
      console.error("Error fetching data from the APIs:", error.message);
      socket.emit("cancelOperation", { data: false });
    }
  };

  socket.on("cancelNumber", async (data) => {
    console.log(data, "data cancel");
    handleCancel(data);
  });

  let otpElapsedTime;
  socket.on("resendOtp", (data) => {
    const { phoneNumber, id } = data;
    otpElapsedTime = 0;
    resendOtpInterval = setInterval(() => {
      resendOtp(phoneNumber, id, socket);
      otpElapsedTime += 1000;
      if (otpElapsedTime >= 60000) {
        clearInterval(resendOtpInterval);
      }
    }, 1000);
  });
});

const getOtp = async (phoneNumber, id, socket) => {
  const response = await axios.get(
    `https://api.grizzlysms.com/stubs/handler_api.php`,
    {
      params: {
        api_key: apiKey,
        action: "getStatus",
        id: id,
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      withCredentials: true,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
  console.log(response.data, "dataaa");
  if (response.data.includes("STATUS_CANCEL")) {
    clearInterval(otpInterval);
  }
  if (response.data.includes("STATUS_OK")) {
    clearInterval(otpInterval);
    const otp = response.data.split(":")[1];
    await successTransaction(phoneNumber, otp);
    socket.emit("optResponse", { data: otp, number: phoneNumber });
  } else {
    socket.emit("optResponse", { msg: "OTP could not be generated" });
  }
  return response;
};

const resendOtp = async (phoneNumber, id, socket) => {
  const response = await axios.get(
    `https://api.grizzlysms.com/stubs/handler_api.php`,
    {
      params: {
        api_key: apiKey,
        action: "getStatus",
        id: id,
        status: 3,
        forward: "$forward",
      },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      withCredentials: true,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
  console.log(response.data, 'reseponsaa')
  if (response.data.includes("STATUS_CANCEL")) {
    clearInterval(resendOtpInterval);
  }
  if (response.data.includes("STATUS_OK")) {
    clearInterval(resendOtpInterval);
    const otp = response.data.split(":")[1];
    await successTransaction(phoneNumber, otp);
    socket.emit("resendResponse", { data: otp, number: phoneNumber });
  } else {
    socket.emit("resendResponse", { msg: "OTP could not be generated" });
  }
  return response;
};

app.post("/verify-captcha", (req, res) => {
  const { captcha } = req.body;
  const expectedCaptcha = req.session.captcha;
  if (captcha === expectedCaptcha) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

app.use(adminRoutes);
app.use(userRoutes);
app.use(serviceRoutes);

httpServer.listen(5001, () => console.log("server started on 5001"));

module.exports.handler = serverless(app);
