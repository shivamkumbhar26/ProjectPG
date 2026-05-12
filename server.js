require('dotenv').config()
const express = require('express')
const app = express()
const commonRouter = require('./routes/common')
const path = require('path')

const auth = require('./middlewares/auth')
const ownerRoutes = require('./routes/owner')
const adminRouter = require('./routes/admin')

app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use(auth)
app.use(commonRouter)
app.use(ownerRoutes)
app.use(adminRouter)
app.listen(4000, () => { 
    console.log("Server started on port 4000")
})