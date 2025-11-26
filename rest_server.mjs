import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const db_filename = path.join(__dirname, 'db', 'stpaul_crime.sqlite3');

const port = 8000;

let app = express();
app.use(express.json());

/********************************************************************
 ***   DATABASE FUNCTIONS                                         *** 
 ********************************************************************/
// Open SQLite3 database (in read-write mode)
let db = new sqlite3.Database(db_filename, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.log('Error opening ' + path.basename(db_filename));
    }
    else {
        console.log('Now connected to ' + path.basename(db_filename));
    }
});

// Create Promise for SQLite3 database SELECT query 
function dbSelect(query, params) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(rows);
            }
        });
    });
}

// Create Promise for SQLite3 database INSERT or DELETE query
function dbRun(query, params) {
    return new Promise((resolve, reject) => {
        db.run(query, params, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
}

/********************************************************************
 ***   REST REQUEST HANDLERS                                      *** 
 ********************************************************************/
// GET request handler for crime codes
app.get('/codes', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    let q = 'SELECT * FROM Codes';
    if(Object.keys(req.query).length !== 0){
        q += ' where code = ' + req.query.code[0] + req.query.code[1] + req.query.code[2];
        for(let i = 4; i < req.query.code.length; i = i + 4){
            q += ' or code = ' + req.query.code[i] + req.query.code[i+1] + req.query.code[i+2];
        }
    }
    db.all(q, (err, rows) => {
        res.status(200).type('json').send(rows);
    });
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    let q = 'SELECT * FROM Neighborhoods'
    if(Object.keys(req.query).length !== 0){
        q += ' where neighborhood_number = '
        for(let i = 0; i < req.query.id.length; i++){
            if(req.query.id[i] != ','){
                q += req.query.id[i];
            }
            else{
                q += ' or neighborhood_number = ';
            }
        }
    }
    db.all(q, (err, rows) => {
        res.status(200).type('json').send(rows);
    });
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    let q = 'SELECT * FROM Incidents';
    let limitNum = 1000;
    if(Object.keys(req.query).length !== 0) {
        let first = true;
        q += ' WHERE ';
        for(let temp in req.query){
            if(temp == "start_date") {
                if(first == false){
                    q += ' AND '
                }
                q += "date_time > " + '\'' + req.query.start_date + " 12:00:00" + '\'';
                first = false;
            }
            else if (temp == "end_date"){
                if(first == false){
                    q += ' AND '
                }
                q += "date_time < " + '\'' + req.query.end_date + " 12:00:00" + '\'';
                first = false;
            }
            else if (temp == "code") {
                if(first == false){
                    q += ' AND '
                }
                q += 'code = ' + req.query.code[0] + req.query.code[1] + req.query.code[2];
                for(let i = 4; i < req.query.code.length; i = i + 4){
                    q += ' or code = ' + req.query.code[i] + req.query.code[i+1] + req.query.code[i+2];
                }
                first = false;
            }
            else if (temp == "grid") {
                if(first == false){
                    q += ' AND '
                }
                q += "police_grid = "
                for(let i = 0; i < req.query.grid.length; i++){
                    if(req.query.grid[i] != ","){
                        q += req.query.grid[i];
                    }
                    else if (req.query.grid[i] == ","){
                        q += " OR police_grid = ";
                    }
                }
                first = false;
            }
            else if (temp == "neighborhood") {
                if(first == false){
                    q += ' AND '
                }
                q += "neighborhood_number = ";
                for(let i = 0; i < req.query.neighborhood.length; i++){
                    if(req.query.neighborhood[i] != ","){
                        q += req.query.neighborhood[i];
                    }
                    else if (req.query.neighborhood[i] == ","){
                        q += " OR neighborhood_number = ";
                    }
                }
                first = false;
            }
            else if (temp == "limit") {
                limitNum = req.query.limit;
                first = false;
            }
        }
    }
    q += " LIMIT " + limitNum;
    console.log(q);
    db.all(q, (err, rows) => {
        res.status(200).type('json').send(rows);
    });
});

// PUT request handler for new crime incident
app.put('/new-incident', (req, res) => {
    console.log(req.body); // uploaded data
        const {
        case_number,
        date,
        time,
        code,
        incident,
        police_grid,
        neighborhood_number,
        block
    } = req.body;

    if (!case_number || !date || !time || !code || !incident ||
        !police_grid || !neighborhood_number || !block) {
        res.status(500).type('txt').send('Missing required field(s)');
        return;
    }

    // does it exist?
    dbSelect(
        'SELECT case_number FROM Incidents WHERE case_number = ?',
        [case_number]
    )
    .then((rows) => {
        if (rows.length > 0) {
            // if it exists send error status 500
            res.status(500).type('txt').send('Case number already exists');
            return null;
        }

        // add new incident
        return dbRun(
            `INSERT INTO Incidents
             (case_number, date, time, code, incident, police_grid, neighborhood_number, block)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                case_number,
                date,
                time,
                code,
                incident,
                police_grid,
                neighborhood_number,
                block
            ]
        );
    })
    .then((result) => {
        // If null case exists
        if (result === null) {
            return;
        }

        // Success
        res.status(200).type('txt').send('OK');
    })
    .catch((err) => {
        console.error(err);
        // send error if not responded
        if (!res.headersSent) {
            res.status(500).type('txt').send('Database error');
        }
    });
});

// DELETE handler for removing cases
app.delete('/remove-incident', (req, res) => {
    console.log(req.body); // uploaded data
    
    const { case_number } = req.body;

    if (!case_number) {
        res.status(500).type('txt').send('Missing case_number');
        return;
    }

    // does it exist?
    dbSelect(
        'SELECT case_number FROM Incidents WHERE case_number = ?',
        [case_number]
    )
    .then((rows) => {
        if (rows.length === 0) {
            // if not exist send error
            res.status(500).type('txt').send('Case number does not exist');
            return null;
        }

        // delete the incident
        return dbRun(
            'DELETE FROM Incidents WHERE case_number = ?',
            [case_number]
        );
    })
    .then((result) => {
        // If null, does not exist
        if (result === null) {
            return;
        }

        res.status(200).type('txt').send('OK');
    })
    .catch((err) => {
        console.error(err);
        if (!res.headersSent) {
            res.status(500).type('txt').send('Database error');
        }
    });
});

/********************************************************************
 ***   START SERVER                                               *** 
 ********************************************************************/
// Start server - listen for client connections
app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
