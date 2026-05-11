const bcrypt = require('bcrypt')
console.log(bcrypt.hashSync('superadmin@123' , 10))