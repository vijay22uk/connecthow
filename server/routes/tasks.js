var express = require('express');
var router = express.Router();
var mongoDb = require('../modules/dbutil');
router.get('/', function (req, res, next) {
    res.render('index', { message: "welcom" });
});

router.post('/saveScreenShot/', function (req, res, next) {
   if (!mongoDb.get()) {
        res.status(500).send({ "success": false, "msg": "Ubale to access DB" });
    } else {
        var insertData = req.body;
        console.log(insertData);
        mongoDb.get().collection('screens').insert(insertData)

    }
});

// :sessionId/:userId
router.get('/getScreenShot/:userId/:limit', function (req, res, next) {
    if (!mongoDb.get()) {
        res.status(500).send({ "success": false, "msg": "Ubale to access DB" });
    } else {
        
        mongoDb.get().collection('screens').find({ emailId: req.params.userId }).toArray(function (err, doc) {
            console.log("db access");
            if (err) {
                console.log("eer");
                res.status(500).send({ error: 'Something failed!' });
            } else {
                doc = doc || [];
                 console.log(doc);
                res.json(doc);
            }
        })

    }
});


module.exports = router;