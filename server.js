const express = require("express");
const cors = require("cors");
require("dotenv").config();
const db = require("./db");

const app = express();
app.use(cors());
app.use(express.json());


app.get("/coupons", (req, res) => {
    db.query("SELECT * FROM coupons WHERE status = 'available'", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ coupons: results });
    });
});


app.post("/claim", (req, res) => {
    const userIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || (req.ip === "::1" ? "127.0.0.1" : req.ip);
    const browserCookie = req.body.browser_cookie; 

    // if (!browserCookie) {
    //     return res.status(400).json({ error: "Browser cookie is required." });
    // }

  
    db.query(
        "SELECT * FROM users WHERE ip_address = ? OR browser_cookie = ?",
        [userIp, browserCookie],
        (err, users) => {
            if (err) return res.status(500).json({ error: err.message });

            if (users.length > 0) {
                return res.status(400).json({ error: "You have already claimed a coupon." });
            }

        
            db.query("SELECT * FROM coupons WHERE status = 'available' LIMIT 1", (err, coupons) => {
                if (err) return res.status(500).json({ error: err.message });

                if (coupons.length === 0) {
                    return res.status(400).json({ error: "No coupons available." });
                }

                const coupon = coupons[0];

               
                db.query(
                    "UPDATE coupons SET status = 'claimed', assigned_to = ?, claimed_at = NOW() WHERE id = ?",
                    [browserCookie, coupon.id],
                    (err) => {
                        if (err) return res.status(500).json({ error: err.message });

                        
                        db.query(
                            "INSERT INTO users (ip_address, browser_cookie, last_claim_time) VALUES (?, ?, NOW())",
                            [userIp, browserCookie]
                        );

                      
                        db.query(
                            "INSERT INTO claim_history (user_id, coupon_id, claimed_at) VALUES ((SELECT id FROM users WHERE browser_cookie = ?), ?, NOW())",
                            [browserCookie, coupon.id]
                        );

                        res.json({ message: "Coupon claimed successfully!", coupon });
                    }
                );
            });
        }
    );
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
