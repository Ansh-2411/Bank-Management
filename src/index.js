const con = require("./config");
const express = require("express");
const cors = require('cors')
const bodyparser = require('body-parser');

const app = express();
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({ extended: true }))

app.set('view engine', 'ejs')

app.use(express.static("public"))

const corsOptions = {
    origin: "http://localhost:3000",
    methods: "GET, POST, PUT,  DELETE, PATCH, HEAD",
    credentials: true
}
app.use(cors(corsOptions));


app.listen(4000, () => {
    console.log("listning at port 4000");
})

app.get("/", (req, res) => {
    // const sql = "select * from customer"
    // const sql = "select * from branch"
    // con.query(sql, (err, result) => {
    //     if (err) throw err;
    //     console.log(result)
    //     res.send(result)
    // })
    res.render("login")
})
app.post("/login", (req, res) => {
    const name = req.body.account
    const password = req.body.password
    if (name.slice(0, 1).toLowerCase() == "c") {
        const sql = `select * from customer where password="${password}" and user_name="${name}" `
        // const sql = "select * from branch"
        con.query(sql, (err, result) => {
            if (err) throw err;
            // res.send({ result: result })
            if (result.length > 0) {
                const sql = `select * from transaction where sender_account_no=(select account_no from customer where user_name="${name}") or receiver_account_no=(select account_no from customer where user_name="${name}") order by transaction_id desc;`;
                con.query(sql, (err, result2) => {
                    if (err) throw err;
                    res.render("customer", { detail: result, history: result2 })
                })
            }
            else {
                res.redirect("/")
            }
        })
    }
    else if (name.slice(0, 1).toLowerCase() == "e") {
        const sql = `select * from employee where password="${password}" and user_name="${name}" `
        con.query(sql, (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                if (result[0].job == "Cashier") {

                    res.render("empCash")
                }
                else {
                    res.render("empAccount")
                }
            }
            else {
                res.redirect("/")
            }
        })
    }
    else if (name.slice(0, 1).toLowerCase() == "a") {
        res.render("admin")
    }
    else {
        res.redirect("/")
    }
})
// --------remaining
app.post("/add_employee", (req, res) => {
    const sql = `insert into employee(name,user_name,address,mobile_no,password,branch_code,job) values("${req.body.name}","${req.body.user_name}","${req.body.address}",${req.body.mobile_no},"${req.body.Password}","Bank123","${req.body.job}");`
    con.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result)
        res.send(result)
    })
})

app.post("/add_account", (req, res) => {
    function generateAccountNumber() {
        const min = 100000000000;
        const max = 999999999999;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function generateIFSC() {
        const min = 100;
        const max = 999;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    console.log(req.body.Uname, req.body.user_name, req.body.address, req.body.mobile, req.body.password)
    let accountNumber = generateAccountNumber()
    let ifsc = "SBI" + generateIFSC()
    const sql = `insert into customer(name,user_name,address,mobile_no,account_no,ifsc_code,balance,password,branch_code) values ("${req.body.Uname}","${req.body.user_name}","${req.body.address}","${req.body.mobile}",${accountNumber},"${ifsc}",0,"${req.body.password}","Bank123")`;
    con.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result)
        res.send({ result: result, accountNumber: accountNumber })
    })
})

app.post("/transaction", (req, res) => {
    console.log(req.body.account, req.body.amount, req.body.password, req.body.sender, req.body.sendername);
    // Begin transaction
    con.beginTransaction(function (err) {
        if (err || req.body.sender == req.body.account) {
            return res.send(false)
            // return res.render("unsucess")
        }

        // Update sender's balance
        const sql1 = `UPDATE customer SET balance = (balance - ?) WHERE account_no = ? AND password = ?`;
        con.query(sql1, [req.body.amount, req.body.sender, req.body.password], function (err, result1) {
            if (err || result1.affectedRows <= 0) {
                con.rollback(function () {
                });
                return res.send(false)
                // return res.render("unsucess")
            }

            // Update receiver's balance
            const sql2 = `UPDATE customer SET balance = (balance + ?) WHERE account_no = ?;`;
            con.query(sql2, [req.body.amount, req.body.account], function (err, result2) {
                if (err || result2.affectedRows <= 0) {
                    console.log(err)
                    con.rollback(function () {
                        return res.send(false)
                        // return res.render("unsucess")
                    });
                }
                let receiverName = ""
                const sql4 = `select name from customer where account_no=${req.body.account};`;
                con.query(sql4, function (err, result4) {
                    if (err) {
                        con.rollback(function () {
                            return res.send(false)
                            // return res.render("unsucess")
                        });
                    }
                    receiverName = result4[0].name

                    // Record transaction
                    const sql3 = `INSERT INTO transaction (sender_account_no, receiver_account_no, amount,sender_name,receiver_name) VALUES (?, ?, ?, ?, ?)`;
                    const values = [req.body.sender, req.body.account, req.body.amount, req.body.sendername, receiverName];
                    con.query(sql3, values, function (err, result3) {
                        if (err || result3.affectedRows <= 0) {
                            console.log(err)
                            con.rollback(function () {
                                return res.send(false)
                                // return res.render("unsucess")
                            });
                        }

                        // Commit the transaction
                        con.commit(function (err) {
                            if (err) {
                                con.rollback(function () {
                                    return res.send(false)
                                    // return res.render("unsucess")
                                });
                            }
                            res.send(true)
                        });
                    });
                });
            });
        });
    });
});

app.get("/transaction_history", (req, res) => {
    const sql = "select user_name from customer";
    con.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result)
        res.send(result)
    })
})

app.post("/transfer", (req, res) => {
    console.log(req.body.account, req.body.amount, req.body.status, req.body.password)
    let sql
    if (req.body.status == "0") {
        sql = `UPDATE customer SET balance = (balance - ${req.body.amount}) WHERE account_no =${req.body.account} AND password = "${req.body.password}"`;
    }
    else if (req.body.status == "1") {
        sql = `UPDATE customer SET balance = (balance + ${req.body.amount}) WHERE account_no =${req.body.account} AND password = "${req.body.password}"`;
    }
    else {
        sql = ""
    }
    con.query(sql, (err, result) => {
        if (err) res.send(err);
        console.log(result)
        res.send(result)
    })
})

app.get("/empdetail", (req, res) => {
    const sql = "select * from employee"
    con.query(sql, (err, result) => {
        if (err) res.send(err);
        console.log(result)
        res.send(result)
    })
})

app.post("/deleteEmp", (req, res) => {
    const sql = `delete from employee where employee_id=${req.body.id} `
    con.query(sql, (err, result) => {
        if (err) res.send(err);
        console.log(result)
        res.send(result)
    })
})

app.get("/todaytransaction", (req, res) => {
    const current_date = new Date()
    const current_day = current_date.getDate();
    const current_month = current_date.getMonth() + 1;
    const current_year = current_date.getFullYear();
    const sql = `SELECT * FROM transaction WHERE DAY(date) = ${current_day} AND MONTH(date) = ${current_month} AND YEAR(date) = ${current_year}`;
    con.query(sql, (err, result) => {
        if (err) res.send(err);
        console.log(result)
        res.send(result)
    })
})

app.post("/customerDeatil", (req, res) => {
    const sql = `select * from customer where account_no=${req.body.account}`
    con.query(sql, (err, result) => {
        if (err) res.send(err);
        console.log(result)
        res.send(result)
    })
})
//" 1" OR "1"="1   "