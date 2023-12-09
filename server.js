require("dotenv").config();
require("./db/mongoose");
const express = require("express");
const axios = require("axios");
const svgCaptcha = require("svg-captcha");
const app = express();
const cors = require("cors");
const session = require("express-session");

const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");

const user_auth = require("./middleware/user_auth");
const { createInHoldTransaction, failTransaction, successTransaction } = require("./controllers/money");

const apiKey = "29963e8b073ee4b745be2ed51409fb08";
const service = "us";
const country = 22;

app.use(cors());
app.use(express.json());
const secretKey = generateRandomString(32);
app.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/api/getNumber", user_auth, async (req, res) => {
  try {
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
    // const userId = '6571db6f890ed6c52bc4cd52'
    const userId = req.user._id
    console.log(userId, 'req.user')
    const numberSequence = response.data.split(":").pop().substring(2);
    const handleTransaction = await createInHoldTransaction(userId, 10, 'irctc', numberSequence);
    if (handleTransaction.error) {
      console.log(handleTransaction.error, 'errr')
      res.status(404);
    }
    res.json({data:response.data});
  } catch (error) {
    console.error("Error fetching data from the APIs:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/cancelNumber", user_auth, async (req, res) => {
  try {
    const { id, phoneNumber } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing 'id' parameter" });
    }
    if (!phoneNumber) {
      return res.status(400).json({ error: "Missing 'phoneNumber' parameter" });
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
    await failTransaction(phoneNumber)
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching data from the APIs:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/getOtp", async (req, res) => {
  try {
    const { id, phoneNumber } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing 'id' parameter" });
    }

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
    if(response.data.includes("STATUS_OK")) {
      console.log('status ok')
      const otp = response.data.split(":")[1]
      await successTransaction(phoneNumber,otp);
    }
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching data from the APIs:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/captcha", (req, res) => {
  const captcha = svgCaptcha.create();
  req.session.captcha = captcha.text; // Save captcha value in session for validation
  res.type("svg");
  res.status(200).send(captcha.data);
});

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

app.listen(8080, () => console.log("server started on 8080"));
