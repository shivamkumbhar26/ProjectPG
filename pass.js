const bcrypt = require('bcrypt')
console.log(bcrypt.hashSync('subadmin@123' , 10))