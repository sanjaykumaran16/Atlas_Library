import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import bcrypt from 'bcrypt';
import { EventEmitter } from 'events';
import connection from './db.js';
import path from 'path';
import nodemailer from 'nodemailer';

import { fileURLToPath } from 'url';


import 'dotenv/config';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emitter = new EventEmitter();
emitter.setMaxListeners(1000);
const app = express();
const PORT = process.env.PORT || 3000;
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // false for STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  
  
  transporter.verify((error, success) => {
    if (error) {
      console.error('Nodemailer verify error:', error);
    } else {
      console.log('Nodemailer is ready to send emails');
    }
  });
  
// Middleware to parse request body
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());  // for parsing application/json

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));
// Middleware to configure session
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
}));

// Middleware to serve static files
app.use(express.static('public'));
app.use('/ProjectImages',express.static('E:/ProjectImages'));
app.use('/e_books',express.static('E:/e_books'));
// Middleware to prevent caching
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Input validation middleware
const validateLoginInput = (req, res, next) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).send('All fields are required');
    }
    if (role !== 'librarian' && role !== 'member') {
        return res.status(400).send('Invalid role');
    }
    next();
};

app.get('/', (req, res) => {
    res.redirect('/login');
});

// Login Route (GET) - To serve the login form
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

let currentuser=0;

// Login Route
app.post('/login', validateLoginInput, (req, res) => {
    const { username, password, role } = req.body;

    try {
        connection.query(
            'SELECT * FROM users WHERE LOWER(name) = LOWER(?) AND role = ?', [username, role],
            (err, results) => {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Internal Server Error');
                }

                if (results.length === 0) {
                    console.log('No user found with the provided credentials.');
                    return res.status(401).send('Invalid credentials');
                }

                const user = results[0];
                console.log('User found:', user);

                // Plain-text password comparison
                if (password !== user.password_hash) {
                    console.log('Password mismatch.');
                    return res.status(401).send('Invalid credentials');
                }
                
                // Store user information in session
                req.session.regenerate(err => {
                    if (err) {
                        console.error('Session regeneration error:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    // Set session data
                    currentuser=req.session.userId = user.user_id;
                    req.session.username = user.name;
                    req.session.role = user.role;
                    
                    console.log('Session created:', req.session);

                    // Redirect to the appropriate HTML file
                    if (user.role === 'librarian') {
                        return res.redirect('/librarian');
                    } else if (user.role === 'member') {
                        return res.redirect('/member');
                    }
                });
            }
        );
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).send('Internal Server Error');
    }
});


// Logout Route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Logout failed');
        }
        res.redirect('/login');
    });
});


