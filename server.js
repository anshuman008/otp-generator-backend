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
    origin: "http://localhost:3000",  // Replace with the actual domain where your frontend is hosted
    methods: ["GET", "POST"],
  },
}); // Add WebSocket support

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const serviceRoutes = require("./routes/service");
// const userAuthMiddleware = require("./middleware/user_auth");

const user_auth = require("./middleware/user_auth");
const { createInHoldTransaction, failTransaction, successTransaction } = require("./controllers/money");
const User = require("./models/user");

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
      // console.log('Token received:', token);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });
      if (!user) {
          throw new Error();
      }

      // In a real application, you might want to check the user in the database
      // and ensure the token is still valid.

      socket.request.user = user;
      // console.log('User authenticated:', socket.request.user);

      next();
    } else {
      throw new Error('Authorization token is missing');
    }
  } catch (error) {
    console.error('Authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
};


// io.use(userAuthMiddleware);

io.use((socket, next) => {
  userAuthMiddleware(socket, next);
});
io.on("connection", (socket) => {
  // socket.use(userAuthMiddleware);
  socket.on("getNumber", async (data) => {
    console.log(data, 'data')
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

      const handleTransaction = await createInHoldTransaction(userId, amount, serviceMap.get(service), countryName, numberSequence);
      if (handleTransaction.error) {
        socket.emit('responseA', { error: handleTransaction.error });
      } else {
        socket.emit('responseA', { data: response.data });
      }
    } catch (error) {
      console.log(error, 'err')
      socket.emit('responseA', { error: "Internal Server Error" });
    }
  });

  socket.on("cancelNumber", async (data) => {
    try {
      const { id, phoneNumber } = data;

      if (!id) {
        socket.emit('responseC', { error: "Missing 'id' parameter" });
        return;
      }
      if (!phoneNumber) {
        socket.emit('responseC', { error: "Missing 'phoneNumber' parameter" });
        return;
      }

      const response = await axios.get(
        `https://api.grizzlysms.com/stubs/handler_api.php`,
        {
          params: {
            api_key: apiKey,
            action: "setStatus",
            id: id,
            status: 8,
            forward: `$forward`,
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
      await failTransaction(phoneNumber);
      socket.emit('responseC', { data: response.data });
    } catch (error) {
      console.error("Error fetching data from the APIs:", error.message);
      socket.emit('responseC', { error: "Internal Server Error" });
    }
  });

  socket.on("getOtp", async (data) => {
    try {
      const { id, phoneNumber } = data;

      if (!id) {
        socket.emit('responseC', { error: "Missing 'id' parameter" });
        return;
      }

      const response = await getOtp(phoneNumber, id);
      socket.emit('responseC', { data: response.data });
    } catch (error) {
      console.error("Error fetching data from the APIs:", error.message);
      socket.emit('responseC', { error: "Internal Server Error" });
    }
  });
});

const getOtp = async (phoneNumber, id) => {
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
  if (response.data.includes("STATUS_OK")) {
    const otp = response.data.split(":")[1];
    await successTransaction(phoneNumber, otp);
  }
  return response;
};

// app.get("/captcha", (req, res) => {
//   const captcha = svgCaptcha.create();
//   req.session.captcha = captcha.text;
//   res.type("svg");
//   res.status(200).send(captcha.data);
// });

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
