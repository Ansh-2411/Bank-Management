const mysql = require('mysql');

const con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "Bank_Management_System"
})

con.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL");
});

module.exports = con;