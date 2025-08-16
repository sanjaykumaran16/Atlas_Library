# The Atlas Library - Library Management System

A comprehensive Library Management System (LMS) built with Node.js, Express, and MySQL that provides both librarian and member functionalities with location-based book search and automated management features.

## 🚀 Features

### 🔐 Authentication & User Management
- **Dual Role System**: Separate interfaces for librarians and library members
- **Secure Login**: Session-based authentication with role validation
- **User Registration**: Signup with location-based coordinates using OpenStreetMap API
- **Password Security**: Bcrypt encryption for user passwords

### 📚 Book Management
- **Book Search**: Advanced search by title, author, genre, or ISBN
- **Location-Based Results**: Books sorted by distance from user's location
- **Multiple Sorting Options**: 
  - Sort by distance (nearest libraries first)
  - Sort by price (lowest to highest)
  - Combined distance and price sorting
- **Book Availability**: Real-time availability status
- **E-book Support**: Digital book management capabilities

### 🏛️ Library Operations
- **Book Borrowing**: Automated borrowing system with due dates
- **Return Management**: Book return with automatic fine calculation
- **Fine System**: Configurable daily fine rates per library
- **Reservation System**: Waitlist for unavailable books
- **Auto-assignment**: Automatic book assignment to waiting users when books are returned

### 👥 Member Features
- **Personal Dashboard**: View balance, favorite genres, and reading history
- **Book Recommendations**: AI-powered suggestions based on reading preferences
- **Borrow History**: Complete record of borrowed and returned books
- **Rating System**: Rate books and contribute to community ratings
- **Fine Management**: Automatic fine deduction from user balance

### 📊 Librarian Features
- **Library Dashboard**: Overview of books, borrows, and popular items
- **Book Addition**: Add new books to the library catalog
- **User Management**: Monitor member activities and statistics
- **Lending History**: Track all book lending activities
- **Email Notifications**: Automated reminder emails for overdue books
- **Analytics**: Popular authors, genres, and top users

### 🌍 Location Services
- **Geolocation**: User location tracking for proximity-based services
- **Distance Calculation**: Haversine formula for accurate distance measurement
- **Library Proximity**: Find nearest libraries for book availability

### 📧 Communication
- **Email Integration**: Nodemailer for automated notifications
- **Overdue Reminders**: Automatic email notifications for late returns
- **Fine Notifications**: Email alerts for outstanding fines

## 🛠️ Technology Stack

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web application framework
- **MySQL**: Relational database
- **Express-Session**: Session management
- **Bcrypt**: Password hashing
- **Nodemailer**: Email functionality

### Frontend
- **EJS**: Template engine for server-side rendering
- **HTML5/CSS3**: Modern responsive design
- **JavaScript**: Client-side interactivity

### Database
- **MySQL**: Primary database with stored procedures
- **Connection Pooling**: Efficient database connections

## 📁 Project Structure

```
The Atlas Library/
├── app.js                 # Main application file
├── db.js                  # Database connection configuration
├── package.json           # Project dependencies and scripts
├── .env                   # Environment variables (not in repo)
├── .gitignore            # Git ignore rules
├── views/                 # EJS template files
│   ├── member.ejs        # Member dashboard
│   ├── librarian.ejs     # Librarian dashboard
│   ├── booksearchresults.ejs
│   ├── borrowhistory.ejs
│   ├── lendinghistory.ejs
│   └── partials/         # Reusable template components
├── public/                # Static assets
│   ├── css/              # Stylesheets
│   ├── member/           # Member-specific HTML files
│   ├── librarian/        # Librarian-specific HTML files
│   ├── login.html        # Login page
│   └── signup.html       # Registration page
└── node_modules/         # Dependencies (not in repo)
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MySQL (v8.0 or higher)
- npm or yarn package manager

### Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
DB_PORT=3306

# Email Configuration (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Session Security
SESSION_SECRET=your_session_secret_key

# Server Configuration
PORT=3000
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "The Atlas Library"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Create a MySQL database
   - Import the required database schema (tables: users, books, libraries, borrow_history, reservations)
   - Update the `.env` file with your database credentials

4. **Start the application**
   ```bash
   npm start
   # or for development with auto-reload
   npx nodemon app.js
   ```

5. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`
   - The application will redirect to the login page

## 📊 Database Schema

The system requires the following main tables:

- **users**: User accounts with roles (librarian/member)
- **books**: Book catalog with availability status
- **libraries**: Library information with location coordinates
- **borrow_history**: Book borrowing and return records
- **reservations**: Book reservation queue system

## 🔧 API Endpoints

### Authentication
- `GET /login` - Login page
- `POST /login` - User authentication
- `POST /signup` - User registration
- `POST /logout` - User logout

### Member Routes
- `GET /member` - Member dashboard
- `GET /bookSearch` - Book search interface
- `POST /member/borrow` - Borrow a book
- `POST /member/returnBook` - Return a book
- `GET /borrowed` - View borrowed books
- `GET /bookrecommendation` - Get book recommendations

### Librarian Routes
- `GET /librarian` - Librarian dashboard
- `GET /books` - View library books
- `GET /bookAdd` - Add book interface
- `POST /public/librarian/bookAdd` - Add new book
- `GET /history` - View lending history
- `POST /mail` - Send reminder emails

### Utility Routes
- `GET /user-info` - Get current user information
- `POST /rating` - Rate a book

## 🎯 Key Features Explained

### Location-Based Book Search
The system uses the Haversine formula to calculate distances between users and libraries, enabling proximity-based book recommendations and sorting.

### Automated Book Management
- **Reservation Queue**: When books are unavailable, users can join a waitlist
- **Auto-assignment**: Returned books are automatically assigned to waiting users
- **Fine Calculation**: Automatic fine calculation based on overdue days

### Smart Recommendations
The system analyzes user reading patterns to suggest books based on:
- Favorite genres
- Reading history
- Popular books in preferred categories

## 🔒 Security Features

- **Session Management**: Secure session handling with configurable secrets
- **Input Validation**: Comprehensive input validation for all user inputs
- **Role-Based Access**: Strict role-based access control
- **SQL Injection Prevention**: Parameterized queries for database operations
- **Password Security**: Bcrypt hashing for password storage

## 🚀 Performance Features

- **Connection Pooling**: Efficient database connection management
- **Static File Serving**: Optimized static asset delivery
- **Session Optimization**: Configurable session settings for scalability
- **Event-Driven Architecture**: Event emitter for handling concurrent operations

## 🧪 Testing

Currently, the project doesn't include automated tests. To add testing:

```bash
npm install --save-dev jest supertest
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🤝 Support

For support and questions:
- Check the existing issues in the repository
- Create a new issue with detailed description
- Contact the development team

## 🔮 Future Enhancements

- **Mobile Application**: React Native or Flutter mobile app
- **Advanced Analytics**: Machine learning-based recommendations
- **Multi-language Support**: Internationalization features
- **API Documentation**: Swagger/OpenAPI documentation
- **Real-time Notifications**: WebSocket integration for live updates
- **Advanced Search**: Elasticsearch integration for better search capabilities

---

**The Atlas Library** - Empowering libraries and readers with intelligent book management solutions.
