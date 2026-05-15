// ============================================================
//  cron/expireBookings.js
//  Runs every 5 minutes.
//  Finds AWAITING_PAYMENT bookings past their deadline.
//  Sets status = EXPIRED.
//  Does NOT restore occupied_slots because slots were never
//  decremented — slots only decrement on payment confirmation.
//
//  Install node-cron:
//    npm install node-cron
//
//  Add to server.js:
//    require('./cron/expireBookings')
// ============================================================

const cron = require('node-cron')
const pool = require('../db/pool')

// Runs every 5 minutes
cron.schedule('*/5 * * * *', () => {

    console.log('[CRON] Checking for expired bookings...')

    const expireSql = `
        UPDATE bookings
        SET status     = 'EXPIRED',
            updated_at = NOW()
        WHERE status           = 'AWAITING_PAYMENT'
          AND payment_deadline < NOW()
    `

    pool.query(expireSql, (err, data) => {
        if (err) {
            console.error('[CRON] Failed to expire bookings:', err.message)
            return
        }

        if (data.affectedRows > 0) {
            console.log(`[CRON] Expired ${data.affectedRows} booking(s)`)
        } else {
            console.log('[CRON] No expired bookings found')
        }
    })
})