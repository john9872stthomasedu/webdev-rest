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
    
    res.status(200).type('json').send({}); // <-- you will need to change this
});

// GET request handler for neighborhoods
app.get('/neighborhoods', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    res.status(200).type('json').send({}); // <-- you will need to change this
});

// GET request handler for crime incidents
app.get('/incidents', (req, res) => {
    console.log(req.query); // query object (key-value pairs after the ? in the url)
    
    res.status(200).type('json').send({}); // <-- you will need to change this
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

    // Basic validation (optional but useful)
    if (!case_number || !date || !time || !code || !incident ||
        !police_grid || !neighborhood_number || !block) {
        res.status(500).type('txt').send('Missing required field(s)');
        return;
    }

    // 1. Check if case_number already exists
    dbSelect(
        'SELECT case_number FROM Incidents WHERE case_number = ?',
        [case_number]
    )
    .then((rows) => {
        if (rows.length > 0) {
            // case_number already exists → reject with 500
            res.status(500).type('txt').send('Case number already exists');
            // IMPORTANT: stop here so we don't keep chaining
            return null;
        }

        // 2. Insert new incident
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
        // If result is null, we already responded (case existed)
        if (result === null) {
            return;
        }

        // Insert successful
        res.status(200).type('txt').send('OK');
    })
    .catch((err) => {
        console.error(err);
        // Only send error if we haven't responded yet
        if (!res.headersSent) {
            res.status(500).type('txt').send('Database error');
        }
    });
});

// DELETE request handler for new crime incident
app.delete('/remove-incident', (req, res) => {
    console.log(req.body); // uploaded data
    
    const { case_number } = req.body;

    if (!case_number) {
        res.status(500).type('txt').send('Missing case_number');
        return;
    }

    // 1. Check if case_number exists
    dbSelect(
        'SELECT case_number FROM Incidents WHERE case_number = ?',
        [case_number]
    )
    .then((rows) => {
        if (rows.length === 0) {
            // case_number does not exist → reject with 500
            res.status(500).type('txt').send('Case number does not exist');
            return null;
        }

        // 2. Delete the incident
        return dbRun(
            'DELETE FROM Incidents WHERE case_number = ?',
            [case_number]
        );
    })
    .then((result) => {
        // If result is null, we already responded (case didn’t exist)
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