app.post('/signup', async(req, res) => {
    const { username, email, password, role, location } = req.body;
    const hashedPassword = password;
    const userLocation = location;
    let userLat,userLon;
    //Getting user's location
    if (!userLocation) {
        return res.status(400).json({ error: 'Please provide a place query' });
      }
    
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(userLocation)}&format=json&limit=1`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'YourAppName/1.0'
          }
        });
    
        const data = await response.json();
    
        if (data.length === 0) {
          return res.status(404).json({ error: 'Location not found' });
        }
    
        const { lat, lon, display_name } = data[0];
        userLat = lat;
        userLon = lon;
        console.log('Location : ' + display_name);

        // Insert the user into the database
    connection.query(
        'INSERT INTO users (name, email, password_hash, role, longitude, latitude) VALUES (?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, role,userLon,userLat],
        (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }

            console.log('User registered successfully:', results);

            // Redirect based on role
            res.redirect('/login');
        
        } )
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch location' });
      }
    
});
app.get('/member', (req, res) => {
    console.log('Session data on /member:', req.session);

    if (!req.session.userId || req.session.role !== 'member') {
        return res.status(403).send('Access denied. Please login as member.');
    }

    const userId = req.session.userId;

    connection.query('SELECT balance FROM users WHERE user_id = ?', [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user balance:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            console.log('User not found.');
            return res.status(404).send('User not found.');
        }

        const balance = results[0].balance;

        // Fetch user's favorite genre, author, and books read
        const userId = req.session.userId;
        const query2 = `
            SELECT 
                b.genre
            FROM borrow_history bh
            JOIN books b ON bh.book_id = b.book_id
            WHERE bh.user_id = ? AND bh.return_date IS NOT NULL
            GROUP BY b.genre
            ORDER BY COUNT(*) DESC
            LIMIT 1
        `;

        const query3 = `
            SELECT COUNT(*) AS booksRead
            FROM borrow_history
            WHERE user_id = ? AND return_date IS NOT NULL
        `;

        connection.query(query2, [userId], (err2, results2) => {
            if (err2) {
                console.error('Error fetching user stats:', err2);
                return res.status(500).send('Internal Server Error');
            }

            let favoriteGenre = 'N/A';
            let favoriteAuthor = 'N/A';

            if (results2.length > 0) {
                favoriteGenre = results2[0].genre;
                favoriteAuthor = results2[0].author;
            }

            connection.query(query3, [userId], (err3, results3) => {
                if (err3) {
                    console.error('Error fetching books read:', err3);
                    return res.status(500).send('Internal Server Error');
                }

                let booksRead = 0;
                if (results3.length > 0) {
                    booksRead = results3[0].booksRead;
                }

                res.render('member', { 
                    balance: balance,
                    favoriteGenre: favoriteGenre,
                    favoriteAuthor: favoriteAuthor,
                    booksRead: booksRead
                });
            });
        });
    });
});

app.get('/bookrecommendation', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    const query2 = `
        SELECT 
            b.genre
        FROM borrow_history bh
        JOIN books b ON bh.book_id = b.book_id
        WHERE bh.user_id = ? AND bh.return_date IS NOT NULL
        GROUP BY b.genre
        ORDER BY COUNT(*) DESC
        LIMIT 1
    `;

    connection.query(query2, [userId], (err2, results2) => {
        if (err2) {
            console.error('Error fetching user stats:', err2);
            return res.status(500).send('Internal Server Error');
        }

        let favoriteGenre = 'N/A';

        if (results2.length > 0) {
            favoriteGenre = results2[0].genre;
        }

        const query4 = `
            SELECT DISTINCT title, author
            FROM books
            WHERE genre = ?
        `;

        connection.query(query4, [favoriteGenre], (err4, results4) => {
            if (err4) {
                console.error('Error fetching book recommendations:', err4);
                return res.status(500).send('Internal Server Error');
            }

            res.render('bookrecommendation', {
                books: results4
            });
        });
    });
});
app.get('/goback',(req,res)=> {
    res.redirect('/bookSearch');
});
// Serve bookSearch.html as /bookSearch
app.get('/bookSearch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', '/member/bookSearch.html'));
    
});

// Serve borrowed.html as /borrowed


// Make sure currentuser is defined, either globally or passed through session/auth
app.get('/borrowed', (req, res) => {
    const query = `
        SELECT 
            bh.borrow_id,
            bh.book_id,
            b.title,
            b.author,
            l.name AS library_name,
            bh.borrow_date,
            bh.due_date,
            bh.return_date,
            bh.fine_amount,
            bh.library_id,
            l.fine AS fine_per_day
        FROM 
            borrow_history bh
        JOIN 
            books b ON bh.book_id = b.book_id
        JOIN 
            libraries l ON bh.library_id = l.library_id
        WHERE 
            bh.user_id = ?
    `;

    connection.query(query, [currentuser], (err, results) => {
        if (err) {
            console.error('Error fetching borrow history:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        results.forEach(item => {
            if (!item.return_date) {
                const dueDate = new Date(item.due_date);
                const today = new Date();
                const timeDiff = today.getTime() - dueDate.getTime();
                const daysOverdue = Math.ceil(timeDiff / (1000 * 3600 * 24));

                let fineAmount = 0;
                if (daysOverdue > 0) {
                    fineAmount = daysOverdue * item.fine_per_day;
                }
                item.fine_amount = fineAmount;
            }
            // If return_date is not null, keep existing fine_amount from DB
        });

        res.render('borrowhistory', { borrowdetails: results });
    });
});



app.get('/member/bookSearch', (req, res) => {
    const searchTerm = req.query.search;

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    // First, get user location
    const locQuery = `SELECT longitude, latitude FROM users WHERE user_id = ?`;
    connection.query(locQuery, [currentuser], (err, userResults) => {
        if (err) {
            console.error('Error fetching user location:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (userResults.length === 0) {
            console.log('No user found with the provided credentials.');
            return res.redirect('/login');
        }

        const userLat = userResults[0].latitude;
        const userLon = userResults[0].longitude;

        console.log("Search Term:", searchTerm);
        console.log("User Location:", userLat, userLon);

        const query = `
            SELECT b.book_id, b.title, b.author, b.price, b.rating, b.genre, b.isbn,b.e_book,
                   l.name AS library_name, l.latitude, l.longitude, b.availability,l.images,
                   (6371 * ACOS(
                        COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                        COS(RADIANS(l.longitude) - RADIANS(?)) +
                        SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
                   )) AS distance
            FROM books b
            LEFT JOIN libraries l ON b.library_id = l.library_id
            WHERE b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ? OR b.isbn LIKE ?
        `;

        const likeTerm = `%${searchTerm}%`;
        const values = [
            userLat, userLon, userLat, // For distance calc
            likeTerm, likeTerm, likeTerm, likeTerm
        ];

        connection.query(query, values, (err, bookResults) => {
            if (err) {
                console.error('Error fetching books:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            console.log(bookResults.length);
console.log("Query Results:", bookResults);

if (bookResults.length === 0) {
    return res.render('booksearchresults', { books: [], searchTerm, message: 'No books found' });
}

const allUnavailable = bookResults.every(book => book.availability === 0);

if (allUnavailable) {
    // Reservation logic (you can insert your existing reservation logic here)
    const bookToReserve = bookResults[0]; // or let the user choose
    console.log(bookToReserve);
    connection.query(
        `SELECT * FROM reservations WHERE user_id = ? AND book_id = ?`,
        [currentuser, bookToReserve.book_id],
        (err, existingReservations) => {
            if (err) {
                console.error('Error checking reservation:', err);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            console.log(existingReservations);
            if (existingReservations.length > 0) {
                return res.render('reservation_waitlist', {
                    book: bookToReserve,
                    message: 'You have already reserved this book. Please wait for it to be available.'
                });
            }

            // Insert reservation
            connection.query(
                `INSERT INTO reservations (user_id, book_id, reserved_at) VALUES (?, ?, NOW())`,
                [currentuser, bookToReserve.book_id],
                (err) => {
                    if (err) {
                        console.error('Error inserting reservation:', err);
                        return res.status(500).json({ error: 'Error reserving the book' });
                    }

                    res.render('reservation_waitlist', {
                        book: bookToReserve,
                        message: 'All copies are currently borrowed. You have been added to the reservation list.'
                    });
                }
            );
        }
    );
} else {
    // Some books are available — show all book results
    return res.render('booksearchresults', { books: bookResults, searchTerm });
}

        });
    });
});
app.get('/member/bookSearch/sortbydistance', (req, res) => {
    const searchTerm = req.query.search;
    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }
    // First, get user location
    const locQuery = `SELECT longitude, latitude FROM users WHERE user_id = ?`;
    connection.query(locQuery, [currentuser], (err, userResults) => {
        if (err) {
            console.error('Error fetching user location:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        if (userResults.length === 0) {
            console.log('No user found with the provided credentials.');
            return res.status(401).send('Invalid credentials');
        }

        const userLat = userResults[0].latitude;
        const userLon = userResults[0].longitude;

        console.log("Search Term:", searchTerm);
        console.log("User Location:", userLat, userLon);
    
    // Start base query
    let query = `
        SELECT b.book_id, b.title, b.author, b.price, b.rating, b.genre, b.isbn,
               l.name AS library_name, l.latitude, l.longitude, b.availability,l.images,
               (6371 * ACOS(
                    COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                    COS(RADIANS(l.longitude) - RADIANS(?)) +
                    SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
               )) AS distance
        FROM books b
        LEFT JOIN libraries l ON b.library_id = l.library_id
        WHERE b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ? OR b.isbn LIKE ?
        ORDER BY distance ASC
    `;

    const likeTerm = `%${searchTerm}%`;

    const values = [
        userLat, userLon, userLat, // For distance calculation
        likeTerm, likeTerm, likeTerm, likeTerm // For LIKE conditions
    ];

    connection.query(query, values, (err, results) => {
        if (err) {
            console.error('Error fetching books:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        console.log("Query Results:", results); // `distance` will now appear here

        // Render with `distance` included in each book object
        res.render('booksearchresults', { books: results, searchTerm });
    });
});
});

app.get('/member/bookSearch/sortbyprice', (req, res) => {
    const userLat = 13.0827;
    const userLon = 80.2707;
    const searchTerm = req.query.search;
    console.log("Search Term:", searchTerm);

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    let query = `
    SELECT b.book_id, b.title, b.author, b.price, b.rating, b.genre, b.isbn,
           l.name AS library_name, l.latitude, l.longitude, b.availability,l.images,
           (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
           )) AS distance
    FROM books b
    LEFT JOIN libraries l ON b.library_id = l.library_id
    WHERE b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ? OR b.isbn LIKE ?
    ORDER BY b.price ASC;
