# Garbet Backend - Express Backend

This is the backend API server built with Express.js and MongoDB.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/garbet
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
NODE_ENV=development
```

3. Make sure MongoDB is running (local or MongoDB Atlas)

4. Run the development server:
```bash
npm run dev
```

The server will run on [http://localhost:5000](http://localhost:5000)

## Project Structure

```
backend/
├── config/              # Configuration files
│   └── database.js     # MongoDB connection
├── controllers/        # Route controllers
│   ├── auth.controller.js
│   └── user.controller.js
├── middleware/         # Custom middleware
│   └── auth.middleware.js
├── models/             # Mongoose models
│   └── User.model.js
├── routes/             # API routes
│   ├── auth.routes.js
│   └── user.routes.js
└── server.js          # Entry point
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Users
- `GET /api/users` - Get all users (Protected)
- `GET /api/users/:id` - Get user by ID (Protected)
- `PUT /api/users/:id` - Update user (Protected)
- `DELETE /api/users/:id` - Delete user (Protected)

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for authentication
- bcryptjs for password hashing

