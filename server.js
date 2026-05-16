require('dotenv').config()
const express = require('express')
const app = express()
const commonRouter = require('./routes/common')
const path = require('path')

const auth = require('./middlewares/auth')
const ownerRoutes = require('./routes/owner')
const adminRouter = require('./routes/admin')
const bookingRoutes = require('./routes/booking')
const pgRouter = require('./routes/pg')
const adminPgRouter = require('./routes/admin.pg')
const searchPg = require('./routes/search')
const userRouter = require('./routes/user')



require('./cron/expireBookings')

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(auth)

app.use(bookingRoutes)
app.use(searchPg)
app.use(commonRouter)
app.use(ownerRoutes)
app.use(adminRouter)
app.use(pgRouter)
app.use(adminPgRouter)
app.use(userRouter)
app.listen(4000, () => { 
    console.log("Server started on port 4000")
})