import "dotenv/config";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
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
  Contact: {
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
  ResetToken: {
    type: String,
  },
  ResetTokenExpiry: {
    type: Date,
  },
  SessionId: {
    type: String,
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
  const { mail } = req.body;

  const Code = Math.floor(100000 + Math.random() * 900000);
  const year = new Date().getFullYear();

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

  try {
    if (!mail) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    const existingUser = await User.findOne({ Email: mail });

    if (existingUser) {
      existingUser.Code = Code;
      await existingUser.save();
    } else {
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

    return res.status(200).json({
      message: "Confirmation code sent to your email.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.post("/signupAuth", async (req, res) => {
  try {
    const mail = req.body.mail;
    const Code = req.body.code;

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

    const hashedPassword = await bcrypt.hash(Password, 10);

    const userExist = await User.findOne({ Email: mail });

    if (!userExist) {
      return res.status(404).json({
        message: "No account found with the given Email",
      });
    }

    userExist.Password = hashedPassword;
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
    const birthdate = req.body.birthday;
    const name = req.body.name;
    const username = req.body.userName;

    const userExist = await User.findOne({ Email: mail });

    if (!userExist) {
      return res.status(404).json({
        message: "No account found ",
      });
    }

    userExist.Birthdate = birthdate;
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

    const MatchedPassword = await bcrypt.compare(password, user.Password);

    if (!MatchedPassword) {
      return res.status(401).json({
        message: "Incorrect Password",
      });
    }

    const SessionId = crypto.randomBytes(32).toString("hex");
    user.SessionId = SessionId;
    await user.save();
    res.status(200).json({
      message: "Logged in successfully",
      user,
      SessionId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ Email: email });

    if (!user) {
      return res.status(200).json({
        message: "If an account exists, a password reset link has been sent.",
      });
    }

    const token = Math.random().toString(36).substring(2) + Date.now();

    user.ResetToken = token;

    await user.save();

    const link = `http://localhost:5173/password/reset?token=${token}`;

    const html = `
     <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset Password</title>
</head>

<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f7;padding:40px 20px;">
    <tr>
      <td align="center">

        <table role="presentation" width="600" cellspacing="0" cellpadding="0"
          style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;
          box-shadow:0 12px 35px rgba(0,0,0,.08);">

          <tr>
            <td align="center"
              style="padding:48px 40px;background:linear-gradient(135deg,#7C3AED,#A855F7);">


              <h1 style="
                margin:24px 0 10px;
                color:#fff;
                font-size:32px;
                font-weight:700;">
                Reset Your Password
              </h1>

              <p style="
                margin:0;
                color:rgba(255,255,255,.9);
                font-size:16px;
                line-height:26px;">
                Secure your account by creating a new password.
              </p>

            </td>
          </tr>

          <tr>
            <td style="padding:48px 40px;">

              <h2 style="
                margin:0 0 18px;
                color:#111827;
                font-size:24px;">
                Hello,
              </h2>

              <p style="
                margin:0 0 18px;
                color:#6B7280;
                font-size:16px;
                line-height:28px;">

                We received a request to reset the password associated with your account.

                If you made this request, click the button below to choose a new password.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:35px auto;">
                <tr>
                  <td align="center"
                    style="
                    border-radius:12px;
                    background:linear-gradient(135deg,#7C3AED,#A855F7);">

                    <a href="${link}"
                      style="
                      display:inline-block;
                      padding:16px 34px;
                      color:#ffffff;
                      font-size:16px;
                      font-weight:600;
                      text-decoration:none;
                      border-radius:12px;">
                      Reset Password →
                    </a>

                  </td>
                </tr>
              </table>

         
              <div style="
                height:1px;
                background:#E5E7EB;
                margin:40px 0;">
              </div>

              

            </td>
          </tr>

          <tr>
            <td style="
              padding:32px 40px;
              background:#F9FAFB;
              border-top:1px solid #E5E7EB;
              text-align:center;">

              <p style="
                margin:0 0 12px;
                color:#374151;
                font-size:15px;
                font-weight:600;">
                Didn't request a password reset?
              </p>

              <p style="
                margin:0;
                color:#6B7280;
                font-size:14px;
                line-height:24px;">

                You can safely ignore this email. Your password will remain unchanged.
              </p>

              <p style="
                margin-top:28px;
                color:#9CA3AF;
                font-size:13px;">
                © 2026 Your Company. All rights reserved.
              </p>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>

    `;

    await sender.sendMail({
      from: `"Famora" <${process.env.MAIL_USER}>`,
      to: email,
      subject: "Reset your password",
      html,
    });

    res.status(200).json({
      message: "Reset link sent.",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      ResetToken: token,
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset link.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.Password = hashedPassword;
    user.ResetToken = undefined;

    await user.save();

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (err) {
    console.log(err);

    res.status(500).json({
      message: "Server Error",
    });
  }
});

app.post("editProfile", async (req, res) => {
  try {
    const { SessionId, Name, Phone, UserName, Password } = req.body;

    const user = await User.findOne({ SessionId });

    if (!user) {
      return res.status(401).json({
        message: "Invalid Session",
      });
    }
    if (user.Password !== Password) {
      return res.status(401).json({
        message: "Incorrect Password",
      });
    }

    if (Name !== undefined) {
      user.Name = Name;
    }

    if (Contact !== undefined) {
      user.Phone = Phone;
    }

    if (UserName !== undefined) {
      user.UserName = UserName;
    }

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.listen(process.env.port, () => {
  console.log("http://localhost:" + process.env.port);
});