`;

    const likeTerm = `%${searchTerm}%`;
    const values = [
        userLat, userLon, userLat, // For distance calculation
        likeTerm, likeTerm, likeTerm, likeTerm // For LIKE conditions
    ];


    connection.query(query, values, (err, results) => {
        if (err) {
            console.error('Error fetching books:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.render('booksearchresults', { books: results, searchTerm });
    });
});
app.get('/member/bookSearch/sortbydistanceandprice', (req, res) => {
    const userLat = 13.0827;
    const userLon = 80.2707;
    const searchTerm = req.query.search;
    console.log("Search Term:", searchTerm);

    if (!searchTerm) {
        return res.status(400).json({ error: 'Search term is required' });
    }

    let query = `
    SELECT b.book_id, b.title, b.author, b.price, b.rating, b.genre, b.isbn,
           l.name AS library_name, l.latitude, l.longitude, b.availability,
           (6371 * ACOS(
                COS(RADIANS(?)) * COS(RADIANS(l.latitude)) *
                COS(RADIANS(l.longitude) - RADIANS(?)) +
                SIN(RADIANS(?)) * SIN(RADIANS(l.latitude))
           )) AS distance
    FROM books b
    LEFT JOIN libraries l ON b.library_id = l.library_id
    WHERE b.title LIKE ? OR b.author LIKE ? OR b.genre LIKE ? OR b.isbn LIKE ?
    ORDER BY b.price ASC
    ORDER BY distance ASC;
