const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const jwt = require("jsonwebtoken");

const pool = require("../db/pool");
const result = require("../utils/result");
const generateToken = require('../utils/generateToken');


// =================================================================================================================================

//  ----------------------       REGISTER      ------------------------------
router.post("/auth/register", (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !email || !phone || !password || !role) {
    return res.send(result.createResult("All fields are required"));
  }

  if (!["user", "owner"].includes(role)) {
    return res.send(result.createResult("Invalid role"));
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  //1 — check if email or phone already exists
  const checkSql = "SELECT id FROM users WHERE email = ? OR phone = ?";
  pool.query(checkSql, [email, phone], (err, data) => {
    if (err) {
      return res.send(result.createResult("Database error, try later"));
    }
    if (data.length !== 0) {
      return res.send(result.createResult("Email or phone already registered"));
    }

    // 2 — insert user (unverified)
    const insertUserSql =
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)";
    pool.query(
      insertUserSql,
      [name, email, phone, hashedPassword, role],
      (err, data) => {
        if (err) {
          return res.send(result.createResult("Failed to create user"));
        }

        const uId = data.insertId;

        if (role === "owner") {
          const ownerSql = "INSERT INTO owners (user_id) VALUES (?)";
          pool.query(ownerSql, [uId], (err) => {
            if (err) {
              return res.send( result.createResult("Failed to create owner profile") );
            }
            generateAndSendOtp(uId, phone, res);
          });
        } else {
            generateAndSendOtp(uId, phone, res);
        }
      },
    );
  });
});
// =================================================================================================================================




// =================================================================================================================================

//  -------------------  VERIFY OTP  ----------------------------------
router.post("/verify-otp", (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.send(result.createResult("userId and otp are required"));
  }

  // Step 1 — find latest unused OTP for this user
  const findOtpSql =
    "SELECT * FROM otp_verifications WHERE user_id = ? AND otp_code = ? AND used = 0";
  pool.query(findOtpSql, [userId, otp], (error, data) => {
    if (error) {
      return res.send(result.createResult("Something went wrong, try later"));
    }
    if (data.length === 0) {
      return res.send(result.createResult("Invalid OTP"));
    }

    const otpData = data[0];

    // Step 2 — check expiry
    if (new Date(otpData.expires_at) < new Date()) {
      return res.send(
        result.createResult("OTP expired, please request a new one"),
      );
    }

    // Step 3 — mark OTP as used
    const markUsedSql = "UPDATE otp_verifications SET used = 1 WHERE id = ?";
    pool.query(markUsedSql, [otpData.id], (error) => {
      if (error) {
        return res.send(result.createResult("Something went wrong, try later"));
      }

      // Step 4 — mark user phone as verified
      const verifyUserSql =
        "UPDATE users SET is_phone_verified = 1 WHERE id = ?";
      pool.query(verifyUserSql, [userId], (error) => {
        if (error) {
          return res.send( result.createResult("Something went wrong, try later"));
        }

        // Step 5 — respond success
        const getUser = 'SELECT * FROM users WHERE id = ?'
        pool.query(getUser , [userId] , (error,data)=>{
            if(error){
                return res.send(result.createResult("Please try again later !"))
            }
           
            const user = data[0]
            const token = generateToken(user)
            const userData = {
            token,
            role : user.role
            };
        return res.send(result.createResult(null, userData));
        })
       
      });
    });
  });
});

// =================================================================================================================================




// =================================================================================================================================

//  ---------------------  RESEND OTP  ---------------------------------------
router.post("/auth/resend-otp", (req, res) => {
  const { userId, phone } = req.body;

  if (!userId || !phone) {
    return res.send(result.createResult("userId and phone are required"));
  }

  generateAndSendOtp(userId, phone, res);
});


// =================================================================================================================================

// ------------------    Login   --------------------
router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM users WHERE email = ?";

  pool.query(sql, [email], async (err, data) => {
    if (err) {
      return res.send(result.createResult("Database error"));
    }

    if (data.length === 0) {
      return res.send(result.createResult("User not found"));
    }

    const user = data[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.send(result.createResult("Invalid password"));
    }

    const token = generateToken(user)
    const userData = {
      token,
      role : user.role
    };
    return res.send(result.createResult(null, userData));
  });
});
// =================================================================================================================================



// =================================================================================================================================

//   --------------  OTP generation function ----------------------------------
function generateAndSendOtp(uId, phone, res) {
  const otp = 123456;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const insertOtpSql =
    "INSERT INTO otp_verifications (user_id, otp_code, type, expires_at) VALUES (?,?,?,?)";
  pool.query(insertOtpSql, [uId, otp, "phone", expiresAt], (err) => {
    if (err) {
      return res.send(result.createResult("Failed to generate OTP"));
    }
    console.log(`OTP for ${phone}: ${otp}`);
    return res.send({
      status: "success",
      data: "Registration successful, please verify OTP",
      userId: uId,
    });
  });
}

module.exports = router;
