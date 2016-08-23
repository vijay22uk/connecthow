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
        mongoDb.get().collection('screens').count({ emailId: req.params.userId }, function (err, count) {
            if (count < 10) {
                var insertData = req.body;
                mongoDb.get().collection('screens').insert(insertData);
            }
            res.status(200).send({});
        })


    }
});

// :sessionId/:userId
router.get('/getScreenShot/:userId/:limit', function (req, res, next) {
    if (!mongoDb.get()) {
        res.status(500).send({ "success": false, "msg": "Ubale to access DB" });
    } else {

        mongoDb.get().collection('screens').find({ emailId: req.params.userId }).toArray(function (err, doc) {
            if (err) {
                res.status(500).send({ error: 'Something failed!' });
            } else {
                doc = doc || [];
                res.json(doc);
            }
        })

    }
});


module.exports = router;