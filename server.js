require('dotenv').config()
const express = require('express')
const app = express()
const commonRouter = require('./routes/common')

const auth = require('./middlewares/auth')

app.use(express.json())
app.use(auth)
app.use(commonRouter)
app.listen(4000, () => { 
    console.log("Server started on port 4000")
})