import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import mongoose from "mongoose";

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error);
  });

const userSchema = new mongoose.Schema({
  Email: {
    type: String,
    required: true,
  },
  Code: {
    type: Number,
  },
  Password: {
    type: String,
  },
  Name: {
    type: String,
  },
  Username: {
    type: String,
  },
  Birthdate: {
    type: Date,
  },
});

const User = mongoose.model("User", userSchema);

const sender = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

app.post("/signup", async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const Code = Math.floor(100000 + Math.random() * 900000);
    const mail = req.body.mail;
    const template = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Verify your email</title>
</head>

<body style="margin:0;padding:0;background:#080A12;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 15px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0"
style="max-width:600px;background:#11131F;border-radius:20px;padding:40px;border:1px solid #22263A;">

<tr>
<td align="center">

<div style="
height:65px;
border-radius:18px;
margin-right:20px;
">
 <img src="https://raw.githubusercontent.com/g4urav1/insta-clone/main/src/assets/famora.svg" alt="Icon">
</div>

<h1 style="
color:#fff;
margin:25px 0 5px;
font-size:32px;">
Welcome to Famora 
</h1>

<p style="
color:#9CA3AF;
font-size:16px;
line-height:28px;
margin:0 0 35px;">
Hi <b>${mail}</b>,<br>
Thanks for joining Famora.
Use the verification code below to complete your signup.
</p>

<div style="
display:inline-block;
background:#080A12;
border:1px solid #2A2E3F;
border-radius:18px;
padding:20px 35px;
letter-spacing:10px;
font-size:38px;
font-weight:bold;
color:#ffffff;">
${Code}
</div>

<p style="
color:#6B7280;
font-size:14px;
line-height:24px;
margin-top:40px;">
If you didn't create a Famora account,
you can safely ignore this email.
</p>

<hr style="
margin:40px 0;
border:none;
border-top:1px solid #23283A;">

<p style="
color:#6B7280;
font-size:13px;">
© ${year} Famora. All rights reserved.
</p>

</td>
</tr>
</table>

</td>
</tr>
</table>

</body>
</html>`;

    if (!mail) {
      res.json("Enter Email");
    }

    const userexist = await User.findOne({ Email: mail });

    if (!userexist) {
      await User.create({
        Email: mail,
        Code: Code,
      });
    }

    await sender.sendMail({
      from: `"Famora" <${process.env.MAIL_USER}>`,
      to: mail,
      subject: "Verify your Email",
      html: template,
    });

    res.status(200).json({
      message: "Confirmation code sent on email",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/signupAuth", async (req, res) => {
  try {
    const mail = req.body.mail;
    const Code = req.body.Code;

    const validUser = await User.findOne({
      Email: mail,
      Code: Code,
    });

    if (validUser) {
      res.status(200).json({
        message: "Verification Successfull",
      });

      validUser.Code = undefined;
      await validUser.save();
    } else {
      return res.status(401).json({
        message: "Invalid Code. Try again",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/createPassword", async (req, res) => {
  try {
    const mail = req.body.mail;
    const Password = req.body.password;

    const userExist = await User.findOne({ Email: mail });

    if (!userExist) {
      return res.status(404).json({
        message: "No account found with the given Email",
      });
    }

    userExist.Password = Password;
    await userExist.save();

    res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/account_setup", async (req, res) => {
  try {
    const mail = req.body.mail;
    const birthday = req.body.birthdate;
    const name = req.body.name;
    const username = req.body.username;

    const userExist = await User.findOne({ Email: mail });

    if (!userExist) {
      return res.status(404).json({
        message: "No account found ",
      });
    }

    userExist.Birthdate = birthday;
    userExist.Name = name;
    userExist.Username = username;
    await userExist.save();

    res.status(200).json({
      message: "account created successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({
        message: "Both fields are required",
      });
    }

    const user = await User.findOne({
      $or: [{ Email: identifier }, { Username: identifier }],
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found with the given Email or Username",
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        message: "Incorrect Password",
      });
    }

    res.status(200).json({
      message: "Logged in successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

app.listen(process.env.port, () => {
  console.log("http://localhost:" + process.env.port);
});
