const { checkOwner } = require("../middlewares/role");

router.post('/owner/upload-documents', checkOwner, (req, res) => {

})