`;

    const likeTerm = `%${searchTerm}%`;
    const values = [
        userLat, userLon, userLat, // For distance calculation
        likeTerm, likeTerm, likeTerm, likeTerm // For LIKE conditions
    ];


    connection.query(query, values, (err, results) => {
        if (err) {
            console.error('Error fetching books:', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }

        res.render('booksearchresults', { books: results, searchTerm });
    });
});
// Admin Route
app.get('/librarian', (req, res) => {
    console.log('Session data on /admin:', req.session);

    if (!req.session.userId || req.session.role !== 'librarian') {
        return res.status(403).send('Access denied. Please login as admin.');
    }

    const userId = req.session.userId;

    // Step 1: Get the library_id
    connection.query('SELECT library_id FROM libraries WHERE user_id = ?', [userId], (err, userResults) => {
        if (err) {
            console.error('Error fetching user library_id:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (userResults.length === 0 || !userResults[0].library_id) {
            console.error('User not found or no library_id associated.');
            return res.status(404).send('User not found or no library associated.');
        }

        const libraryId = userResults[0].library_id;

        // Step 2: Get library details
        connection.query('SELECT * FROM libraries WHERE library_id = ?', [libraryId], (err, libraryResults) => {
            if (err) {
                console.error('Error fetching library details:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (libraryResults.length === 0) {
                console.error('Library not found.');
                return res.status(404).send('Library not found.');
            }

            const libraryDetails = libraryResults[0];

            // Step 3: Get book count
            connection.query('SELECT COUNT(*) AS bookCount FROM books WHERE library_id = ?', [libraryId], (err, bookResults) => {
                if (err) {
                    console.error('Error fetching book count:', err);
                    return res.status(500).send('Internal Server Error');
                }

                const bookCount = bookResults[0].bookCount;

                // Step 4: Get borrow count
                connection.query('SELECT COUNT(*) AS borrowCount FROM borrow_history WHERE library_id = ?', [libraryId], (err, borrowResults) => {
                    if (err) {
                        console.error('Error fetching borrow count:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    const borrowCount = borrowResults[0].borrowCount;

                    // Step 5: Get most favorite author
                    connection.query(`
                        SELECT b.author, COUNT(*) AS count
                        FROM borrow_history bh
                        JOIN books b ON bh.book_id = b.book_id
                        WHERE bh.library_id = ?
                        GROUP BY b.author
                        ORDER BY count DESC
                        LIMIT 1
                    `, [libraryId], (err, authorResults) => {
                        if (err) {
                            console.error('Error fetching favorite author:', err);
                            return res.status(500).send('Internal Server Error');
                        }

                        const favoriteAuthor = authorResults.length > 0 ? authorResults[0].author : 'N/A';

                        // Step 6: Get most favorite genre
                        connection.query(`
                            SELECT b.genre, COUNT(*) AS count
                            FROM borrow_history bh
                            JOIN books b ON bh.book_id = b.book_id
                            WHERE bh.library_id = ?
                            GROUP BY b.genre
                            ORDER BY count DESC
                            LIMIT 1
                        `, [libraryId], (err, genreResults) => {
                            if (err) {
                                console.error('Error fetching favorite genre:', err);
                                return res.status(500).send('Internal Server Error');
                            }

                            const favoriteGenre = genreResults.length > 0 ? genreResults[0].genre : 'N/A';

                            // Step 7: Get top user by borrow count
                            connection.query(`
                                SELECT u.name, COUNT(*) AS count
                                FROM borrow_history bh
                                JOIN users u ON bh.user_id = u.user_id
                                WHERE bh.library_id = ?
                                GROUP BY bh.user_id
                                ORDER BY count DESC
                                LIMIT 1
                            `, [libraryId], (err, topUserResults) => {
                                if (err) {
                                    console.error('Error fetching top user:', err);
                                    return res.status(500).send('Internal Server Error');
                                }

                                const topUser = topUserResults.length > 0 ? topUserResults[0].name : 'N/A';

                                // Final render
                                res.render('librarian', {
                                    libraryDetails,
                                    bookCount,
                                    borrowCount,
                                    favoriteAuthor,
                                    favoriteGenre,
                                    topUser
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
// Member Route
app.get('/member', (req, res) => {
    console.log('Session data on /member:', req.session);

    if (!req.session.userId || req.session.role !== 'member') {
        return res.status(403).send('Access denied. Please login as member.');
    }
    res.sendFile(path.join(__dirname,'public/librarian/librarian.html'));

});

app.get('/user-info', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized');
    }
    res.json({
        username: req.session.username,
        role: req.session.role
    });
});

//User - Book Search
app.post('/member/borrow', (req, res) => {
    const { book_id, library_name, due_date } = req.body;
    console.log(req.body);
    if (!currentuser) {
        return res.status(401).send('Not logged in');
    }

    const getLibraryIdQuery = `
        SELECT library_id FROM libraries WHERE name = ?
    `;

    connection.query(getLibraryIdQuery, [library_name], (err, results) => {
        if (err) {
            console.error("Error fetching library ID:", err);
            return res.status(500).send("Error fetching library ID");
        }

        // Check if result exists
        if (!results || results.length === 0) {
            console.error("Library not found or empty result:", results);
            return res.status(404).send("Library not found");
        }

        const library_id = results[0].library_id;

        const today = new Date();
        const formattedDate = today.toISOString().slice(0, 19).replace('T', ' '); // MySQL DATETIME format

        const insertQuery = `
            INSERT INTO borrow_history (user_id, book_id, library_id, borrow_date, due_date)
            VALUES (?, ?, ?, ?, ?)
        `;

        connection.query(
            insertQuery,
            [currentuser, book_id, library_id, formattedDate, due_date],
            (err) => {
                if (err) {
                    console.error("Error inserting borrow history:", err);
                    return res.status(500).send("Database error");
                }
                res.redirect('/borrowed');
            }
        );
    });
});

app.post('/member/returnBook', (req, res) => {
    const borrowId = req.body.borrow_id;
    const today = new Date().toISOString().split('T')[0]; // format: YYYY-MM-DD

    const getBorrowDetailsQuery = `
        SELECT 
            bh.user_id,
            bh.due_date,
            bh.library_id,
            l.fine AS fine_per_day,
            bh.book_id
        FROM 
            borrow_history bh
        JOIN 
            libraries l ON bh.library_id = l.library_id
        WHERE 
            bh.borrow_id = ?
    `;

    connection.query(getBorrowDetailsQuery, [borrowId], (err, results) => {
        if (err) {
            console.error('Error fetching borrow details:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            console.log('Borrow record not found.');
            return res.status(404).send('Borrow record not found.');
        }

        const { user_id, due_date, fine_per_day, library_id,book_id } = results[0];
        const dueDate = new Date(due_date);
        const returnDate = new Date(today);
        const timeDiff = returnDate.getTime() - dueDate.getTime();
        const daysOverdue = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let fineAmount = 0;
        if (daysOverdue > 0) {
            fineAmount = daysOverdue * fine_per_day;
        }

        // Update borrow_history with return date and fine amount
        const updateBorrowQuery = `
            UPDATE borrow_history 
            SET return_date = ?, fine_amount = ? 
            WHERE borrow_id = ?
        `;

        connection.query(updateBorrowQuery, [today, fineAmount, borrowId], (err) => {
            if (err) {
                console.error('Error updating return date and fine:', err);
                return res.status(500).send('Internal Server Error');
            }
            const updateAvailability = `
            UPDATE BOOKS SET AVAILABILITY=1 WHERE BOOK_ID=?
        `;

        connection.query(updateAvailability , [book_id], (err, reservationResults) => {
            if (err || reservationResults.length === 0) {
                console.log(`Cannot update availability${book_id}`);
                return;
            }

            // Deduct fine from user's balance
            const updateUserBalanceQuery = `
                UPDATE users 
                SET balance = balance - ? 
                WHERE user_id = ?
            `;

            connection.query(updateUserBalanceQuery, [fineAmount, user_id], (err) => {
                if (err) {
                    console.error('Error updating user balance:', err);
                    return res.status(500).send('Internal Server Error');
                }

                // Add fine to the library's balance
                const updateLibraryBalanceQuery = `
                    UPDATE libraries 
                    SET balance = balance + ? 
                    WHERE library_id = ?
                `;

                connection.query(updateLibraryBalanceQuery, [fineAmount, library_id], (err) => {
                    if (err) {
                        console.error('Error updating library balance:', err);
                        return res.status(500).send('Internal Server Error');
                    }
                    const callProcedure = `CALL mark_overdue_books();`;

    connection.query(callProcedure, (err, results) => {
        console.log(results);
        if (err) {
            console.error('Error calling stored procedure:', err);
            return res.status(500).send('Failed to mark overdue books.');
        }
        const updateQuery = `
        UPDATE borrow_history
        SET return_date = NOW(), fine_amount = 0
        WHERE borrow_id = ?
    `;

    connection.query(updateQuery, [borrowId], (err, result) => {
        if (err) {
            console.error('Error updating return:', err);
            return res.status(500).send('Error returning book');
        }

        // Step 2: Automatically assign the book to the reserved user (if any)
                handleReturnedBook(borrowId);

                    res.render('rate-book', { book_id });
                     });
                });
            });
        });
    });
});
});
});

    app.get('/books',(req,res)=> {
            const userId = req.session.userId;
            console.log(userId);
        
            if (!userId) {
                return res.redirect('/login');
            }
        
            // Step 1: Get library_id from users table
            const userQuery = 'SELECT library_id FROM libraries WHERE user_id = ?';
            connection.query(userQuery, [userId], (err, userResults) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Database error');
                }
        
                if (userResults.length === 0) {
                    return res.status(404).send('User not found');
                }
        
                const libraryId = userResults[0].library_id;
        
                // Step 2: Get all books from that library
                const bookQuery = 'SELECT * FROM books WHERE library_id = ?';
                connection.query(bookQuery, [libraryId], (err, bookResults) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Database error');
                    }
        
                    res.render('avail_books', { books: bookResults });
                });
            });
        });
 
      /*  app.get('/booksList', (req, res) => {
            const userId = req.session.userId;
            console.log(userId);
        
            if (!userId) {
                return res.redirect('/login');
            }
        
            // Step 1: Get library_id from users table
            const userQuery = 'SELECT library_id FROM libraries WHERE user_id = ?';
            connection.query(userQuery, [userId], (err, userResults) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Database error');
                }
        
                if (userResults.length === 0) {
                    return res.status(404).send('User not found');
                }
        
                const libraryId = userResults[0].library_id;
        
                // Step 2: Get all books from that library
                const bookQuery = 'SELECT * FROM books WHERE library_id = ?';
                connection.query(bookQuery, [libraryId], (err, bookResults) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Database error');
                    }
        
                    res.render('avail_books', { books: bookResults });
                });
            });
        });
        */
        app.get('/bookAdd',(req,res)=>
            {
                res.sendFile(path.join(__dirname,'public/librarian/bookAdd.html'));
            })
            
            //To add book into the books table
            app.post('/public/librarian/bookAdd' ,(req,res) =>
            {
                console.log(req.body);
                const {title, author, genre, isbn, price, rating} = req.body;
                //add to the books table
                const Price = parseFloat(price);
                const Rating = parseFloat(rating)
                let query = `
                INSERT INTO books (title, author, genre, isbn, price, rating, library_id, availability) VALUES(?,?,?,?,?,?,?,?)`
                connection.query(query,[title,author,genre,isbn,Price,Rating,req.session.userId,1],(err,results) => {
                    if(err) {
                        console.error('Database error : ',err);
                        return res.status(500).send('Internal Server Error');
                    }
            
                    console.log('User registered successfully:', results);
            
                    res.redirect('/bookAdd');
                })
            })
app.get('/history', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    // Step 1: Get library_id from users table
    const libQuery = 'SELECT library_id FROM libraries WHERE user_id = ?';
    connection.query(libQuery, [userId], (err, libResult) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error while getting library_id');
        }

        if (libResult.length === 0) {
            return res.status(404).send('Library not found for user');
        }

        const libraryId = libResult[0].library_id;

        // Step 2: Get borrow history with user names and book titles
        const historyQuery = `
            SELECT 
                bh.*, 
                u.name AS user_name, 
                b.title AS book_title
            FROM borrow_history bh
            JOIN users u ON bh.user_id = u.user_id
            JOIN books b ON bh.book_id = b.book_id
            WHERE bh.library_id = ?
            ORDER BY bh.borrow_date DESC
        `;

        connection.query(historyQuery, [libraryId], (err, results) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching lending history');
            }

            res.render('lendingHistory', { history: results });
        });
    });
});
app.post('/mail', (req, res) => {
    try {
      console.log(req.body);
      const { user_id,borrow_id, book_id} = req.body;
      const sessionUserId = req.session.userId;
        console.log(req.session);
      if (!user_id || !book_id || !borrow_id || !sessionUserId) {
        return res.status(400).send('Missing required fields');
      }
  
      // First: Get receiver's email
      connection.query(
        'SELECT email FROM users WHERE user_id = ?',
        [user_id],
        (err, userResults) => {
          if (err || userResults.length === 0) {
            console.error('User email error:', err);
            return res.status(500).send('Error fetching user email');
          }
  
          const receiverEmail = userResults[0].email;
          console.log(receiverEmail);
          // Second: Get book name
          connection.query(
            'SELECT title FROM books WHERE book_id = ?',
            [book_id],
            (err, bookResults) => {
              if (err || bookResults.length === 0) {
                console.error('Book fetch error:', err);
                return res.status(500).send('Error fetching book name');
              }
  
              const bookName = bookResults[0].title;
              console.log(bookName);
              // Third: Get library name
              connection.query(
                'SELECT name FROM libraries WHERE library_id = ?',
                [req.session.userId],
                (err, libResults) => {
                  if (err || libResults.length === 0) {
                    console.error('Library fetch error:', err);
                    return res.status(500).send('Error fetching library name');
                  }
  
                  const libraryName = libResults[0].name;
                  console.log(libraryName);
                  // Fourth: Get fine amount
                  connection.query(
                    'SELECT fine_amount FROM borrow_history WHERE borrow_id = ?',
                    [borrow_id],
                    (err, fineResults) => {
                      if (err || fineResults.length === 0) {
                        console.error('Fine fetch error:', err);
                        return res.status(500).send('Error fetching fine amount');
                      }
  
                      const fineAmount = fineResults[0].fine_amount;
                      console.log(fineAmount);
                      // Construct mail text
                      const mailText = `Hello!\n\nThis is a friendly reminder from the ${libraryName}.\n\nYou need to return the book: "${bookName}".\nFine due (if any): ₹${fineAmount}\n\nPlease return it as soon as possible.\n\nThank you!`;
  
                      const mailOptions = {
                        from: process.env.EMAIL_USER,
                        to: receiverEmail,
                        subject: 'Library Book Return Reminder',
                        text: mailText,
                      };
  
                      transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                          console.error('Email send error:', err);
                          return res.status(500).send('Failed to send email');
                        }
  
                        console.log('Email sent:', info.response);
                        res.redirect('/history');
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    } catch (err) {
      console.error('Unexpected error:', err);
      res.status(500).send('Something went wrong');
    }
  });
  app.post('/rating', (req, res) => {
    const { book_id, user_rating } = req.body;
  
    if (!book_id || !user_rating) {
      return res.status(400).send('Missing book_id or rating');
    }
  
    connection.query(
      'SELECT rating, no_ratings FROM books WHERE book_id = ?',
      [book_id],
      (err, results) => {
        if (err || results.length === 0) {
          console.error('Error fetching book:', err);
          return res.status(500).send('Could not fetch book');
        }
  
        const currentRating = results[0].rating || 0;
        const currentCount = results[0].no_ratings || 0;
  
        const total = currentRating * currentCount + parseFloat(user_rating);
        const newCount = currentCount + 1;
        const newAverage = total / newCount;
  
        connection.query(
          'UPDATE books SET rating = ?, no_ratings = ? WHERE book_id = ?',
          [newAverage, newCount, book_id],
          (err, updateResult) => {
            if (err) {
              console.error('Error updating rating:', err);
              return res.status(500).send('Could not update rating');
            }
  
            res.redirect('/borrowed');
          }
        );
      }
    );
  });
  
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
// This function is called when a book is returned
function handleReturnedBook(borrow_id) {
    // Step 1: Get the book_id and library_id of the returned book
    const getBookInfoQuery = `
        SELECT book_id, library_id FROM borrow_history WHERE borrow_id = ?
    `;

    connection.query(getBookInfoQuery, [borrow_id], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error fetching book info:', err);
            return;
        }

        const { book_id, library_id } = results[0];

        // Step 2: Get the first user in the reservation queue
        const getFirstReservationQuery = `
            SELECT reservation_id, user_id FROM reservations
            WHERE book_id = ?
            ORDER BY reserved_at ASC
            LIMIT 1
        `;

        connection.query(getFirstReservationQuery, [book_id], (err, reservationResults) => {
            if (err || reservationResults.length === 0) {
                console.log(`No reservations for book ID ${book_id}`);
                return;
            }
            const { reservation_id, user_id } = reservationResults[0];
            const updateAvailability = `
            UPDATE BOOKS SET AVAILABILITY=1 WHERE BOOK_ID=?
        `;

        connection.query(updateAvailability , [book_id], (err, reservationResults) => {
            if (err || reservationResults.length === 0) {
                console.log(`Cannot update availability${book_id}`);
                return;
            }

            

            // Step 3: Insert new borrow record
            const insertBorrowQuery = `
                INSERT INTO borrow_history (book_id, user_id, library_id, borrow_date, due_date, fine_amount, status)
                VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), 0.00, 'Borrowed')
            `;

            connection.query(insertBorrowQuery, [book_id, user_id, library_id], (err) => {
                if (err) {
                    console.error('Error inserting borrow history:', err);
                    return;
                }

                // Step 4: Delete the reservation
                const deleteReservationQuery = `
                    DELETE FROM reservations WHERE reservation_id = ?
                `;

                connection.query(deleteReservationQuery, [reservation_id], (err) => {
                    if (err) {
                        console.error('Error deleting reservation:', err);
                    } else {
                        console.log(`✅ Book ID ${book_id} auto-borrowed by User ID ${user_id} and reservation removed.`);
                    }
                });
            });
        });
    });
});
}
