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
  transports: ['websocket', 'polling'], // Specify transports
  allowEIO3: true,
  cors: {
    origin: "http://localhost:3000", // Replace with the actual domain where your frontend is hosted
    methods: ["GET", "POST"],
    credentials: true
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

const apiKey = "pYZeHfYnGPbBhuDm7lNnYzt5vGXqyyF3";

const corsOptions = {
  origin: "*", // Replace with your actual frontend domain
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
const otpReceivedFlags = {};

io.on("connection", (socket) => {
  console.log('connected new user', socket.id)

  socket.on("getNumber", async (data) => {
    console.log('get number aya', socket.id)

    try {
      const { service, country, amount, countryName } = data;

      const url = 'https://smsbower.com/stubs/handler_api.php';
      const params = {
        api_key: 'pYZeHfYnGPbBhuDm7lNnYzt5vGXqyyF3', // Use your actual API key
        action: 'getNumber',
        service: service,
        country: country,
      };
        //  console.log(data,'all details')
    
          const response = await axios.get(url, { params });
          // res.json(response.data);
          // console.log(response.data,'rsponce hai yah bhai')
      


          const userId = socket.request.user._id;

      console.log(response.data,'data hai yah')

      if (response.data.includes("ACCESS_NUMBER")) {
        const numberSequence = response.data.split(":").pop().substring(2);
        const activationId = response.data.split(":")[1];
        otpReceivedFlags[activationId] = false;

        const handleTransaction = await createInHoldTransaction(
          userId,
          amount,
          serviceMap.get(service),
          countryName,
          numberSequence
        );

        if (!response.data.includes("NO_NUMBERS")) {
          otpInterval = setInterval(() => {
            getOtp(numberSequence, activationId, socket);
            // console.log(elapsedTime,'timer hai');
            elapsedTime += 1000;
            if (elapsedTime >= 1400000) {
              elapsedTime = 0;
              clearInterval(otpInterval);
            }
          }, 1000);
          setTimeout(async () => {
            clearInterval(otpInterval);
            const paramsData = { id: activationId, phoneNumber: numberSequence };
            if (!otpReceivedFlags[activationId]) {
              await handleCancel(paramsData);
            }
          }, 1500000);

          if (handleTransaction.error) {
            console.log('tmcc')
            socket.emit("responseA", { error: handleTransaction.error });
          } else {
            console.log('hewliii')
            socket.emit("responseA", { data: response.data });
          }
        }
      } else if (response.data.includes("NO_NUMBERS")) {
        // Handle the case where "NO_NUMBERS" is received
        console.log('no number available');
        socket.emit("responseA", { error: "No available numbers" });
      } else {
        // Handle unexpected response
        socket.emit("responseA", { error: "Unexpected response from API" });
      }
    } catch (error) {
      socket.emit("responseA", { error: "Internal Server Error" });
    }
  });

  const handleCancel = async (data) => {

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

      const url = 'https://smsbower.com/stubs/handler_api.php';
      const params = {
        api_key: 'pYZeHfYnGPbBhuDm7lNnYzt5vGXqyyF3', // Use your actual API key
        action: 'setStatus',
        status: '8',
        id: id,
      };
   
        const response = await axios.get(url, { params });
    

        
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
    const { id: activationId } = data;
    if (!otpReceivedFlags[activationId]) {
      // Only allow cancellation if no OTP has been received
      clearInterval(otpInterval)
      handleCancel(data);
    } else {
      socket.emit("responseC", {
        error: "Cannot cancel number, OTP has already been received.",
      });
    }
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

  const url = 'https://smsbower.com/stubs/handler_api.php';
      const params = {
        api_key: 'pYZeHfYnGPbBhuDm7lNnYzt5vGXqyyF3', // Use your actual API key
        action: 'getStatus',
        id: id,
      };
        //  console.log(data,'all details')
    
          const response = await axios.get(url, { params });
          // res.json(response.data);
          // console.log(response.data,'rsponce hai yah bhai')
      


          // const userId = socket.request.user._id;

  // const response = await fetch(
  //   `https://smsbower.com/stubs/handler_api.php`,
  //   {
  //     params: {
  //       api_key: apiKey,
  //       action: "getStatus",
  //       id: id,
  //     },
  //     headers: {
  //       Authorization: `Bearer ${apiKey}`,
  //     },
  //     withCredentials: true,
  //   },
  //   {
  //     headers: {
  //       "Access-Control-Allow-Origin": "*",
  //     },
  //   }
  // );

  console.log(response.data,'status hai yah')

  if (response.data.includes("STATUS_CANCEL")) {
    console.log('cancel ho gya')
    clearInterval(otpInterval);
  }
  if (response.data.includes("STATUS_OK")) {
    console.log('status done hai')
    clearInterval(otpInterval);
    const otp = response.data.split(":")[1];
    otpReceivedFlags[id] = true;
    await successTransaction(phoneNumber, otp);
    socket.emit("otpResponse", { data: otp, number: phoneNumber });
  }
  // else {
  //   socket.emit("otpResponse", { msg: "OTP could not be generated" });
  // }
  return response;
};

const resendOtp = async (phoneNumber, id, socket) => {

  const url = 'https://smsbower.com/stubs/handler_api.php';
  const params = {
    api_key: 'pYZeHfYnGPbBhuDm7lNnYzt5vGXqyyF3', // Use your actual API key
    action: 'getStatus',
    id: id,
    status: 3,
  };
    //  console.log(data,'all details')

  const response = await axios.get(url, { params });
  // const response = await fetch(
  //   `https://api.grizzlysms.com/stubs/handler_api.php`,
  //   {
  //     params: {
  //       api_key: apiKey,
  //       action: "getStatus",
  //       id: id,
  //       status: 3,
  //       forward: "$forward",
  //     },
  //     headers: {
  //       Authorization: `Bearer ${apiKey}`,
  //     },
  //     withCredentials: true,
  //   },
  //   {
  //     headers: {
  //       "Access-Control-Allow-Origin": "*",
  //     },
  //   }
  // );
  if (response.data.includes("STATUS_CANCEL")) {
    clearInterval(resendOtpInterval);
  }
  if (response.data.includes("STATUS_OK")) {
    clearInterval(resendOtpInterval);
    const otp = response.data.split(":")[1];
    otpReceivedFlags[id] = true;
    await successTransaction(phoneNumber, otp);
    socket.emit("resendResponse", { data: otp, number: phoneNumber });
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
// port changed

httpServer.listen(3001, () => console.log("server started on 3000"));




module.exports.handler = serverless(app);
